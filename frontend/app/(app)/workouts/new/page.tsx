'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { workouts } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CloudRain, Meh, Zap } from 'lucide-react';

export default function NewWorkoutPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await workouts.create({
        name: form.name.trim(),
        date: form.date,
        notes: form.notes.trim() || undefined,
      });
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save workout.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-glow">Reflection</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-center">How's the mood now?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center gap-4 py-2">
              {[
                { label: 'Low', icon: CloudRain },
                { label: 'Okay', icon: Meh },
                { label: 'Strong', icon: Zap, active: true },
              ].map((mood) => (
                <div key={mood.label} className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    mood.active 
                      ? 'bg-gradient-to-br from-orange-400 to-rose-400 shadow-lg shadow-orange-500/20 scale-110' 
                      : 'bg-white/5'
                  }`}>
                    <mood.icon className={`w-8 h-8 ${mood.active ? 'text-white' : 'text-white/40'}`} />
                  </div>
                  <span className={`text-xs font-medium ${mood.active ? 'text-white' : 'text-white/40'}`}>{mood.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="px-2">
            <label className="text-sm font-medium text-white/60 ml-1">Workout Name</label>
            <Input
              name="name"
              placeholder="e.g., Morning run"
              value={form.name}
              onChange={handleChange}
              required
              disabled={loading}
              className="mt-1.5"
            />
          </div>

          <div className="px-2">
            <label className="text-sm font-medium text-white/60 ml-1">Optional notes (optional)</label>
            <Textarea
              name="notes"
              placeholder="Add your notes here..."
              value={form.notes}
              onChange={handleChange}
              disabled={loading}
              className="mt-1.5"
            />
          </div>
        </div>

        <Card className="bg-white/5 border-white/5 text-center py-8">
          <CardContent>
            <p className="text-xl font-bold leading-relaxed text-white/90">
              You showed up.<br />
              That counts.<br />
              Today's effort is a<br />
              step forward.
            </p>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-6">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3 pt-4">
          <Button 
            type="submit" 
            variant="primary"
            size="lg"
            disabled={loading || !form.name} 
            className="w-full"
          >
            {loading ? 'Saving…' : 'Done'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-white/40 hover:text-white"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
