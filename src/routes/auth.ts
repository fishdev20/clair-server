import { buildAuthUrl, makeOAuthClient } from '@/auth/google';
import { env } from '@/env';
import { prisma } from '@/lib/prisma';
import { Router } from 'express';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';

export const auth = Router();

// Start Google OAuth
auth.get('/google', (_req, res) => {
  const state = 'dev';
  res.redirect(buildAuthUrl(state));
});

auth.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send('Missing code');

    const o = makeOAuthClient();

    const { tokens } = await o.getToken({ code, redirect_uri: env.GOOGLE_REDIRECT_URI });
    o.setCredentials(tokens);

    if (!tokens.access_token) {
      console.error('No access_token in tokens:', tokens);
      return res.status(400).send('No access token returned. Check scopes & consent.');
    }

    const oauth2 = google.oauth2({ version: 'v2', auth: o });
    const me = await oauth2.userinfo.get();
    console.log('User info:', me.data);
    const email = me.data.email!;

    // Upsert user
    const user = await prisma.user.upsert({
      where: { email },
      create: { email },
      update: {},
    });

    await prisma.token.upsert({
      where: { userId_provider: { userId: user.id, provider: 'google' } },
      create: {
        userId: user.id,
        provider: 'google',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token,
        scope: tokens.scope || '',
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        scope: tokens.scope || '',
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    const appToken = jwt.sign({ sub: user.id, email }, env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', appToken, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.redirect('/auth/success');
  } catch (e) {
    console.error(e);
    res.status(500).send('OAuth callback failed');
  }
});

// Who am I?
auth.get('/me', async (req, res) => {
  const t = req.cookies?.token;
  if (!t) return res.json({ user: null });
  try {
    const p = jwt.verify(t, env.JWT_SECRET) as any;
    res.json({ user: { id: p.sub, email: p.email } });
  } catch {
    res.json({ user: null });
  }
});

// Optional: logout
auth.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});
