import dotenv from 'dotenv';

dotenv.config();

export const azureConfig = {
  clientId: process.env.AZURE_CLIENT_ID || '',
  clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  tenantId: process.env.AZURE_TENANT_ID || '',
  authority: process.env.AZURE_AUTHORITY || `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || ''}`,
  redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:5000/api/auth/callback',
  frontendRedirectUri: process.env.AZURE_FRONTEND_REDIRECT_URI || 'http://localhost:3000',
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};

export const isAzureAuthEnabled = () => {
  return !!(azureConfig.clientId && azureConfig.tenantId);
};










