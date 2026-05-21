import {
  ConfidentialClientApplication,
  Configuration,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
} from '@azure/msal-node';
import { decryptValue } from '../utils/encryption';
import type { Domain } from '@shared/schema';

const SCOPES = ['openid', 'profile', 'email'];
const GRAPH_SCOPES = ['https://graph.microsoft.com/.default'];

function getMsalClient(domain: Domain): ConfidentialClientApplication {
  const secret = domain.ssoClientSecret ? decryptValue(domain.ssoClientSecret) : '';
  const config: Configuration = {
    auth: {
      clientId: domain.ssoClientId || '',
      authority: `https://login.microsoftonline.com/${domain.ssoTenantId}`,
      clientSecret: secret,
    },
  };
  return new ConfidentialClientApplication(config);
}

export function buildRedirectUri(req: { protocol: string; headers: Record<string, any>; get: (h: string) => string | undefined }): string {
  const proto = ((req.headers['x-forwarded-proto'] as string) || req.protocol).split(',')[0].trim();
  const host = ((req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:5000').split(',')[0].trim();
  return `${proto}://${host}/api/auth/sso/microsoft/callback`;
}

export async function generateAuthUrl(domain: Domain, state: string, redirectUri: string): Promise<string> {
  const msalClient = getMsalClient(domain);
  const request: AuthorizationUrlRequest = {
    scopes: SCOPES,
    redirectUri,
    state,
    prompt: 'select_account',
  };
  return await msalClient.getAuthCodeUrl(request);
}

export async function exchangeCodeForUser(
  domain: Domain,
  code: string,
  redirectUri: string,
): Promise<{ email: string; displayName: string }> {
  const msalClient = getMsalClient(domain);
  const request: AuthorizationCodeRequest = {
    scopes: SCOPES,
    redirectUri,
    code,
  };
  const response = await msalClient.acquireTokenByCode(request);
  const claims = response.idTokenClaims as Record<string, any>;
  const email = (claims?.preferred_username || claims?.email || claims?.upn || '').toLowerCase();
  const displayName = claims?.name || email.split('@')[0];
  if (!email) throw new Error('No email returned from Microsoft token');
  return { email, displayName };
}

export function validateEmailDomain(email: string, domainName: string): boolean {
  return email.toLowerCase().endsWith(`@${domainName.toLowerCase()}`);
}

/**
 * Check whether a user (by email/UPN) is a member of the configured Azure AD group.
 * Uses client credentials flow to call Microsoft Graph API.
 * Returns true if the user is in the group, false otherwise.
 * If no groupId is configured, returns true (no group restriction).
 */
export async function checkGroupMembership(domain: Domain, email: string): Promise<boolean> {
  if (!domain.ssoGroupId) {
    return true;
  }

  try {
    const msalClient = getMsalClient(domain);

    const tokenResponse = await msalClient.acquireTokenByClientCredential({
      scopes: GRAPH_SCOPES,
    });

    if (!tokenResponse?.accessToken) {
      console.error('[SSO Group Check] Failed to acquire Graph API token');
      return false;
    }

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/checkMemberObjects`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: [domain.ssoGroupId] }),
      },
    );

    if (!graphResponse.ok) {
      const errText = await graphResponse.text();
      console.error(`[SSO Group Check] Graph API error ${graphResponse.status}: ${errText}`);
      return false;
    }

    const data = await graphResponse.json() as { value: string[] };
    const isMember = Array.isArray(data.value) && data.value.includes(domain.ssoGroupId);
    console.log(`[SSO Group Check] ${email} membership in group ${domain.ssoGroupId}: ${isMember}`);
    return isMember;
  } catch (error: any) {
    console.error('[SSO Group Check] Error checking group membership:', error.message);
    return false;
  }
}
