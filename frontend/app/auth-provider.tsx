'use client';

import { AuthProvider } from 'react-oidc-context';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';

export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  const oidcConfig = {
    // Use custom domain for all OIDC endpoints
    authority: `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}`,
    client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    redirect_uri: typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : '',
    response_type: 'code',
    scope: 'openid email profile',
    post_logout_redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
    automaticSilentRenew: false,
    loadUserInfo: true,
    skipSigninCallback: false,
    // Provide explicit metadata since custom domain doesn't serve /.well-known/openid-configuration
    metadata: {
      issuer: `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}`,
      authorization_endpoint: `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/authorize`,
      token_endpoint: `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/token`,
      userinfo_endpoint: `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/userInfo`,
      jwks_uri: `https://${process.env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/discovery/keys`,
    },
    // onSigninCallback removed - callback page handles it manually
    // This prevents redirect loops and allows proper state management
  };

  // Log OIDC configuration for debugging
  useEffect(() => {
    console.log('[OIDC] Initializing with config:', {
      authority: oidcConfig.authority,
      client_id: oidcConfig.client_id,
      redirect_uri: oidcConfig.redirect_uri,
      cognito_domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
      cognito_client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    });
  }, []);

  // Validate browser storage is available (required for OIDC tokens)
  useEffect(() => {
    try {
      const test = '__oidc_storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      console.log('[OIDC] Browser storage validation: OK');
    } catch (e) {
      console.error('[OIDC] Browser storage not available:', e);
      console.warn('[OIDC] OIDC tokens may not persist correctly');
    }
  }, []);

  return (
    <AuthProvider {...oidcConfig}>
      <AuthDebugger>
        {children}
      </AuthDebugger>
    </AuthProvider>
  );
}

// Debug component to log auth state changes
function AuthDebugger({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [lastState, setLastState] = useState<string>('');

  useEffect(() => {
    const currentState = JSON.stringify({
      isLoading: auth.isLoading,
      isAuthenticated: auth.isAuthenticated,
      user: auth.user ? { sub: auth.user.profile?.sub, email: auth.user.profile?.email } : null,
      error: auth.error?.message,
    });

    if (currentState !== lastState) {
      console.log('[OIDC Auth State Changed]', {
        isLoading: auth.isLoading,
        isAuthenticated: auth.isAuthenticated,
        user: auth.user ? { sub: auth.user.profile?.sub, email: auth.user.profile?.email } : null,
        error: auth.error?.message,
      });
      setLastState(currentState);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user, auth.error, lastState]);

  return <>{children}</>;
}
