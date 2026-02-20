# Cognito Managed Login Implementation Guide

## Overview

This guide explains the working Cognito Managed Login setup, the complete OAuth2/OIDC flow, and how all components work together.

## Architecture

```
Frontend (Next.js)
├── Auth Provider (react-oidc-context)
│   ├── OIDC Configuration
│   ├── Token Storage (localStorage)
│   └── Auth State Management
├── Signin Page
│   └── Redirects to Cognito Managed Login
├── Callback Page
│   └── Processes OAuth2 callback
└── Protected Routes
    └── Require authentication

Cognito (AWS)
├── User Pool (eu-west-1_Ei5YvXM4t)
├── App Client (t79465rpe9nu3agdn0aekf5p0)
├── Custom Domain (auth-dev.yourpace.cloud)
└── Managed Login UI

OAuth2/OIDC Flow
├── Authorization Endpoint: /oauth2/authorize
├── Token Endpoint: /oauth2/token
├── UserInfo Endpoint: /oauth2/userInfo
└── JWKS Endpoint: /oauth2/discovery/keys
```

## Complete User Flow

### Step-by-Step OAuth2 Authorization Code Flow

```
1. USER VISITS APPLICATION
   └─ https://yourpace.cloud
      └─ Redirects to /signin (unauthenticated)

2. USER CLICKS "SIGN IN WITH COGNITO"
   └─ frontend/app/signin/page.tsx
      └─ Calls auth.signinRedirect()

3. REDIRECT TO COGNITO MANAGED LOGIN
   └─ https://auth-dev.yourpace.cloud/oauth2/authorize
      ├─ client_id: t79465rpe9nu3agdn0aekf5p0
      ├─ redirect_uri: https://yourpace.cloud/auth/callback
      ├─ response_type: code
      ├─ scope: openid email profile
      └─ state: <random_state_value>

4. USER SIGNS IN ON COGNITO
   └─ Enters email + password
   └─ Completes MFA if enabled
   └─ Cognito validates credentials

5. COGNITO REDIRECTS BACK TO APPLICATION
   └─ https://yourpace.cloud/auth/callback?code=<auth_code>&state=<state>
      └─ Authorization code is valid for 10 minutes
      └─ State parameter prevents CSRF attacks

6. CALLBACK PAGE PROCESSES AUTHORIZATION CODE
   └─ frontend/app/auth/callback/page.tsx
      ├─ Detects code in URL
      ├─ Calls userManager.signinCallback()
      └─ Triggers token exchange

7. TOKEN EXCHANGE (Backend)
   └─ POST https://auth-dev.yourpace.cloud/oauth2/token
      ├─ client_id: t79465rpe9nu3agdn0aekf5p0
      ├─ code: <auth_code>
      ├─ redirect_uri: https://yourpace.cloud/auth/callback
      └─ grant_type: authorization_code
      
   └─ Response:
      ├─ access_token: <JWT for API access>
      ├─ id_token: <JWT with user info>
      ├─ refresh_token: <token for refreshing access>
      └─ expires_in: 3600 (1 hour)

8. TOKENS STORED IN BROWSER
   └─ localStorage (managed by react-oidc-context)
      ├─ oidc.user:https://auth-dev.yourpace.cloud:t79465rpe9nu3agdn0aekf5p0
      ├─ oidc.access_token
      └─ oidc.id_token

9. AUTH STATE UPDATES
   └─ React context updates:
      ├─ isAuthenticated: true
      ├─ user: { profile: { email, name, sub, ... } }
      └─ isLoading: false

10. REDIRECT TO DASHBOARD
    └─ router.push('/dashboard')
       └─ User sees dashboard content

11. SIGN OUT
    └─ User clicks "Sign out"
    └─ auth.signoutRedirect()
    └─ Tokens cleared from localStorage
    └─ Redirected to /signin
```

## Key Components

### 1. Auth Provider (`frontend/app/auth-provider.tsx`)

Configures the OIDC client and manages authentication state:

```typescript
const oidcConfig = {
  // Authority (Cognito domain)
  authority: 'https://auth-dev.yourpace.cloud',
  
  // OAuth2 Client
  client_id: 't79465rpe9nu3agdn0aekf5p0',
  
  // Redirect URIs (MUST be registered in Cognito)
  redirect_uri: 'https://yourpace.cloud/auth/callback',
  post_logout_redirect_uri: 'https://yourpace.cloud',
  
  // OAuth2 Configuration
  response_type: 'code',  // Authorization Code Flow
  scope: 'openid email profile',
  
  // OIDC Library Settings
  automaticSilentRenew: false,
  loadUserInfo: true,
  skipSigninCallback: false,  // Let library auto-process callback
  
  // Explicit OIDC Endpoints (custom domain)
  metadata: {
    issuer: 'https://auth-dev.yourpace.cloud',
    authorization_endpoint: 'https://auth-dev.yourpace.cloud/oauth2/authorize',
    token_endpoint: 'https://auth-dev.yourpace.cloud/oauth2/token',
    userinfo_endpoint: 'https://auth-dev.yourpace.cloud/oauth2/userInfo',
    jwks_uri: 'https://auth-dev.yourpace.cloud/oauth2/discovery/keys',
  },
};
```

**Critical Settings:**
- ✅ `skipSigninCallback: false` - Allows library to auto-process OAuth2 callback
- ✅ `response_type: 'code'` - Uses Authorization Code Flow (most secure)
- ✅ `metadata` - Explicit endpoints for custom domain support
- ✅ Static `redirect_uri` - Must match Cognito app client settings

### 2. Signin Page (`frontend/app/signin/page.tsx`)

Initiates the OAuth2 flow:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from 'react-oidc-context';

export default function SignInPage() {
  const auth = useAuth();
  const router = useRouter();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (auth.isAuthenticated && !isRedirecting) {
      router.push('/dashboard');  // Use router.push to preserve context
      return;
    }
  }, [auth.isAuthenticated, isRedirecting, router]);

  // Initiate OAuth2 signin
  const handleSignIn = async () => {
    setSigninAttempted(true);
    setIsRedirecting(true);
    try {
      await auth.signinRedirect();  // Redirects to Cognito
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setIsRedirecting(false);
      setSigninAttempted(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <h1 className="text-3xl font-bold tracking-tight mb-2">YourPace</h1>
        <p className="text-gray-500 mb-6">Train at your pace</p>
        <button
          onClick={handleSignIn}
          disabled={isRedirecting || auth.isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg"
        >
          {isRedirecting ? 'Redirecting to Cognito...' : 'Sign In with Cognito'}
        </button>
      </div>
    </div>
  );
}
```

**Key Features:**
- ✅ Double-click prevention (`signinAttempted` flag)
- ✅ Uses `router.push()` instead of `window.location.href` to preserve React context
- ✅ Checks if already authenticated and redirects to dashboard
- ✅ Error handling with user feedback

### 3. Callback Page (`frontend/app/auth/callback/page.tsx`)

Processes the OAuth2 callback:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from 'react-oidc-context';

export default function AuthCallbackPage() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Log callback state
  useEffect(() => {
    console.log('[Auth Callback] Auth state:', {
      isLoading: auth.isLoading,
      isAuthenticated: auth.isAuthenticated,
      error: auth.error?.message,
    });
  }, [auth.isLoading, auth.isAuthenticated, auth.error]);

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      console.log('[Auth Callback] Authentication successful, redirecting to dashboard');
      router.push('/dashboard');  // Use router.push to preserve context
    }
  }, [auth.isAuthenticated, router]);

  // Display errors
  useEffect(() => {
    if (auth.error) {
      console.error('[Auth Callback] Authentication error:', auth.error);
      setError(auth.error.message);
    }
  }, [auth.error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">YourPace</h1>
        <p className="text-gray-500 mb-6">Train at your pace</p>
        {error ? (
          <div className="text-red-600 text-sm">
            <p>Authentication failed: {error}</p>
            <p className="mt-4">
              <a href="/signin" className="text-blue-600 hover:underline">
                Try again
              </a>
            </p>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Processing authentication...</p>
        )}
      </div>
    </div>
  );
}
```

**How It Works:**
1. `react-oidc-context` automatically detects the authorization code in the URL
2. Library exchanges code for tokens via the token endpoint
3. Tokens are stored in localStorage
4. Auth state updates to `isAuthenticated: true`
5. Component detects state change and redirects to dashboard
6. Uses `router.push()` to preserve React context during navigation

### 4. Protected Routes (`frontend/app/(app)/layout.tsx`)

Protects authenticated routes:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from 'react-oidc-context';
import { useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const auth = useAuth();

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      console.log('[App Layout] Not authenticated, redirecting to /signin');
      router.push('/signin');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  // Show loading state while auth initializes
  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  // Show redirect message if not authenticated
  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight mb-2">YourPace</h1>
          <p className="text-gray-500 mb-6">Train at your pace</p>
          <p className="text-gray-400 text-sm">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Render authenticated content
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation, content, etc. */}
      {children}
    </div>
  );
}
```

**Key Features:**
- ✅ Waits for auth to finish loading before checking authentication
- ✅ Only redirects if auth is fully loaded AND user is not authenticated
- ✅ Shows loading state while auth initializes
- ✅ Prevents redirect loops by checking `!auth.isLoading`

## Environment Variables

Required environment variables in `frontend/.env.local`:

```bash
# Cognito Configuration
NEXT_PUBLIC_COGNITO_DOMAIN=auth-dev.yourpace.cloud
NEXT_PUBLIC_COGNITO_CLIENT_ID=t79465rpe9nu3agdn0aekf5p0
NEXT_PUBLIC_COGNITO_REGION=eu-west-1

# Redirect URIs (must match Cognito app client settings)
NEXT_PUBLIC_REDIRECT_URI=https://yourpace.cloud/auth/callback
NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI=https://yourpace.cloud
```

## Token Management

### How Tokens Are Stored

The `react-oidc-context` library automatically manages tokens in localStorage:

```javascript
// Tokens stored in localStorage
localStorage.getItem('oidc.user:https://auth-dev.yourpace.cloud:t79465rpe9nu3agdn0aekf5p0')
// Returns: { access_token, id_token, refresh_token, expires_at, ... }
```

### Accessing Tokens in Components

```typescript
import { useAuth } from 'react-oidc-context';

export function MyComponent() {
  const auth = useAuth();

  // Access user information
  const email = auth.user?.profile?.email;
  const name = auth.user?.profile?.name;
  const userId = auth.user?.profile?.sub;

  // Access tokens
  const accessToken = auth.user?.access_token;
  const idToken = auth.user?.id_token;

  // Check authentication status
  if (auth.isLoading) return <div>Loading...</div>;
  if (!auth.isAuthenticated) return <div>Not authenticated</div>;

  return <div>Welcome, {email}!</div>;
}
```

### Using Tokens for API Calls

```typescript
// Add token to API requests
const response = await fetch('https://api.yourpace.cloud/workouts', {
  headers: {
    'Authorization': `Bearer ${auth.user?.access_token}`,
    'Content-Type': 'application/json',
  },
});
```

## Troubleshooting

### Issue: Redirect Loop Between /signin and /dashboard

**Cause:** Auth state is being lost during navigation

**Solution:**
1. Use `router.push()` instead of `window.location.href` to preserve React context
2. Ensure `skipSigninCallback: false` in auth provider config
3. Check that `redirect_uri` is static and matches Cognito app client settings
4. Verify tokens are being stored in localStorage

**Debug Steps:**
```javascript
// Check if tokens are stored
console.log(localStorage.getItem('oidc.user:...'));

// Check auth state
const auth = useAuth();
console.log('isAuthenticated:', auth.isAuthenticated);
console.log('isLoading:', auth.isLoading);
console.log('user:', auth.user);
```

### Issue: "Cannot find module 'react-oidc-context'"

**Solution:** Run `npm install` in the frontend directory

### Issue: Cognito domain not working

**Solution:**
1. Verify custom domain is created in Cognito console
2. Wait 5-10 minutes for DNS propagation
3. Check that ACM certificate is validated
4. Verify callback URLs in App Client settings

### Issue: Email verification not working

**Solution:**
1. Check Cognito User Pool email settings
2. Verify SES is in production mode (not sandbox)
3. Check CloudWatch logs for errors
4. Ensure email address is verified in SES

## Deployment

### 1. Deploy Infrastructure

```bash
cd infrastructure
npx cdk deploy --all \
  -c env=dev \
  -c domainName=yourpace.cloud \
  -c hostedZoneId=Z02794812UW0G2U4GTHPL \
  --profile yourpace-dev \
  --require-approval never
```

### 2. Get Cognito Outputs

```bash
# From CDK outputs, note:
# - UserPoolId: eu-west-1_Ei5YvXM4t
# - UserPoolClientId: t79465rpe9nu3agdn0aekf5p0
# - AuthDomain: auth-dev.yourpace.cloud
```

### 3. Update Frontend Environment

```bash
cp frontend/.env.local.example frontend/.env.local
# Edit with values from CDK outputs
```

### 4. Build and Deploy Frontend

```bash
cd frontend
npm install
npm run build
# Frontend is deployed to S3 via CDK
```

### 5. Test the Flow

```bash
# Test in incognito mode for fresh session
1. Visit https://yourpace.cloud
2. Click "Sign In with Cognito"
3. Sign in with test credentials
4. Verify redirect to /dashboard
5. Test sign out
6. Verify redirect to /signin
```

## Security Considerations

✅ **Authorization Code Flow** - Most secure OAuth2 flow for web apps
✅ **PKCE** - Automatically handled by react-oidc-context
✅ **State Parameter** - Prevents CSRF attacks
✅ **Secure Token Storage** - Tokens in localStorage (httpOnly not available in browser)
✅ **Token Expiration** - Access tokens expire after 1 hour
✅ **Refresh Tokens** - Can be used to get new access tokens
✅ **HTTPS Only** - All communication is encrypted
✅ **Custom Domain** - Uses ACM certificate for security

## References

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [react-oidc-context GitHub](https://github.com/authts/react-oidc-context)
- [OAuth2 Authorization Code Flow](https://tools.ietf.org/html/rfc6749#section-1.3.1)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
