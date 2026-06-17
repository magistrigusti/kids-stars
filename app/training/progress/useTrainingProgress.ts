'use client';

import { useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import {
  mergeTrainingProgress,
  sanitizeTrainingProgress,
} from '@/lib/network/trainingProgress';
import type { TrainingProgress } from './types';

const STORAGE_KEY = 'training-zone-progress-v1';
const LOCAL_ACCOUNT_ID = 'local-browser';
const SYNC_DELAY_MS = 1200;

const EMPTY_PROGRESS: TrainingProgress = {
  brainSeconds: 0,
  brainXp: 0,
  breathingSeconds: 0,
  breathingByExercise: {},
  updatedAt: null,
};

function readBreathingByExercise(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, number>>((acc, [exerciseId, seconds]) => {
    const cleanSeconds = Number(seconds);

    acc[exerciseId] = Number.isFinite(cleanSeconds) && cleanSeconds > 0
      ? Math.floor(cleanSeconds)
      : 0;

    return acc;
  }, {});
}

function sumBreathingByExercise(breathingByExercise: Record<string, number>): number {
  return Object.values(breathingByExercise).reduce((sum, seconds) => sum + seconds, 0);
}

interface NetworkProfileResponse {
  profile?: {
    networkUserId?: string;
    email?: string | null;
  };
}

function getProgressStorageKey(accountId: string): string {
  return `${STORAGE_KEY}:${accountId}`;
}

function getLocalProgressStorageKey(userId: string | null | undefined): string {
  return getProgressStorageKey(userId ? `clerk:${userId}` : LOCAL_ACCOUNT_ID);
}

function getProfileAccountId(profile: NetworkProfileResponse['profile']): string | null {
  return (
    profile?.networkUserId
    ?? profile?.email?.trim().toLowerCase()
    ?? null
  );
}

function readProgress(storageKey: string): TrainingProgress {
  if (typeof window === 'undefined') {
    return EMPTY_PROGRESS;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return EMPTY_PROGRESS;
    }

    const parsed = JSON.parse(raw) as Partial<TrainingProgress>;
    const brainSeconds = Number(parsed.brainSeconds) || 0;
    const brainXp = parsed.brainXp === undefined
      ? brainSeconds
      : Number(parsed.brainXp) || 0;
    const breathingByExercise = readBreathingByExercise(parsed.breathingByExercise);
    const summedBreathingSeconds = sumBreathingByExercise(breathingByExercise);

    return {
      brainSeconds,
      brainXp,
      breathingSeconds: Math.max(Number(parsed.breathingSeconds) || 0, summedBreathingSeconds),
      breathingByExercise,
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function saveRemoteProgress(progress: TrainingProgress, method: 'PUT' | 'POST' = 'PUT') {
  return fetch('/api/network/progress', {
    method,
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ progress }),
  });
}

export function useTrainingProgress() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [progress, setProgress] = useState<TrainingProgress>(EMPTY_PROGRESS);
  const [progressStorageKey, setProgressStorageKey] = useState<string | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteProgressLoaded, setRemoteProgressLoaded] = useState(false);
  const [networkSignedIn, setNetworkSignedIn] = useState(false);

  useEffect(() => {
    if (!progressStorageKey) {
      return;
    }

    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
    } catch {}
  }, [progress, progressStorageKey]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const localStorageKey = getLocalProgressStorageKey(
      isSignedIn ? user?.id : null,
    );
    const localProgress = readProgress(localStorageKey);

    setProgress(localProgress);
    setProgressStorageKey(localStorageKey);
    setNetworkSignedIn(false);
    setRemoteReady(false);
    setRemoteProgressLoaded(false);

    async function loadRemoteProgress() {
      try {
        const profileResponse = await fetch('/api/network/profile', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!profileResponse.ok) {
          if (!cancelled) {
            setRemoteProgressLoaded(true);
          }
          return;
        }

        const profileData = await profileResponse.json() as NetworkProfileResponse;
        const accountId = getProfileAccountId(profileData.profile);

        if (!accountId) {
          if (!cancelled) {
            setRemoteProgressLoaded(true);
          }
          return;
        }

        const userStorageKey = getProgressStorageKey(accountId);
        const accountProgress = mergeTrainingProgress(
          localProgress,
          readProgress(userStorageKey),
        );

        setProgressStorageKey(userStorageKey);
        setProgress(prev => mergeTrainingProgress(prev, accountProgress));
        setNetworkSignedIn(true);

        const response = await fetch('/api/network/progress', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          setProgress(prev => mergeTrainingProgress(prev, accountProgress));
          setRemoteProgressLoaded(true);
          return;
        }

        const data = await response.json();
        const remoteProgress = sanitizeTrainingProgress(data.progress);

        if (!cancelled) {
          setProgress(prev => mergeTrainingProgress(
            mergeTrainingProgress(prev, accountProgress),
            remoteProgress,
          ));
          setRemoteProgressLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setRemoteProgressLoaded(true);
        }
      } finally {
        if (!cancelled) {
          setRemoteReady(true);
        }
      }
    }

    loadRemoteProgress();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    if (!isLoaded || !networkSignedIn || !remoteReady || !remoteProgressLoaded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      saveRemoteProgress(progress).catch(() => {});
    }, SYNC_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoaded, networkSignedIn, progress, remoteProgressLoaded, remoteReady]);

  useEffect(() => {
    if (!isLoaded || !networkSignedIn || !remoteReady || !remoteProgressLoaded) {
      return;
    }

    const flushProgress = () => {
      saveRemoteProgress(progress, 'POST').catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushProgress();
      }
    };

    window.addEventListener('pagehide', flushProgress);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushProgress);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoaded, networkSignedIn, progress, remoteProgressLoaded, remoteReady]);

  const addBrainSeconds = useCallback((seconds = 1, xpAmount = seconds) => {
    setProgress(prev => ({
      ...prev,
      brainSeconds: prev.brainSeconds + seconds,
      brainXp: Math.round((prev.brainXp + xpAmount) * 100) / 100,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const addBreathingSeconds = useCallback((exerciseId: string, seconds = 1) => {
    setProgress(prev => {
      const breathingByExercise = {
        ...prev.breathingByExercise,
        [exerciseId]: (prev.breathingByExercise[exerciseId] ?? 0) + seconds,
      };
      const summedBreathingSeconds = sumBreathingByExercise(breathingByExercise);

      return {
        ...prev,
        breathingSeconds: Math.max(prev.breathingSeconds + seconds, summedBreathingSeconds),
        breathingByExercise,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  return {
    progress,
    addBrainSeconds,
    addBreathingSeconds,
  };
}
