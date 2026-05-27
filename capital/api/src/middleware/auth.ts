import basicAuth from 'express-basic-auth';
import { Request, Response, NextFunction } from 'express';
import { azureAuthMiddleware, AuthenticatedRequest, flexibleAuthMiddleware } from './azureAuth';
import { isAzureAuthEnabled } from '../config/azure';

export function createAuthMiddleware() {
  const password = process.env.ADMIN_PASSWORD || 'changeme';
  
  const basicAuthMiddleware = basicAuth({
    users: { admin: password },
    challenge: true,
    realm: 'Admin Center'
  });

  // If Azure auth is enabled, use flexible auth (supports both)
  if (isAzureAuthEnabled()) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for token in query params (for SSE endpoints that don't support custom headers)
      const tokenFromQuery = req.query.token as string | undefined;
      if (tokenFromQuery && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${tokenFromQuery}`;
      }

      // Try Azure auth first if Bearer token is present
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return azureAuthMiddleware(req as AuthenticatedRequest, res, next);
      }
      // Otherwise use basic auth
      return basicAuthMiddleware(req, res, next);
    };
  }

  // Otherwise, just use basic auth
  return basicAuthMiddleware;
}

