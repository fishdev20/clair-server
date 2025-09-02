import { env } from '@/env';
import { google } from 'googleapis';

export function makeOAuthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export function buildAuthUrl(state: string) {
  const o = makeOAuthClient();
  return o.generateAuthUrl({
    access_type: 'offline', // to get refresh_token
    prompt: 'consent', // force consent first time
    include_granted_scopes: true,
    scope: env.GMAIL_SCOPES,
    state,
  });
}

export async function exchangeCode(code: string) {
  const o = makeOAuthClient();
  const { tokens } = await o.getToken(code);
  o.setCredentials(tokens);
  return { client: o, tokens };
}
