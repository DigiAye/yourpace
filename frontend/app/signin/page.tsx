'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignInPage() {
  const auth = useAuth();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signinAttempted, setSigninAttempted] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated && !isRedirecting) {
      router.push('/dashboard');
    }
  }, [auth.isAuthenticated, isRedirecting, router]);

  const handleSignIn = async () => {
    if (signinAttempted || isRedirecting) {
      return;
    }

    setSigninAttempted(true);
    setIsRedirecting(true);
    setError(null);
    
    try {
      await auth.signinRedirect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redirect to sign in. Please try again.');
      setIsRedirecting(false);
      setSigninAttempted(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20">
              <span className="text-white font-bold text-4xl">P</span>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-glow">Pace</CardTitle>
          <CardDescription className="text-white/40">yourpace.fit</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center">
              <p className="text-red-400 text-sm mb-6 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</p>
              <Button onClick={() => setError(null)} variant="outline" className="w-full">
                Try Again
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSignIn}
              disabled={isRedirecting || auth.isLoading}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {isRedirecting ? 'Redirecting...' : auth.isLoading ? 'Loading...' : 'Sign In'}
            </Button>
          )}
          <p className="text-center text-[10px] text-white/20 mt-8 uppercase tracking-[0.2em] font-bold">
            Secure Cloud Authentication
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
