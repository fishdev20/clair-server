import { indexVendorsForUser } from '@/gmail/indexer';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/auth';
import { Router } from 'express';

export const vendors = Router();

// Kick off a full scan (synchronous for now)
vendors.post('/index', requireAuth, async (req: any, res) => {
  try {
    const result = await indexVendorsForUser(req.user.id);
    res.json({ ok: true, ...result });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message || 'Index failed' });
  }
});

// A–Z list
vendors.get('/', requireAuth, async (req: any, res) => {
  const q = (req.query.search as string) || '';
  const rows = await prisma.vendor.findMany({
    where: { userId: req.user.id, ...(q ? { brand: { contains: q, mode: 'insensitive' } } : {}) },
    orderBy: [{ brand: 'asc' }, { lastSeen: 'desc' }],
  });

  const groups: Record<string, typeof rows> = {};
  for (const r of rows) (groups[(r.brand[0] || '#').toUpperCase()] ??= []).push(r);
  const letters = Object.keys(groups).sort();
  if (letters.includes('#')) {
    letters.splice(letters.indexOf('#'), 1);
    letters.push('#');
  }

  res.json({ letters, groups });
});

// Optional: detail for a brand
vendors.get('/:brand', requireAuth, async (req: any, res) => {
  const brand = req.params.brand;
  const entries = await prisma.vendor.findMany({
    where: { userId: req.user.id, brand },
    orderBy: [{ lastSeen: 'desc' }],
  });
  res.json({ brand, entries });
});
