import { makeOAuthClient } from '@/auth/google';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/auth';
import { Router } from 'express';
import { google } from 'googleapis';

export const gmailDebug = Router();

gmailDebug.get('/peek', requireAuth, async (req: any, res) => {
  const token = await prisma.token.findUnique({
    where: { userId_provider: { userId: req.user.id, provider: 'google' } },
  });
  if (!token) return res.status(404).json({ error: 'No Google token' });

  const auth = makeOAuthClient();
  auth.setCredentials({
    access_token: token.accessToken || undefined,
    refresh_token: token.refreshToken || undefined,
  });
  await auth.getAccessToken();

  const gmail = google.gmail({ version: 'v1', auth });

  // Try Promotions/Updates first; if empty, fall back to recent INBOX
  const batches: { labelIds?: string[]; note: string }[] = [
    { labelIds: ['CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES'], note: 'promotions+updates' },
    { labelIds: undefined, note: 'all mail (fallback)' },
  ];

  const out: any[] = [];

  for (const b of batches) {
    const list = await gmail.users.messages.list({
      userId: 'me',
      labelIds: b.labelIds,
      maxResults: 20,
      includeSpamTrash: false,
    });
    const ids = list.data.messages?.map((m) => m.id!) ?? [];
    const sample: any[] = [];
    for (const id of ids) {
      const { data } = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'List-Id', 'List-Unsubscribe'],
      });
      const hs = (data.payload?.headers ?? []) as { name: string; value: string }[];
      const get = (n: string) =>
        hs.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || '';
      sample.push({
        id: data.id,
        from: get('From'),
        subject: get('Subject'),
        date: get('Date'),
        listId: get('List-Id'),
        listUnsub: get('List-Unsubscribe'),
      });
    }
    out.push({ note: b.note, count: sample.length, sample });
    if (sample.length) break; // stop at first non-empty batch
  }

  return res.json(out);
});
