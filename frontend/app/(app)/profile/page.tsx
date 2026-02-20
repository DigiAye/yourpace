'use client';

import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Shield, LogOut } from 'lucide-react';

export default function ProfilePage() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-white/40 text-sm">Loading…</div>
      </div>
    );
  }

  const user = auth.user?.profile;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-glow">Profile</h1>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400/20 to-blue-600/20 border border-white/10 flex items-center justify-center shadow-xl">
          <User className="w-12 h-12 text-cyan-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white/90">{user?.email?.split('@')[0] || 'User'}</h2>
          <p className="text-white/40 text-sm">{user?.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-white/60">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Mail className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Email Address</p>
              <p className="text-sm font-medium text-white/80">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white/60" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Account Status</p>
              <p className="text-sm font-medium text-emerald-400">Verified</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="pt-4">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-4 h-14 px-6 rounded-2xl text-rose-400 hover:text-rose-300 hover:bg-rose-400/10"
          onClick={() => auth.signoutRedirect()}
        >
          <LogOut className="w-5 h-5" />
          <span className="font-bold">Sign Out</span>
        </Button>
      </div>

      <p className="text-center text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">
        Pace v1.0.0
      </p>
    </div>
  );
}
