/**
 * YourPace API Client
 *
 * Thin wrapper around fetch that:
 *   - Adds the Cognito ID token as Authorization header
 *   - Points to the API Gateway endpoint from env
 *   - Throws on non-2xx responses
 */

import { getIdToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ============================================
// Workouts
// ============================================
export interface Workout {
  workoutId: string;
  userId: string;
  name: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export const workouts = {
  list: () => request<Workout[]>('GET', '/workouts'),
  get: (id: string) => request<Workout>('GET', `/workouts/${id}`),
  create: (data: Omit<Workout, 'workoutId' | 'userId' | 'createdAt'>) =>
    request<Workout>('POST', '/workouts', data),
  update: (id: string, data: Partial<Workout>) =>
    request<Workout>('PUT', `/workouts/${id}`, data),
  delete: (id: string) => request<void>('DELETE', `/workouts/${id}`),
};

// ============================================
// Goals
// ============================================
export interface Goal {
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  targetDate?: string;
  completed: boolean;
  createdAt: string;
}

export const goals = {
  list: () => request<Goal[]>('GET', '/goals'),
  create: (data: Omit<Goal, 'goalId' | 'userId' | 'createdAt'>) =>
    request<Goal>('POST', '/goals', data),
};

// ============================================
// User profile
// ============================================
export interface UserProfile {
  userId: string;
  email: string;
  givenName?: string;
  familyName?: string;
}

export const user = {
  me: () => request<UserProfile>('GET', '/users/me'),
  update: (data: Partial<UserProfile>) =>
    request<UserProfile>('PUT', '/users/me', data),
};
