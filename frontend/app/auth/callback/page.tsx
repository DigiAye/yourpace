'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from 'react-oidc-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AuthCallbackPage() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.push('/dashboard');
    }
  }, [auth.isAuthenticated, router]);

  useEffect(() => {
    if (auth.error) {
      setError(auth.error.message);
    }
  }, [auth.error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm w-full">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 animate-pulse">
            <span className="text-white font-bold text-5xl">P</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-glow mb-2">Pace</h1>
        <p className="text-white/40 mb-12 uppercase tracking-[0.3em] text-xs font-bold">yourpace.fit</p>
        
        {error ? (
          <div className="glass-panel p-6 rounded-3xl border-red-500/20 bg-red-500/5">
            <p className="text-red-400 font-medium mb-6">Authentication failed: {error}</p>
            <Link href="/signin">
              <Button variant="outline" className="w-full">
                Try again
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
            </div>
            <p className="text-white/60 font-medium tracking-wide">Processing authentication...</p>
          </div>
        )}
      </div>
    </div>
  );
}
