import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate API key for /api/track endpoint
 * Allows tracking from external services without full authentication
 */
export function createApiKeyMiddleware() {
  const apiKey = process.env.ADMIN_CENTER_API_KEY;
  
  // If no API key is set, allow all requests (backward compatible)
  if (!apiKey) {
    return (req: Request, res: Response, next: NextFunction) => {
      next();
    };
  }

  return (req: Request, res: Response, next: NextFunction) => {
    // Check for API key in header or query parameter
    const providedKey = req.headers['x-api-key'] || req.query.api_key;

    if (!providedKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide an API key via X-API-Key header or api_key query parameter'
      });
    }

    if (providedKey !== apiKey) {
      return res.status(403).json({
        error: 'Invalid API key'
      });
    }

    next();
  };
}



