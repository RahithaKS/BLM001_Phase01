import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import type { User } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Authorization error' });
  }
}
