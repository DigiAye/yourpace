'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from 'react-oidc-context';
import { useEffect } from 'react';
import { Home, Dumbbell, Target, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push('/signin');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Pace</h1>
          <p className="text-muted-foreground mb-6">yourpace.fit</p>
          <p className="text-muted-foreground text-sm">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  async function handleSignOut() {
    await auth.signoutRedirect();
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-background/50">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <Link href="/dashboard" className="font-bold text-xl tracking-tight text-glow">
              Pace
            </Link>
            <span className="text-xs text-muted-foreground ml-2 opacity-50">yourpace.fit</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="rounded-full px-4">
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {children}
      </main>

      <nav className="fixed bottom-6 left-0 right-0 z-20">
        <div className="max-w-md mx-auto px-6">
          <div className="glass-panel rounded-[2.5rem] p-2 flex justify-around items-center">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center py-2 px-6 transition-all duration-300 ${
                    isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-white/10 rounded-full blur-sm" />
                  )}
                  <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
                  <span className="text-[10px] mt-1 font-medium uppercase tracking-wider">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
