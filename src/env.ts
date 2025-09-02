import 'dotenv/config';

function must(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
}

export const env = {
  PORT: Number(process.env.PORT || 4000),
  CORS_ORIGIN: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean),
  JWT_SECRET: must('JWT_SECRET'),
  DATABASE_URL: must('DATABASE_URL'),
  GOOGLE_CLIENT_ID: must('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: must('GOOGLE_CLIENT_SECRET'),
  GOOGLE_REDIRECT_URI: must('GOOGLE_REDIRECT_URI'),
  GMAIL_SCOPES: (
    process.env.GMAIL_SCOPES || 'https://www.googleapis.com/auth/gmail.metadata'
  ).split(' '),
};
