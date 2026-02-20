'use client';

import { useEffect, useState } from 'react';
import { goals as goalsApi } from '@/lib/api';
import type { Goal } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function GoalsPage() {
  const [goalsList, setGoalsList] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', targetDate: '' });
  const [saving, setSaving] = useState(false);

  async function loadGoals() {
    try {
      const data = await goalsApi.list();
      setGoalsList(data);
    } catch (err) {
      setError('Failed to load goals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const newGoal = await goalsApi.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        targetDate: form.targetDate || undefined,
        completed: false,
      });
      setGoalsList((prev) => [newGoal, ...prev]);
      setForm({ title: '', description: '', targetDate: '' });
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create goal.');
    } finally {
      setSaving(false);
    }
  }

  const activeGoals = goalsList.filter((g) => !g.completed);
  const completedGoals = goalsList.filter((g) => g.completed);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-glow">Goals</h1>
          <p className="text-white/40 text-sm mt-0.5">What are you working towards?</p>
        </div>
        <Button 
          variant={showForm ? "ghost" : "primary"} 
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full px-6"
        >
          {showForm ? 'Cancel' : 'New Goal'}
        </Button>
      </div>

      {showForm && (
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          <CardHeader>
            <CardTitle>New Goal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                placeholder="Goal (e.g., Run a 5k)"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                required
                autoFocus
                disabled={saving}
              />
              <Input
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                disabled={saving}
              />
              <Input
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm((p) => ({ ...p, targetDate: e.target.value }))}
                disabled={saving}
              />
              <Button type="submit" variant="primary" disabled={saving || !form.title} className="w-full mt-2">
                {saving ? 'Saving…' : 'Add Goal'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-white/40 text-sm">Loading…</div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-white/60">
                Active ({activeGoals.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeGoals.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/40 text-sm">No active goals.</p>
                  <Button onClick={() => setShowForm(true)} variant="ghost" className="mt-2 text-white/60 hover:text-white">
                    Set your first goal
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeGoals.map((g) => (
                    <div key={g.goalId} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <p className="font-bold text-white/90">{g.title}</p>
                      {g.description && (
                        <p className="text-sm text-white/50 mt-1">{g.description}</p>
                      )}
                      {g.targetDate && (
                        <div className="flex items-center gap-2 mt-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                            Target: {new Date(g.targetDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {completedGoals.length > 0 && (
            <Card className="opacity-60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-white/40">
                  Completed ({completedGoals.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedGoals.map((g) => (
                    <div key={g.goalId} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border border-emerald-400/50 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                      <p className="font-medium text-white/40 line-through">{g.title}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );

}
