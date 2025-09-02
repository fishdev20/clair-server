import { env } from '@/env';
import { auth } from '@/routes/auth';
import { health } from '@/routes/health';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { gmail } from './routes/gmail';
import { gmailDebug } from './routes/gmailDebug';
import { vendors } from './routes/vendors';

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(rateLimit({ windowMs: 60_000, max: 300 }));

app.use('/health', health);
app.use('/auth', auth);
app.use('/gmail', gmail);
app.use('/gmail', gmailDebug);
app.use('/vendors', vendors);

app.listen(env.PORT, () => {
  console.log(`Server listening on :${env.PORT}`);
});
