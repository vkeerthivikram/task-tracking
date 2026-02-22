'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  PomodoroSettings,
  PomodoroSession,
  PomodoroDailyStats,
  StartPomodoroDTO,
  UpdatePomodoroSettingsDTO,
  PomodoroSessionType,
} from '../types';
import * as api from '../services/api';
import { useToast } from './ToastContext';

// Pomodoro context types
interface PomodoroContextType {
  // Settings state
  settings: PomodoroSettings | null;
  settingsLoading: boolean;
  
  // Current session state
  currentSession: PomodoroSession | null;
  sessionLoading: boolean;
  
  // Sessions history
  sessionsToday: PomodoroSession[];
  sessionsLoading: boolean;
  
  // Daily stats
  dailyStats: PomodoroDailyStats | null;
  statsLoading: boolean;
  
  // Combined loading state
  loading: boolean;
  
  // Error state
  error: string | null;
  
  // Timer tick for updating current session time
  timerTick: number;
  
  // Actions - Settings
  fetchSettings: () => Promise<void>;
  updateSettings: (data: UpdatePomodoroSettingsDTO) => Promise<PomodoroSettings>;
  
  // Actions - Session control
  fetchCurrentSession: () => Promise<void>;
  startSession: (taskId?: number, sessionType?: PomodoroSessionType) => Promise<PomodoroSession>;
  pauseSession: () => Promise<PomodoroSession>;
  resumeSession: () => Promise<PomodoroSession>;
  stopSession: () => Promise<void>;
  completeSession: () => Promise<PomodoroSession>;
  skipBreak: () => Promise<PomodoroSession>;
  
  // Actions - History & Stats
  fetchSessions: (filters?: { task_id?: number; date?: string; limit?: number }) => Promise<void>;
  fetchStats: (date?: string) => Promise<void>;
  
  // Helpers
  isRunning: boolean;
  isPaused: boolean;
  isIdle: boolean;
  remainingTimeUs: number;
  progressPercent: number;
  clearError: () => void;
}

const PomodoroContext = createContext<PomodoroContextType | undefined>(undefined);

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  
  // State
  const [settings, setSettings] = useState<PomodoroSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<PomodoroSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionsToday, setSessionsToday] = useState<PomodoroSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [dailyStats, setDailyStats] = useState<PomodoroDailyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timerTick, setTimerTick] = useState(0);
  
  // Interval ref for timer updates
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch settings and current session on mount
  useEffect(() => {
    fetchSettings();
    fetchCurrentSession();
    fetchStats(); // Today's stats
    fetchSessions({ limit: 10 }); // Recent sessions
    
    // Set up interval to update timer tick every second
    intervalRef.current = setInterval(() => {
      setTimerTick(prev => prev + 1);
    }, 1000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Computed helpers
  const isRunning = useMemo(() => {
    return currentSession?.timer_state === 'running';
  }, [currentSession]);
  
  const isPaused = useMemo(() => {
    return currentSession?.timer_state === 'paused';
  }, [currentSession]);
  
  const isIdle = useMemo(() => {
    return !currentSession || currentSession.timer_state === 'idle';
  }, [currentSession]);
  
  // Calculate remaining time in microseconds
  const remainingTimeUs = useMemo(() => {
    if (!currentSession || !settings) return 0;
    
    const durationUs = currentSession.duration_us;
    let elapsedUs = currentSession.elapsed_us;
    
    // If running, add time since last started_at
    if (currentSession.timer_state === 'running' && currentSession.started_at) {
      const startedAt = new Date(currentSession.started_at).getTime();
      const now = Date.now();
      const additionalElapsedMs = now - startedAt;
      elapsedUs += additionalElapsedMs * 1000; // Convert ms to microseconds
    }
    
    const remaining = durationUs - elapsedUs;
    return Math.max(0, remaining);
  }, [currentSession, settings, timerTick]);

  
  // Combined loading state
  const loading = useMemo(() => {
    return settingsLoading || sessionLoading || sessionsLoading || statsLoading;
  }, [settingsLoading, sessionLoading, sessionsLoading, statsLoading]);
  
  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (!currentSession) return 0;
    
    const durationUs = currentSession.duration_us;
    let elapsedUs = currentSession.elapsed_us;
    
    // If running, add time since last started_at
    if (currentSession.timer_state === 'running' && currentSession.started_at) {
      const startedAt = new Date(currentSession.started_at).getTime();
      const now = Date.now();
      const additionalElapsedMs = now - startedAt;
      elapsedUs += additionalElapsedMs * 1000;
    }
    
    const percent = (elapsedUs / durationUs) * 100;
    return Math.min(100, Math.max(0, percent));
  }, [currentSession, timerTick]);
  
  // Fetch settings
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const data = await api.getPomodoroSettings();
      setSettings(data);
    } catch (err) {
      console.error('Error fetching pomodoro settings:', err);
      // Don't show toast for initial fetch error
    } finally {
      setSettingsLoading(false);
    }
  }, []);
  
  // Update settings
  const updateSettings = useCallback(async (data: UpdatePomodoroSettingsDTO): Promise<PomodoroSettings> => {
    setError(null);
    try {
      const updated = await api.updatePomodoroSettings(data);
      setSettings(updated);
      toast.success('Settings updated', 'Pomodoro settings have been saved');
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      toast.error('Failed to update settings', errorMessage);
      throw err;
    }
  }, [toast]);
  
  // Fetch current session
  const fetchCurrentSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const session = await api.getCurrentPomodoro();
      setCurrentSession(session);
    } catch (err) {
      console.error('Error fetching current pomodoro session:', err);
    } finally {
      setSessionLoading(false);
    }
  }, []);
  
  // Start a new session
  const startSession = useCallback(async (taskId?: number, sessionType?: PomodoroSessionType): Promise<PomodoroSession> => {
    setError(null);
    try {
      const data: StartPomodoroDTO = {};
      if (taskId !== undefined) data.task_id = taskId;
      if (sessionType !== undefined) data.session_type = sessionType;
      
      const session = await api.startPomodoro(Object.keys(data).length > 0 ? data : undefined);
      setCurrentSession(session);
      
      const typeLabel = session.session_type === 'work' ? 'Work session' : 
                       session.session_type === 'short_break' ? 'Short break' : 'Long break';
      toast.success('Pomodoro started', `${typeLabel} started`);
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start session';
      setError(errorMessage);
      toast.error('Failed to start session', errorMessage);
      throw err;
    }
  }, [toast]);
  
  // Pause session
  const pauseSession = useCallback(async (): Promise<PomodoroSession> => {
    setError(null);
    try {
      const session = await api.pausePomodoro();
      setCurrentSession(session);
      toast.success('Session paused', 'Pomodoro session paused');
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause session';
      setError(errorMessage);
      toast.error('Failed to pause session', errorMessage);
      throw err;
    }
  }, [toast]);
  
  // Resume session
  const resumeSession = useCallback(async (): Promise<PomodoroSession> => {
    setError(null);
    try {
      const session = await api.resumePomodoro();
      setCurrentSession(session);
      toast.success('Session resumed', 'Pomodoro session resumed');
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume session';
      setError(errorMessage);
      toast.error('Failed to resume session', errorMessage);
      throw err;
    }
  }, [toast]);
  
  // Stop session
  const stopSession = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await api.stopPomodoro();
      setCurrentSession(null);
      toast.success('Session stopped', 'Pomodoro session has been discarded');
      // Refresh stats and sessions
      fetchStats();
      fetchSessions({ limit: 10 });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop session';
      setError(errorMessage);
      toast.error('Failed to stop session', errorMessage);
      throw err;
    }
  }, [toast]);
  
  // Complete session
  const completeSession = useCallback(async (): Promise<PomodoroSession> => {
    setError(null);
    try {
      const session = await api.completePomodoro();
      setCurrentSession(null);
      
      const typeLabel = session.session_type === 'work' ? 'Work session' : 
                       session.session_type === 'short_break' ? 'Short break' : 'Long break';
      toast.success('Session completed', `${typeLabel} completed!`);
      
      // Refresh stats and sessions
      fetchStats();
      fetchSessions({ limit: 10 });
      
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete session';
      setError(errorMessage);
      toast.error('Failed to complete session', errorMessage);
      throw err;
    }
  }, [toast]);
  
  // Skip break
  const skipBreak = useCallback(async (): Promise<PomodoroSession> => {
    setError(null);
    try {
      const session = await api.skipPomodoro();
      setCurrentSession(session);
      toast.success('Break skipped', 'Starting new work session');
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to skip break';
      setError(errorMessage);
      toast.error('Failed to skip break', errorMessage);
      throw err;
    }
  }, [toast]);
  
  // Fetch sessions history
  const fetchSessions = useCallback(async (filters?: { task_id?: number; date?: string; limit?: number }) => {
    setSessionsLoading(true);
    try {
      const sessions = await api.getPomodoroSessions(filters);
      setSessionsToday(sessions);
    } catch (err) {
      console.error('Error fetching pomodoro sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);
  
  // Fetch daily stats
  const fetchStats = useCallback(async (date?: string) => {
    setStatsLoading(true);
    try {
      const stats = await api.getPomodoroStats(date);
      setDailyStats(stats);
    } catch (err) {
      console.error('Error fetching pomodoro stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const value: PomodoroContextType = {
    settings,
    settingsLoading,
    currentSession,
    sessionLoading,
    sessionsToday,
    sessionsLoading,
    dailyStats,
    statsLoading,
    loading,
    error,
    timerTick,
    fetchSettings,
    updateSettings,
    fetchCurrentSession,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    completeSession,
    skipBreak,
    fetchSessions,
    fetchStats,
    isRunning,
    isPaused,
    isIdle,
    remainingTimeUs,
    progressPercent,
    clearError,
  };
  
  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro(): PomodoroContextType {
  const context = useContext(PomodoroContext);
  if (context === undefined) {
    throw new Error('usePomodoro must be used within a PomodoroProvider');
  }
  return context;
}
