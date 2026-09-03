import type { FitnessWorkout } from '../hooks/useFitnessLibrary';
import { supabase } from './supabase';

const CONFIGURED_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://www.dadhealth.co.uk';
const WEB_URL = CONFIGURED_WEB_URL
  .replace(/^https:\/\/dadhealth\.co\.uk(?=\/|$)/, 'https://www.dadhealth.co.uk')
  .replace(/\/$/, '');

export type AIWorkoutRequest = {
  durationMins: number;
  equipment: 'none' | 'dumbbells' | 'full_gym';
  focus: 'full_body' | 'upper' | 'lower' | 'core';
};

type ErrorPayload = { code?: string; error?: string; requestId?: string };

export class WorkoutGenerationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'WorkoutGenerationError';
  }
}

async function validAccessToken(accessToken: string): Promise<string> {
  const tokenCheck = await supabase.auth.getUser(accessToken);
  if (!tokenCheck.error && tokenCheck.data.user) return accessToken;

  const refreshed = await supabase.auth.refreshSession();
  const refreshedToken = refreshed.data.session?.access_token;
  if (!refreshedToken) {
    throw new WorkoutGenerationError(
      'Your session has expired. Please log in again.',
      'session_expired',
    );
  }
  return refreshedToken;
}

function responseError(status: number, payload: ErrorPayload): WorkoutGenerationError {
  if (status === 401 || payload.code === 'session_expired') {
    return new WorkoutGenerationError(
      'Your session has expired. Please log in again.',
      'session_expired',
    );
  }
  if (payload.code === 'free_limit_reached') {
    return new WorkoutGenerationError(
      'You have used your three free AI workouts this month.',
      'free_limit_reached',
    );
  }
  if (status === 429) {
    return new WorkoutGenerationError(
      'You have made several workout requests. Please wait a moment and try again.',
      'rate_limited',
    );
  }
  if (status === 503 || payload.code === 'temporarily_unavailable') {
    return new WorkoutGenerationError(
      'Workout generation is temporarily unavailable. Please try again shortly.',
      'temporarily_unavailable',
    );
  }
  if (status === 400 || payload.code === 'invalid_request') {
    return new WorkoutGenerationError(
      'We could not use those workout options. Check them and try again.',
      'invalid_request',
    );
  }
  return new WorkoutGenerationError(
    payload.error ?? "We couldn't create your workout right now. Please try again.",
    'generation_failed',
  );
}

export async function generateAIWorkout(
  accessToken: string,
  options: AIWorkoutRequest,
): Promise<FitnessWorkout> {
  let token: string;
  try {
    token = await validAccessToken(accessToken);
  } catch (error) {
    if (error instanceof WorkoutGenerationError) throw error;
    throw new WorkoutGenerationError(
      "We couldn't verify your sign-in. Check your connection and try again.",
      'connection_failed',
    );
  }

  let response: Response;
  const requestId = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    response = await fetch(`${WEB_URL}/api/generate-workout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        durationMins: options.durationMins,
        equipment: options.equipment,
        focus: options.focus,
      }),
    });
  } catch {
    throw new WorkoutGenerationError(
      "We couldn't reach Dad Health. Check your connection and try again.",
      'connection_failed',
    );
  }

  let payload: FitnessWorkout | ErrorPayload | null = null;
  try {
    payload = await response.json() as FitnessWorkout | ErrorPayload;
  } catch {
    // The status still provides a safe, useful client message below.
  }

  if (!response.ok) throw responseError(response.status, (payload ?? {}) as ErrorPayload);
  if (!payload || !('id' in payload) || !('exercises' in payload)) {
    throw new WorkoutGenerationError(
      "Your workout was created, but we couldn't load it. Please try again.",
      'invalid_response',
    );
  }
  return payload;
}
