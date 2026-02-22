'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Play, Pause, Square, SkipForward, Settings, Timer, Coffee, Briefcase } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { usePomodoro } from '@/context/PomodoroContext';
import { useToast } from '@/context/ToastContext';
import { breakdownUs, TIME_UNITS } from '@/utils/timeFormat';
import type { PomodoroSessionType } from '@/types';
import { POMODORO_SESSION_CONFIG } from '@/types';

/**
 * Formats microseconds to MM:SS display for Pomodoro timer
 */
function formatPomodoroTime(microseconds: number): string {
  const absUs = Math.max(0, microseconds);
  const b = breakdownUs(absUs);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  
  if (b.hours > 0) {
    return `${pad(b.hours)}:${pad(b.minutes)}:${pad(b.seconds)}`;
  }
  return `${pad(b.minutes)}:${pad(b.seconds)}`;
}

/**
 * Gets the icon for a session type
 */
function getSessionIcon(sessionType: PomodoroSessionType): React.ReactNode {
  switch (sessionType) {
    case 'work':
      return <Briefcase className="w-4 h-4" />;
    case 'short_break':
      return <Coffee className="w-4 h-4" />;
    case 'long_break':
      return <Coffee className="w-4 h-4" />;
    default:
      return <Timer className="w-4 h-4" />;
  }
}

interface PomodoroTimerProps {
  taskId?: number;
  compact?: boolean;
  onComplete?: () => void;
  className?: string;
}

export function PomodoroTimer({
  taskId,
  compact = false,
  onComplete,
  className,
}: PomodoroTimerProps) {
  const {
    settings,
    currentSession,
    dailyStats,
    isRunning,
    isPaused,
    isIdle,
    remainingTimeUs,
    progressPercent,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    completeSession,
    skipBreak,
    loading,
    error,
  } = usePomodoro();

  const { success, error: showError } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-complete callback
  useEffect(() => {
    if (remainingTimeUs !== null && remainingTimeUs <= 0 && isRunning) {
      // Timer reached zero - the context should handle completion
      if (onComplete) {
        onComplete();
      }
    }
  }, [remainingTimeUs, isRunning, onComplete]);

  const handleStart = useCallback(async () => {
    setIsProcessing(true);
    try {
      await startSession(taskId);
      success('Pomodoro Started', 'Focus session started');
    } catch (err) {
      showError('Failed to Start', 'Could not start Pomodoro session');
      console.error('Failed to start session:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [startSession, taskId, success, showError]);

  const handlePause = useCallback(async () => {
    setIsProcessing(true);
    try {
      await pauseSession();
    } catch (err) {
      showError('Failed to Pause', 'Could not pause session');
      console.error('Failed to pause session:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [pauseSession, showError]);

  const handleResume = useCallback(async () => {
    setIsProcessing(true);
    try {
      await resumeSession();
    } catch (err) {
      showError('Failed to Resume', 'Could not resume session');
      console.error('Failed to resume session:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [resumeSession, showError]);

  const handleStop = useCallback(async () => {
    setIsProcessing(true);
    try {
      await stopSession();
      success('Session Stopped', 'Pomodoro session ended');
    } catch (err) {
      showError('Failed to Stop', 'Could not stop session');
      console.error('Failed to stop session:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [stopSession, success, showError]);

  const handleComplete = useCallback(async () => {
    setIsProcessing(true);
    try {
      await completeSession();
      success('Session Complete!', 'Great work! Take a break.');
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      showError('Failed to Complete', 'Could not mark session as complete');
      console.error('Failed to complete session:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [completeSession, success, showError, onComplete]);

  const handleSkipBreak = useCallback(async () => {
    setIsProcessing(true);
    try {
      await skipBreak();
      success('Break Skipped', 'Ready for the next work session?');
    } catch (err) {
      showError('Failed to Skip', 'Could not skip break');
      console.error('Failed to skip break:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [skipBreak, success, showError]);

  // Error display
  if (error) {
    return (
      <div className={twMerge(clsx('text-red-500 text-sm', className))}>
        Error: {error}
      </div>
    );
  }

  // Loading state
  if (loading && !currentSession) {
    return (
      <div className={twMerge(clsx('animate-pulse', className))}>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  const sessionType = currentSession?.session_type ?? 'work';
  const sessionConfig = POMODORO_SESSION_CONFIG[sessionType];
  const displayTime = remainingTimeUs ?? 0;
  const progress = progressPercent ?? 0;
  const sessionsCompleted = dailyStats?.work_sessions_completed ?? 0;
  const dailyGoal = settings?.daily_goal ?? 8;

  // Compact mode for task cards
  if (compact) {
    return (
      <div className={twMerge(clsx('flex items-center gap-2', className))}>
        {isRunning || isPaused ? (
          <>
            <span
              className={clsx(
                'text-xs font-mono',
                isRunning && 'text-green-600 dark:text-green-400 animate-pulse',
                isPaused && 'text-amber-600 dark:text-amber-400'
              )}
            >
              {formatPomodoroTime(displayTime)}
            </span>
            <button
              onClick={isPaused ? handleResume : handlePause}
              disabled={isProcessing}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <Play className="w-3 h-3" />
              ) : (
                <Pause className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={handleStop}
              disabled={isProcessing}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              title="Stop"
            >
              <Square className="w-3 h-3 text-red-500" />
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            disabled={isProcessing}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Start Pomodoro"
          >
            <Timer className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>
    );
  }

  // Full Pomodoro timer display
  return (
    <div
      className={twMerge(
        clsx(
          'flex flex-col items-center p-4 rounded-lg',
          'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          className
        )
      )}
    >
      {/* Session Type Indicator */}
      <div
        className={clsx(
          'flex items-center gap-2 mb-3 px-3 py-1 rounded-full text-sm font-medium',
          sessionType === 'work' &&
            'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
          sessionType === 'short_break' &&
            'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
          sessionType === 'long_break' &&
            'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        )}
      >
        {getSessionIcon(sessionType)}
        <span>{sessionConfig.label}</span>
      </div>

      {/* Circular Progress with Time Display */}
      <div className="relative w-48 h-48 mb-4">
        <svg
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 100 100"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-700"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            className={clsx(
              sessionType === 'work' && 'text-primary-500',
              sessionType === 'short_break' && 'text-green-500',
              sessionType === 'long_break' && 'text-blue-500'
            )}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />
        </svg>

        {/* Time display in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={clsx(
              'text-4xl font-mono font-bold',
              isRunning && 'text-gray-900 dark:text-gray-100',
              isPaused && 'text-amber-600 dark:text-amber-400',
              isIdle && 'text-gray-500 dark:text-gray-400'
            )}
          >
            {formatPomodoroTime(displayTime)}
          </span>
          {isPaused && (
            <span className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Session Count */}
      <div className="mb-4 text-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Today's Sessions:{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {sessionsCompleted}/{dailyGoal}
          </span>
        </span>
        {dailyStats && dailyStats.goal_progress_percent > 0 && (
          <div className="w-32 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 mx-auto overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                dailyStats.goal_progress_percent >= 100
                  ? 'bg-green-500'
                  : 'bg-primary-500'
              )}
              style={{ width: `${Math.min(100, dailyStats.goal_progress_percent)}%` }}
            />
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-3">
        {isIdle ? (
          // Start button
          <button
            onClick={handleStart}
            disabled={isProcessing}
            className={twMerge(
              clsx(
                'flex items-center gap-2 px-6 py-3 rounded-lg font-medium',
                'bg-primary-600 text-white hover:bg-primary-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )
            )}
          >
            <Play className="w-5 h-5" />
            Start Focus
          </button>
        ) : (
          <>
            {/* Pause/Resume button */}
            {isRunning && (
              <button
                onClick={handlePause}
                disabled={isProcessing}
                className={twMerge(
                  clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                    'hover:bg-amber-200 dark:hover:bg-amber-900/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )
                )}
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            {isPaused && (
              <button
                onClick={handleResume}
                disabled={isProcessing}
                className={twMerge(
                  clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                    'hover:bg-green-200 dark:hover:bg-green-900/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )
                )}
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            )}

            {/* Complete button (for work sessions) */}
            {sessionType === 'work' && (
              <button
                onClick={handleComplete}
                disabled={isProcessing}
                className={twMerge(
                  clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                    'bg-green-600 text-white hover:bg-green-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )
                )}
                title="Mark as complete"
              >
                <SkipForward className="w-4 h-4" />
                Complete
              </button>
            )}

            {/* Skip button (for breaks) */}
            {(sessionType === 'short_break' || sessionType === 'long_break') && (
              <button
                onClick={handleSkipBreak}
                disabled={isProcessing}
                className={twMerge(
                  clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                    'hover:bg-blue-200 dark:hover:bg-blue-900/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )
                )}
                title="Skip break"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
            )}

            {/* Stop button */}
            <button
              onClick={handleStop}
              disabled={isProcessing}
              className={twMerge(
                clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                  'hover:bg-red-200 dark:hover:bg-red-900/50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )
              )}
              title="Stop and discard"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </>
        )}
      </div>

      {/* Task association info */}
      {currentSession?.task_id && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Linked to task #{currentSession.task_id}
        </div>
      )}
    </div>
  );
}

/**
 * Compact Pomodoro button for header/sidebar
 */
interface PomodoroButtonProps {
  onClick?: () => void;
  className?: string;
}

export function PomodoroButton({ onClick, className }: PomodoroButtonProps) {
  const { isRunning, isPaused, remainingTimeUs, currentSession } = usePomodoro();
  const displayTime = remainingTimeUs ?? 0;
  const sessionType = currentSession?.session_type ?? 'work';

  return (
    <button
      onClick={onClick}
      className={twMerge(
        clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          isRunning && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
          isPaused && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
          !isRunning && !isPaused && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
          className
        )
      )}
    >
      {getSessionIcon(sessionType)}
      {isRunning || isPaused ? (
        <span className="font-mono">{formatPomodoroTime(displayTime)}</span>
      ) : (
        <span>Pomodoro</span>
      )}
    </button>
  );
}

export default PomodoroTimer;
