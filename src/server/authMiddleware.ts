import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  avatarUrl?: string | null;
  phone?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const personaHeader = req.headers['x-demo-user-id'] as string | undefined;

    // 1. If a demo persona is selected or active
    if (personaHeader) {
      const [foundUser] = await db.select().from(users).where(eq(users.id, personaHeader));
      if (foundUser) {
        req.user = {
          id: foundUser.id,
          name: foundUser.name,
          email: foundUser.email,
          role: foundUser.role as 'ADMIN' | 'STAFF' | 'CUSTOMER',
          avatarUrl: foundUser.avatarUrl,
          phone: foundUser.phone,
        };
        return next();
      }
    }

    // 2. If Bearer token is provided
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (token && token !== 'undefined' && token !== 'null') {
        try {
          const decoded = await adminAuth.verifyIdToken(token);
          // Look up or auto-provision in DB
          let [existing] = await db.select().from(users).where(eq(users.id, decoded.uid));
          if (!existing) {
            const newUser = {
              id: decoded.uid,
              name: decoded.name || decoded.email?.split('@')[0] || 'User',
              email: decoded.email || `${decoded.uid}@example.com`,
              avatarUrl: decoded.picture || null,
              role: 'CUSTOMER' as const,
            };
            const [created] = await db.insert(users).values(newUser).returning();
            existing = created;
          }
          req.user = {
            id: existing.id,
            name: existing.name,
            email: existing.email,
            role: existing.role as 'ADMIN' | 'STAFF' | 'CUSTOMER',
            avatarUrl: existing.avatarUrl,
            phone: existing.phone,
          };
          return next();
        } catch (tokenErr) {
          // Token invalid or expired, continue as unauthenticated
          console.warn('Bearer token verification failed:', tokenErr);
        }
      }
    }

    // Default: public or anonymous caller
    req.user = undefined;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next();
  }
}

export function requireRole(allowedRoles: ('ADMIN' | 'STAFF' | 'CUSTOMER')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  };
}
