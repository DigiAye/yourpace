'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { workouts, goals } from '@/lib/api';
import type { Workout, Goal } from '@/lib/api';
import { getCurrentUserEmail } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Briefcase, CloudRain, Meh, Zap } from 'lucide-react';

export default function DashboardPage() {
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [ws, gs, em] = await Promise.all([
          workouts.list().catch(() => [] as Workout[]),
          goals.list().catch(() => [] as Goal[]),
          getCurrentUserEmail(),
        ]);
        setRecentWorkouts(ws.slice(0, 5));
        setActiveGoals(gs.filter((g) => !g.completed).slice(0, 3));
        setEmail(em);
      } catch (err) {
        setError('Failed to load data. Is the API deployed?');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Hi, {email ? email.split('@')[0] : 'there'}. How are you feeling today?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center gap-4 py-2">
            {[
              { label: 'Low', icon: CloudRain, color: 'text-blue-400' },
              { label: 'Okay', icon: Meh, color: 'text-yellow-400' },
              { label: 'Strong', icon: Zap, color: 'text-orange-400', active: true },
            ].map((mood) => (
              <div key={mood.label} className="flex flex-col items-center gap-2">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                  mood.active 
                    ? 'bg-gradient-to-br from-orange-400 to-rose-400 shadow-lg shadow-orange-500/20 scale-110' 
                    : 'bg-white/5 hover:bg-white/10'
                }`}>
                  <mood.icon className={`w-8 h-8 ${mood.active ? 'text-white' : 'text-white/60'}`} />
                </div>
                <span className={`text-xs font-medium ${mood.active ? 'text-white' : 'text-white/40'}`}>{mood.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-white/60">Recent Patterns:</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/80 leading-relaxed">
            Consistent this week! You've been favoring strength over cardio.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-400/80">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6">
        <Link href="/workouts/new" className="group">
          <Card className="flex flex-col items-center justify-center text-center aspect-square p-0 overflow-hidden transition-transform group-hover:scale-[1.02] active:scale-[0.98]">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 opacity-50" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-400/20 flex items-center justify-center border border-emerald-400/30">
                <Calendar className="w-7 h-7 text-emerald-400" />
              </div>
              <CardTitle className="text-lg font-bold leading-tight px-4">Structured Session</CardTitle>
            </div>
          </Card>
        </Link>
        <Link href="/workouts/new" className="group">
          <Card className="flex flex-col items-center justify-center text-center aspect-square p-0 overflow-hidden transition-transform group-hover:scale-[1.02] active:scale-[0.98]">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-pink-500/20 opacity-50" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-400/20 flex items-center justify-center border border-purple-400/30">
                <Briefcase className="w-7 h-7 text-purple-400" />
              </div>
              <CardTitle className="text-lg font-bold leading-tight px-4">Build Your Own</CardTitle>
            </div>
          </Card>
        </Link>
      </div>

      {recentWorkouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Workouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentWorkouts.map((w) => (
                <div key={w.workoutId} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(w.date).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeGoals.map((g) => (
                <div key={g.goalId} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{g.title}</p>
                    {g.targetDate && (
                      <p className="text-sm text-muted-foreground">
                        Target: {new Date(g.targetDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
