import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/middleware/auth';
import { Router } from 'express';
import { google } from 'googleapis';

export const gmail = Router();

gmail.get('/profile', requireAuth, async (req: any, res) => {
  const token = await prisma.token.findUnique({
    where: { userId_provider: { userId: req.user.id, provider: 'google' } },
  });
  if (!token) return res.status(404).json({ error: 'No Google token' });

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token.accessToken, refresh_token: token.refreshToken });
  const g = google.gmail({ version: 'v1', auth });
  const prof = await g.users.getProfile({ userId: 'me' });
  res.json(prof.data); // emailAddress, messagesTotal, historyId
});

gmail.get('/', async (req: any, res) => {
  console.log('Gmail route');
});
