'use client';

import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';

export default function SignUpPage() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) {
      window.location.href = '/dashboard';
      return;
    }

    if (!auth.isLoading && !auth.isAuthenticated) {
      auth.signinRedirect();
    }
  }, [auth, auth.isAuthenticated, auth.isLoading]);

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
        
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
          </div>
          <p className="text-white/60 font-medium tracking-wide">Redirecting to sign up...</p>
        </div>
      </div>
    </div>
  );
}
