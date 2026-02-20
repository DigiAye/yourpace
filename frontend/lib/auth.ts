'use client';

/**
 * YourPace Auth — OAuth2/OIDC via Cognito Managed Login
 *
 * Uses react-oidc-context for standard OAuth2 code flow.
 * Tokens are managed by the OIDC provider (Cognito).
 */

import { useAuth as useOidcAuth } from 'react-oidc-context';

// ============================================
// OIDC Configuration
// ============================================
// NOTE: The authority MUST be the AWS-managed Cognito domain for OIDC discovery
// The custom domain (auth-dev.yourpace.cloud) is used only for the authorization_endpoint
export const oidcConfig = {
  authority: `https://yourpace-auth-dev.auth.${process.env.NEXT_PUBLIC_COGNITO_REGION}.amazoncognito.com`,
  client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
  redirect_uri: typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : '',
  response_type: 'code',
  scope: 'openid email profile',
  post_logout_redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
  // Override the authorization endpoint to use the custom domain for better UX
  metadata: {
    issuer: `https://yourpace-auth-dev.auth.${process.env.NEXT_PUBLIC_COGNITO_REGION}.amazoncognito.com`,
    authorization_endpoint: `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/authorize`,
    token_endpoint: `https://yourpace-auth-dev.auth.${process.env.NEXT_PUBLIC_COGNITO_REGION}.amazoncognito.com/oauth2/token`,
    userinfo_endpoint: `https://yourpace-auth-dev.auth.${process.env.NEXT_PUBLIC_COGNITO_REGION}.amazoncognito.com/oauth2/userInfo`,
    jwks_uri: `https://yourpace-auth-dev.auth.${process.env.NEXT_PUBLIC_COGNITO_REGION}.amazoncognito.com/oauth2/discovery/keys`,
  },
};

// ============================================
// useAuth Hook — wrapper around react-oidc-context
// ============================================
export function useAuth() {
  const auth = useOidcAuth();
  return auth;
}

// ============================================
// Helper to get user from storage without hooks
// ============================================
function getUserFromStorage() {
  if (typeof window === 'undefined') return null;
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('oidc.user:')) {
      const item = sessionStorage.getItem(key);
      if (item) {
        try {
          return JSON.parse(item);
        } catch (e) {
          return null;
        }
      }
    }
  }
  return null;
}

// ============================================
// Get ID Token for API calls (non-hook version)
// ============================================
export async function getIdToken(): Promise<string | null> {
  const user = getUserFromStorage();
  return user?.id_token ?? null;
}

// ============================================
// Get current user email (non-hook version)
// ============================================
export async function getCurrentUserEmail(): Promise<string | null> {
  const user = getUserFromStorage();
  return user?.profile?.email ?? null;
}
