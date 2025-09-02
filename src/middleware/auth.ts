import { env } from '@/env';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.token;
  const auth = req.headers.authorization;
  if (!token && auth?.startsWith('Bearer ')) token = auth.slice(7);

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; email?: string };
    (req as any).user = { id: payload.sub, email: payload.email };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
