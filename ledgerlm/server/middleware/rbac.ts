import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - please sign in" });
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ 
        error: "Forbidden - admin access required",
        message: "You must have admin privileges to access this resource" 
      });
    }

    const memberships = await storage.getUserCompanyMemberships(userId);
    const adminMembership = memberships.find(m => m.role === 'admin');
    
    if (!adminMembership) {
      return res.status(403).json({ 
        error: "Forbidden - company admin role required",
        message: "You must be an admin of a company to access this resource" 
      });
    }

    (req as any).adminCompanyId = adminMembership.companyId;
    (req as any).adminUserId = userId;

    next();
  } catch (error) {
    console.error('RBAC middleware error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function requireCompanyMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    const companyId = req.params.companyId || req.body.companyId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - please sign in" });
    }

    if (!companyId) {
      return res.status(400).json({ error: "Company ID required" });
    }

    const membership = await storage.getCompanyMembership(userId, companyId);
    
    if (!membership) {
      return res.status(403).json({ 
        error: "Forbidden - company membership required",
        message: "You don't have access to this company's data" 
      });
    }

    next();
  } catch (error) {
    console.error('Company membership middleware error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
}
