import { makeOAuthClient } from '@/auth/google';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import { RateLimiter } from './rateLimiter';

type Header = { name: string; value: string };
const hv = (hs: Header[], n: string) =>
  hs.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';

const SPECIAL: Record<string, string> = {
  'hm.com': 'H&M',
  'h-m.com': 'H&M',
  'zara.com': 'Zara',
  'asos.com': 'ASOS',
  'nike.com': 'Nike',
  'adidas.com': 'Adidas',
  'uniqlo.com': 'Uniqlo',
  'decathlon.com': 'Decathlon',
};

function normalizeBrand(s: string) {
  const d = (s || '').toLowerCase();
  for (const k of Object.keys(SPECIAL)) if (d.includes(k)) return SPECIAL[k];
  const host =
    d.match(/([a-z0-9-]+)\.(com|net|org|io|co|shop|store|vn|uk|de|fr|jp|sg)/i)?.[1] ||
    d.split('@')[1]?.split('.')[0] ||
    d;
  return host.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstUnsubLink(v?: string) {
  if (!v) return '';
  const urls = v.match(/<([^>]+)>/g)?.map((s) => s.slice(1, -1)) ?? [];
  return urls.find((u) => u.startsWith('http')) || urls[0] || '';
}

function looksLikeMembership(subject: string, listId: string, listUnsub: string) {
  const s = `${subject} ${listId}`.toLowerCase();
  // relax: accept if newsletter headers exist OR subject hints membership
  return (
    !!listId ||
    !!listUnsub ||
    /(welcome|member|membership|account|đăng ký|chào mừng|tier|loyalty)/i.test(s)
  );
}

async function getAuthedGmail(userId: string) {
  const token = await prisma.token.findUnique({
    where: { userId_provider: { userId, provider: 'google' } },
  });
  if (!token) throw new Error('No Google token for user');

  // IMPORTANT: create client with app credentials so refresh works
  const auth = makeOAuthClient();
  auth.setCredentials({
    access_token: token.accessToken || undefined,
    refresh_token: token.refreshToken || undefined,
  });

  // Ensure we can obtain/refresh an access_token
  await auth.getAccessToken().catch(() => {
    throw new Error('Failed to obtain Google access token. Please reconnect Google.');
  });

  return google.gmail({ version: 'v1', auth });
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Simple concurrency limiter without extra deps.
 */
async function runLimited<T>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<void>,
) {
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await worker(items[idx], idx);
      } catch (e) {
        // swallow per-item errors; caller can decide how to handle
        console.error('worker error', e);
      }
    }
  });
  await Promise.all(workers);
}

/**
 * Index brands from Gmail using labelIds only (works with gmail.metadata scope).
 */
export async function indexVendorsForUser(userId: string) {
  const gmail = await getAuthedGmail(userId);

  const limiter = new RateLimiter(40); // ~40 requests/minute to stay well under the cap
  const labelIds: string[] | undefined = undefined;
  const includeSpamTrash = false;
  const maxResults = 200;

  const HARD_CAP = 200; // process at most 300 messages per run to avoid long jobs
  let processed = 0;
  let pageToken: string | undefined = undefined;
  const bucket = new Map<
    string,
    {
      brand: string;
      domainKey: string;
      firstSeen: string;
      lastSeen: string;
      evidenceCount: number;
      unsubscribeUrl?: string;
      confidence: number;
    }
  >();

  do {
    // throttle the list request
    await limiter.take();
    const list = await gmail.users.messages.list({
      userId: 'me',
      labelIds,
      maxResults,
      pageToken,
      includeSpamTrash,
    });

    pageToken = list.data.nextPageToken || undefined;
    const ids = list.data.messages?.map((m) => m.id!) ?? [];
    if (ids.length === 0) break;

    for (const id of ids) {
      if (processed >= HARD_CAP) break;

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await limiter.take();
          const { data } = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date', 'List-Id', 'List-Unsubscribe'],
          });

          const hs = (data.payload?.headers ?? []) as { name: string; value: string }[];
          const get = (n: string) =>
            hs.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
          const from = get('From');
          const subject = get('Subject');
          const listId = get('List-Id');
          const listUnsub = get('List-Unsubscribe');
          const dateStr = get('Date');
          const iso = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

          if (!looksLikeMembership(subject, listId, listUnsub)) {
            processed++;
            break;
          }

          const domainFrom = from.match(/@([a-z0-9.-]+)/i)?.[1]?.toLowerCase();
          const domainList = listId.match(/([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
          const domainKey = domainList || domainFrom || 'unknown';
          const brand = normalizeBrand(domainKey || subject || listId);
          const unsubscribeUrl = firstUnsubLink(listUnsub);
          const confidence = Math.min(
            1,
            (listUnsub ? 0.4 : 0) +
              (listId ? 0.4 : 0) +
              (/(welcome|member|account|đăng ký|chào mừng)/i.test(subject) ? 0.2 : 0),
          );

          const key = `${brand}__${domainKey}`;
          const prev = bucket.get(key);
          if (!prev) {
            bucket.set(key, {
              brand,
              domainKey,
              firstSeen: iso,
              lastSeen: iso,
              evidenceCount: 1,
              unsubscribeUrl,
              confidence,
            });
          } else {
            prev.evidenceCount += 1;
            if (iso > prev.lastSeen) prev.lastSeen = iso;
            if (iso < prev.firstSeen) prev.firstSeen = iso;
            if (!prev.unsubscribeUrl && unsubscribeUrl) prev.unsubscribeUrl = unsubscribeUrl;
            prev.confidence = Math.max(prev.confidence, confidence);
          }

          processed++;
          break; // success
        } catch (err: any) {
          const status = err?.code || err?.response?.status;
          const retryAfter =
            Number(err?.response?.headers?.['retry-after']) || (status === 429 ? 30 : 0);
          if (status === 429 || (status >= 500 && status < 600)) {
            // exponential backoff with optional Retry-After
            const backoffMs = retryAfter ? retryAfter * 1000 : 400 * (attempt + 1);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
          // Non-retryable: stop trying this message
          break;
        }
      }
    }
  } while (pageToken && processed < HARD_CAP);

  for (const v of bucket.values()) {
    await prisma.vendor.upsert({
      where: { userId_brand_domainKey: { userId, brand: v.brand, domainKey: v.domainKey } },
      create: {
        userId,
        brand: v.brand,
        domainKey: v.domainKey,
        firstSeen: new Date(v.firstSeen),
        lastSeen: new Date(v.lastSeen),
        evidenceCount: v.evidenceCount,
        unsubscribeUrl: v.unsubscribeUrl,
        confidence: v.confidence,
      },
      update: {
        firstSeen: new Date(v.firstSeen),
        lastSeen: new Date(v.lastSeen),
        evidenceCount: v.evidenceCount,
        unsubscribeUrl: v.unsubscribeUrl ?? undefined,
        confidence: v.confidence,
      },
    });
  }

  await prisma.syncState.upsert({
    where: { userId },
    create: { userId, lastScanAt: new Date() },
    update: { lastScanAt: new Date() },
  });

  return { processed, vendors: bucket.size };
}
