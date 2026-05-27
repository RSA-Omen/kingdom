import express, { Request, Response } from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { azureConfig, isAzureAuthEnabled } from '../config/azure';

const router = express.Router();

let msalClient: ConfidentialClientApplication | null = null;

if (isAzureAuthEnabled()) {
  msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: azureConfig.clientId,
      clientSecret: azureConfig.clientSecret,
      authority: azureConfig.authority,
    },
  });
}

/**
 * GET /api/auth/login
 * Initiates the Microsoft login flow
 */
router.get('/login', (req: Request, res: Response) => {
  if (!isAzureAuthEnabled() || !msalClient) {
    return res.status(503).json({ error: 'Azure authentication is not configured' });
  }

  const authCodeUrlParameters = {
    scopes: azureConfig.scopes,
    redirectUri: azureConfig.redirectUri,
  };

  msalClient
    .getAuthCodeUrl(authCodeUrlParameters)
    .then((response) => {
      res.redirect(response);
    })
    .catch((error) => {
      console.error('Error getting auth code URL:', error);
      res.status(500).json({ error: 'Failed to initiate login' });
    });
});

/**
 * GET /api/auth/callback
 * Handles the OAuth callback from Microsoft
 */
router.get('/callback', async (req: Request, res: Response) => {
  if (!isAzureAuthEnabled() || !msalClient) {
    return res.status(503).json({ error: 'Azure authentication is not configured' });
  }

  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    return res.redirect(`${azureConfig.frontendRedirectUri}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${azureConfig.frontendRedirectUri}/login?error=no_code`);
  }

  try {
    const tokenRequest = {
      code,
      scopes: azureConfig.scopes,
      redirectUri: azureConfig.redirectUri,
    };

    const response = await msalClient.acquireTokenByCode(tokenRequest);
    
    if (response && response.account) {
      // Redirect to frontend with token
      const token = response.idToken || response.accessToken;
      res.redirect(`${azureConfig.frontendRedirectUri}/auth/callback?token=${token}`);
    } else {
      res.redirect(`${azureConfig.frontendRedirectUri}/login?error=no_token`);
    }
  } catch (error) {
    console.error('Error acquiring token:', error);
    res.redirect(`${azureConfig.frontendRedirectUri}/login?error=token_error`);
  }
});

/**
 * GET /api/auth/logout
 * Logs out the user
 */
router.get('/logout', (req: Request, res: Response) => {
  // Redirect to Microsoft logout endpoint
  const logoutUri = `https://login.microsoftonline.com/${azureConfig.tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(azureConfig.frontendRedirectUri)}`;
  res.redirect(logoutUri);
});

/**
 * GET /api/auth/me
 * Returns current user information (requires authentication)
 */
router.get('/me', (req: Request, res: Response) => {
  // This endpoint should be protected by auth middleware
  // The user info should be available in req.user if using azureAuthMiddleware
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
});

export default router;










