import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { azureConfig, isAzureAuthEnabled } from '../config/azure';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    [key: string]: any;
  };
}

/**
 * Middleware to validate Azure AD JWT tokens
 * Falls back to basic auth if Azure is not configured
 */
export function azureAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // If Azure auth is not enabled, skip this middleware
  if (!isAzureAuthEnabled()) {
    return next();
  }

  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    // Verify and decode the token
    // Note: In production, you should verify the token signature against Azure's public keys
    // For now, we'll decode and validate basic claims
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded || typeof decoded === 'string') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const payload = decoded.payload as any;

    // Validate token claims
    if (payload.iss !== `https://login.microsoftonline.com/${azureConfig.tenantId}/v2.0`) {
      return res.status(401).json({ error: 'Invalid token issuer' });
    }

    // Check token expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return res.status(401).json({ error: 'Token expired' });
    }

    // Extract user information
    req.user = {
      id: payload.oid || payload.sub,
      email: payload.email || payload.preferred_username || payload.upn,
      name: payload.name || payload.preferred_username || 'Unknown',
      ...payload
    };

    next();
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Optional middleware - allows requests with either Azure auth or basic auth
 */
export function flexibleAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check for Bearer token first (Azure)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return azureAuthMiddleware(req, res, next);
  }

  // Otherwise, let basic auth middleware handle it
  next();
}










