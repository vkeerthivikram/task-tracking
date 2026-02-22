# Pomodoro Feature Architecture Design

**Version**: 2.4.0 (Proposed)  
**Date**: 2026-02-22  
**Author**: Architecture Planning  

## Overview

This document describes the complete architecture for implementing a Pomodoro timer feature in Celestask. The feature integrates with the existing time tracking system (v2.3.0) and follows established codebase patterns.

---

## 1. Database Schema

### 1.1 `pomodoro_settings` Table

User preferences for Pomodoro technique. Single-row table (single-user application).

```sql
CREATE TABLE IF NOT EXISTS pomodoro_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Enforce single row
  work_duration_us INTEGER NOT NULL DEFAULT 15000000000,    -- 25 minutes in microseconds
  short_break_duration_us INTEGER NOT NULL DEFAULT 300000000, -- 5 minutes in microseconds
  long_break_duration_us INTEGER NOT NULL DEFAULT 900000000,  -- 15 minutes in microseconds
  sessions_until_long_break INTEGER NOT NULL DEFAULT 4,
  auto_start_work INTEGER NOT NULL DEFAULT 0,     -- Boolean: auto-start work after break
  auto_start_break INTEGER NOT NULL DEFAULT 0,    -- Boolean: auto-start break after work
  notification_sound INTEGER NOT NULL DEFAULT 1,  -- Boolean: play sound on completion
  daily_goal_sessions INTEGER DEFAULT 8,          -- Target pomodoros per day
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Default Values**:
- Work: 25 minutes (1,500,000,000,000 μs)
- Short break: 5 minutes (300,000,000,000 μs)
- Long break: 15 minutes (900,000,000,000 μs)
- Sessions until long break: 4

**Migration Pattern** (follows existing `schema.js`):
```javascript
// In schema.js createTables()
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pomodoro_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      work_duration_us INTEGER NOT NULL DEFAULT 1500000000000,
      short_break_duration_us INTEGER NOT NULL DEFAULT 300000000000,
      long_break_duration_us INTEGER NOT NULL DEFAULT 900000000000,
      sessions_until_long_break INTEGER NOT NULL DEFAULT 4,
      auto_start_work INTEGER NOT NULL DEFAULT 0,
      auto_start_break INTEGER NOT NULL DEFAULT 0,
      notification_sound INTEGER NOT NULL DEFAULT 1,
      daily_goal_sessions INTEGER DEFAULT 8,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Insert default settings row
  db.exec(`
    INSERT OR IGNORE INTO pomodoro_settings (id) VALUES (1)
  `);
  
  console.log('Created pomodoro_settings table');
} catch (error) {
  console.error('Error creating pomodoro_settings table:', error.message);
}
```

### 1.2 `pomodoro_sessions` Table

Records of completed Pomodoro sessions linked to tasks.

```sql
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY,                            -- UUID
  task_id INTEGER,                                -- Optional: can be free-running
  session_type TEXT NOT NULL CHECK (session_type IN ('work', 'short_break', 'long_break')),
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  duration_us INTEGER,                            -- Actual duration when completed
  target_duration_us INTEGER NOT NULL,            -- Intended duration from settings
  completed INTEGER NOT NULL DEFAULT 0,           -- Boolean: finished without skip/interrupt
  interrupted INTEGER NOT NULL DEFAULT 0,         -- Boolean: manually stopped early
  notes TEXT,                                     -- Optional session notes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_task ON pomodoro_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_type ON pomodoro_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started ON pomodoro_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_completed ON pomodoro_sessions(completed);
```

**Migration Pattern**:
```javascript
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id TEXT PRIMARY KEY,
      task_id INTEGER,
      session_type TEXT NOT NULL CHECK (session_type IN ('work', 'short_break', 'long_break')),
      started_at DATETIME NOT NULL,
      ended_at DATETIME,
      duration_us INTEGER,
      target_duration_us INTEGER NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      interrupted INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    )
  `);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_task ON pomodoro_sessions(task_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_type ON pomodoro_sessions(session_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started ON pomodoro_sessions(started_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_completed ON pomodoro_sessions(completed)`);
  
  console.log('Created pomodoro_sessions table');
} catch (error) {
  console.error('Error creating pomodoro_sessions table:', error.message);
}
```

---

## 2. API Endpoints

### 2.1 Settings Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/pomodoro/settings` | Get current settings | - | `PomodoroSettings` |
| PUT | `/api/pomodoro/settings` | Update settings | `UpdatePomodoroSettingsDTO` | `PomodoroSettings` |

**GET /api/pomodoro/settings**:
```javascript
router.get('/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM pomodoro_settings WHERE id = 1').get();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch pomodoro settings' } });
  }
});
```

**PUT /api/pomodoro/settings**:
```javascript
router.put('/settings', (req, res) => {
  try {
    const {
      work_duration_us,
      short_break_duration_us,
      long_break_duration_us,
      sessions_until_long_break,
      auto_start_work,
      auto_start_break,
      notification_sound,
      daily_goal_sessions
    } = req.body;
    
    const now = new Date().toISOString();
    
    db.prepare(`
      UPDATE pomodoro_settings SET
        work_duration_us = COALESCE(?, work_duration_us),
        short_break_duration_us = COALESCE(?, short_break_duration_us),
        long_break_duration_us = COALESCE(?, long_break_duration_us),
        sessions_until_long_break = COALESCE(?, sessions_until_long_break),
        auto_start_work = COALESCE(?, auto_start_work),
        auto_start_break = COALESCE(?, auto_start_break),
        notification_sound = COALESCE(?, notification_sound),
        daily_goal_sessions = COALESCE(?, daily_goal_sessions),
        updated_at = ?
      WHERE id = 1
    `).run(
      work_duration_us, short_break_duration_us, long_break_duration_us,
      sessions_until_long_break, auto_start_work, auto_start_break,
      notification_sound, daily_goal_sessions, now
    );
    
    const settings = db.prepare('SELECT * FROM pomodoro_settings WHERE id = 1').get();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update pomodoro settings' } });
  }
});
```

### 2.2 Session Management Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| POST | `/api/pomodoro/start` | Start new session | `StartPomodoroDTO` | `PomodoroSession` |
| POST | `/api/pomodoro/stop` | Stop current session | - | `PomodoroSession` |
| POST | `/api/pomodoro/complete` | Complete session | - | `PomodoroSession` |
| POST | `/api/pomodoro/skip` | Skip current session | - | `PomodoroSession` |
| GET | `/api/pomodoro/current` | Get current running session | - | `PomodoroSession \| null` |
| GET | `/api/pomodoro/sessions` | List sessions with filters | Query params | `PomodoroSession[]` |
| GET | `/api/pomodoro/sessions/:id` | Get single session | - | `PomodoroSession` |
| DELETE | `/api/pomodoro/sessions/:id` | Delete session | - | `{ message: string }` |

**POST /api/pomodoro/start**:
```javascript
router.post('/start', (req, res) => {
  try {
    const { task_id, session_type } = req.body;
    
    // Check for existing running session
    const runningSession = db.prepare(`
      SELECT * FROM pomodoro_sessions WHERE ended_at IS NULL
    `).get();
    
    if (runningSession) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT_ERROR', message: 'A pomodoro session is already running' }
      });
    }
    
    // Get settings for target duration
    const settings = db.prepare('SELECT * FROM pomodoro_settings WHERE id = 1').get();
    let targetDurationUs;
    switch (session_type) {
      case 'work': targetDurationUs = settings.work_duration_us; break;
      case 'short_break': targetDurationUs = settings.short_break_duration_us; break;
      case 'long_break': targetDurationUs = settings.long_break_duration_us; break;
    }
    
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO pomodoro_sessions (id, task_id, session_type, started_at, target_duration_us)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, task_id || null, session_type, now, targetDurationUs);
    
    const session = db.prepare(`
      SELECT ps.*, t.title as task_title
      FROM pomodoro_sessions ps
      LEFT JOIN tasks t ON ps.task_id = t.id
      WHERE ps.id = ?
    `).get(id);
    
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to start pomodoro session' } });
  }
});
```

**POST /api/pomodoro/stop**:
```javascript
router.post('/stop', (req, res) => {
  try {
    const runningSession = db.prepare(`
      SELECT * FROM pomodoro_sessions WHERE ended_at IS NULL
    `).get();
    
    if (!runningSession) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No running pomodoro session found' }
      });
    }
    
    const now = new Date().toISOString();
    const durationUs = calculateDuration(runningSession.started_at, now);
    
    db.prepare(`
      UPDATE pomodoro_sessions
      SET ended_at = ?, duration_us = ?, interrupted = 1, updated_at = ?
      WHERE id = ?
    `).run(now, durationUs, now, runningSession.id);
    
    const session = db.prepare(`
      SELECT ps.*, t.title as task_title
      FROM pomodoro_sessions ps
      LEFT JOIN tasks t ON ps.task_id = t.id
      WHERE ps.id = ?
    `).get(runningSession.id);
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to stop pomodoro session' } });
  }
});
```

**POST /api/pomodoro/complete**:
```javascript
router.post('/complete', (req, res) => {
  try {
    const runningSession = db.prepare(`
      SELECT * FROM pomodoro_sessions WHERE ended_at IS NULL
    `).get();
    
    if (!runningSession) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No running pomodoro session found' }
      });
    }
    
    const now = new Date().toISOString();
    const durationUs = calculateDuration(runningSession.started_at, now);
    
    db.prepare(`
      UPDATE pomodoro_sessions
      SET ended_at = ?, duration_us = ?, completed = 1, updated_at = ?
      WHERE id = ?
    `).run(now, durationUs, now, runningSession.id);
    
    // If this was a work session, optionally create a time_entry
    if (runningSession.session_type === 'work' && runningSession.task_id) {
      const entryId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO time_entries (id, entity_type, entity_id, start_time, end_time, duration_us, is_running)
        VALUES (?, 'task', ?, ?, ?, ?, 0)
      `).run(entryId, String(runningSession.task_id), runningSession.started_at, now, durationUs);
    }
    
    const session = db.prepare(`
      SELECT ps.*, t.title as task_title
      FROM pomodoro_sessions ps
      LEFT JOIN tasks t ON ps.task_id = t.id
      WHERE ps.id = ?
    `).get(runningSession.id);
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to complete pomodoro session' } });
  }
});
```

**GET /api/pomodoro/current**:
```javascript
router.get('/current', (req, res) => {
  try {
    const session = db.prepare(`
      SELECT ps.*, t.title as task_title
      FROM pomodoro_sessions ps
      LEFT JOIN tasks t ON ps.task_id = t.id
      WHERE ps.ended_at IS NULL
    `).get();
    
    res.json({ success: true, data: session || null });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch current session' } });
  }
});
```

### 2.3 Statistics Endpoints

| Method | Endpoint | Description | Query Params | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/pomodoro/stats/daily` | Daily statistics | `?date=YYYY-MM-DD` | `DailyStats` |
| GET | `/api/pomodoro/stats/task/:taskId` | Task-specific stats | - | `TaskPomodoroStats` |
| GET | `/api/pomodoro/stats/summary` | Overall summary | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | `PomodoroSummary` |

**GET /api/pomodoro/stats/daily**:
```javascript
router.get('/stats/daily', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_sessions,
        SUM(CASE WHEN session_type = 'work' AND completed = 1 THEN 1 ELSE 0 END) as work_sessions,
        SUM(CASE WHEN session_type = 'work' THEN duration_us ELSE 0 END) as total_work_us,
        SUM(CASE WHEN session_type = 'work' AND completed = 1 THEN duration_us ELSE 0 END) as completed_work_us
      FROM pomodoro_sessions
      WHERE date(started_at) = ?
    `).get(targetDate);
    
    const settings = db.prepare('SELECT daily_goal_sessions FROM pomodoro_settings WHERE id = 1').get();
    
    res.json({
      success: true,
      data: {
        date: targetDate,
        ...stats,
        daily_goal: settings.daily_goal_sessions,
        goal_progress: stats.work_sessions / settings.daily_goal_sessions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch daily stats' } });
  }
});
```

---

## 3. TypeScript Types

Add to [`client/src/types/index.ts`](client/src/types/index.ts):

```typescript
// ==================== v2.4.0 Pomodoro Timer ====================

// Pomodoro Session Type
export type PomodoroSessionType = 'work' | 'short_break' | 'long_break';

// Pomodoro Timer State
export type PomodoroTimerState = 'idle' | 'running' | 'paused';

// Pomodoro Settings Interface
export interface PomodoroSettings {
  id: number;
  work_duration_us: number;
  short_break_duration_us: number;
  long_break_duration_us: number;
  sessions_until_long_break: number;
  auto_start_work: boolean;
  auto_start_break: boolean;
  notification_sound: boolean;
  daily_goal_sessions: number;
  created_at: string;
  updated_at: string;
}

// Pomodoro Session Interface
export interface PomodoroSession {
  id: string;
  task_id: number | null;
  task_title?: string;
  session_type: PomodoroSessionType;
  started_at: string;
  ended_at: string | null;
  duration_us: number | null;
  target_duration_us: number;
  completed: boolean;
  interrupted: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Pomodoro State Interface (for context)
export interface PomodoroState {
  timerState: PomodoroTimerState;
  currentSession: PomodoroSession | null;
  currentSessionType: PomodoroSessionType;
  completedWorkSessions: number;  // Count towards long break
  timeRemainingUs: number;        // Time remaining in current session
  settings: PomodoroSettings | null;
}

// Start Pomodoro DTO
export interface StartPomodoroDTO {
  task_id?: number | null;
  session_type: PomodoroSessionType;
}

// Update Pomodoro Settings DTO
export interface UpdatePomodoroSettingsDTO {
  work_duration_us?: number;
  short_break_duration_us?: number;
  long_break_duration_us?: number;
  sessions_until_long_break?: number;
  auto_start_work?: boolean;
  auto_start_break?: boolean;
  notification_sound?: boolean;
  daily_goal_sessions?: number;
}

// Daily Pomodoro Stats
export interface DailyPomodoroStats {
  date: string;
  total_sessions: number;
  completed_sessions: number;
  work_sessions: number;
  total_work_us: number;
  completed_work_us: number;
  daily_goal: number;
  goal_progress: number;
}

// Task Pomodoro Stats
export interface TaskPomodoroStats {
  task_id: number;
  total_sessions: number;
  completed_sessions: number;
  total_work_us: number;
  avg_session_us: number;
}

// Pomodoro Summary
export interface PomodoroSummary {
  total_sessions: number;
  completed_sessions: number;
  total_work_us: number;
  total_break_us: number;
  avg_daily_sessions: number;
  most_productive_day: string | null;
}

// Pomodoro Session Config (for UI display)
export const POMODORO_SESSION_CONFIG: Record<PomodoroSessionType, { label: string; color: string }> = {
  work: { label: 'Work', color: '#ef4444' },
  short_break: { label: 'Short Break', color: '#22c55e' },
  long_break: { label: 'Long Break', color: '#3b82f6' },
};
```

---

## 4. API Service Functions

Add to [`client/src/services/api.ts`](client/src/services/api.ts):

```typescript
// ==================== Pomodoro API ====================

// Settings
export async function getPomodoroSettings(): Promise<PomodoroSettings> {
  const response = await fetch('/api/pomodoro/settings');
  return handleResponse<PomodoroSettings>(response);
}

export async function updatePomodoroSettings(data: UpdatePomodoroSettingsDTO): Promise<PomodoroSettings> {
  const response = await fetch('/api/pomodoro/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<PomodoroSettings>(response);
}

// Session Management
export async function startPomodoroSession(data: StartPomodoroDTO): Promise<PomodoroSession> {
  const response = await fetch('/api/pomodoro/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<PomodoroSession>(response);
}

export async function stopPomodoroSession(): Promise<PomodoroSession> {
  const response = await fetch('/api/pomodoro/stop', {
    method: 'POST',
  });
  return handleResponse<PomodoroSession>(response);
}

export async function completePomodoroSession(): Promise<PomodoroSession> {
  const response = await fetch('/api/pomodoro/complete', {
    method: 'POST',
  });
  return handleResponse<PomodoroSession>(response);
}

export async function skipPomodoroSession(): Promise<PomodoroSession> {
  const response = await fetch('/api/pomodoro/skip', {
    method: 'POST',
  });
  return handleResponse<PomodoroSession>(response);
}

export async function getCurrentPomodoroSession(): Promise<PomodoroSession | null> {
  const response = await fetch('/api/pomodoro/current');
  return handleResponse<PomodoroSession | null>(response);
}

export async function getPomodoroSessions(params?: {
  task_id?: number;
  session_type?: PomodoroSessionType;
  from_date?: string;
  to_date?: string;
  completed?: boolean;
}): Promise<PomodoroSession[]> {
  const queryString = params ? buildQueryString(params) : '';
  const response = await fetch(`/api/pomodoro/sessions${queryString}`);
  return handleResponse<PomodoroSession[]>(response);
}

export async function getPomodoroSession(id: string): Promise<PomodoroSession> {
  const response = await fetch(`/api/pomodoro/sessions/${id}`);
  return handleResponse<PomodoroSession>(response);
}

export async function deletePomodoroSession(id: string): Promise<void> {
  const response = await fetch(`/api/pomodoro/sessions/${id}`, {
    method: 'DELETE',
  });
  handleResponse(response);
}

// Statistics
export async function getDailyPomodoroStats(date?: string): Promise<DailyPomodoroStats> {
  const queryString = date ? `?date=${date}` : '';
  const response = await fetch(`/api/pomodoro/stats/daily${queryString}`);
  return handleResponse<DailyPomodoroStats>(response);
}

export async function getTaskPomodoroStats(taskId: number): Promise<TaskPomodoroStats> {
  const response = await fetch(`/api/pomodoro/stats/task/${taskId}`);
  return handleResponse<TaskPomodoroStats>(response);
}

export async function getPomodoroSummary(from?: string, to?: string): Promise<PomodoroSummary> {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`/api/pomodoro/stats/summary${queryString}`);
  return handleResponse<PomodoroSummary>(response);
}
```

---

## 5. Context Interface Definition

Create [`client/src/context/PomodoroContext.tsx`](client/src/context/PomodoroContext.tsx):

```typescript
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type {
  PomodoroSettings,
  PomodoroSession,
  PomodoroState,
  PomodoroSessionType,
  StartPomodoroDTO,
  UpdatePomodoroSettingsDTO,
  DailyPomodoroStats,
} from '../types';
import * as api from '../services/api';
import { useToast } from './ToastContext';

interface PomodoroContextType {
  // State
  settings: PomodoroSettings | null;
  currentSession: PomodoroSession | null;
  timerState: 'idle' | 'running' | 'paused';
  timeRemainingUs: number;
  completedWorkSessions: number;
  timerTick: number;
  loading: boolean;
  error: string | null;
  
  // Actions - Settings
  fetchSettings: () => Promise<void>;
  updateSettings: (data: UpdatePomodoroSettingsDTO) => Promise<void>;
  
  // Actions - Timer
  startSession: (sessionType: PomodoroSessionType, taskId?: number) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => Promise<void>;
  completeSession: () => Promise<void>;
  skipSession: () => Promise<void>;
  
  // Actions - Session Management
  fetchCurrentSession: () => Promise<void>;
  
  // Actions - Statistics
  getDailyStats: (date?: string) => Promise<DailyPomodoroStats>;
  
  // Helpers
  getNextSessionType: () => PomodoroSessionType;
  getTimeRemainingFormatted: () => string;
  isTimerRunning: () => boolean;
  clearError: () => void;
}

const PomodoroContext = createContext<PomodoroContextType | undefined>(undefined);

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  
  // State
  const [settings, setSettings] = useState<PomodoroSettings | null>(null);
  const [currentSession, setCurrentSession] = useState<PomodoroSession | null>(null);
  const [timerState, setTimerState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [timeRemainingUs, setTimeRemainingUs] = useState(0);
  const [completedWorkSessions, setCompletedWorkSessions] = useState(0);
  const [timerTick, setTimerTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pause state storage
  const pausedTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Implementation details...
  // (Full implementation would be in the actual file)
  
  const value: PomodoroContextType = {
    settings,
    currentSession,
    timerState,
    timeRemainingUs,
    completedWorkSessions,
    timerTick,
    loading,
    error,
    fetchSettings,
    updateSettings,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    completeSession,
    skipSession,
    fetchCurrentSession,
    getDailyStats,
    getNextSessionType,
    getTimeRemainingFormatted,
    isTimerRunning,
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
```

---

## 6. Component Hierarchy

### 6.1 Component Structure

```
client/src/components/pomodoro/
├── PomodoroTimer.tsx       # Main timer display and controls
├── PomodoroControls.tsx    # Play/Pause/Stop/Skip buttons
├── PomodoroSettings.tsx    # Settings configuration modal
├── PomodoroWidget.tsx      # Compact header/sidebar widget
├── PomodoroProgress.tsx    # Circular progress indicator
├── PomodoroSessionList.tsx # Session history list
├── PomodoroStats.tsx       # Statistics dashboard card
└── PomodoroTaskButton.tsx  # Start pomodoro button for task cards
```

### 6.2 Component Props

**PomodoroTimer.tsx**:
```typescript
interface PomodoroTimerProps {
  compact?: boolean;           // Minimal display mode
  showControls?: boolean;      // Show play/pause/stop buttons
  showSessionCount?: boolean;  // Show completed work sessions
  onSessionComplete?: (session: PomodoroSession) => void;
}
```

**PomodoroWidget.tsx**:
```typescript
interface PomodoroWidgetProps {
  variant: 'header' | 'sidebar';  // Display context
  collapsed?: boolean;            // Show only icon + time
}
```

**PomodoroSettings.tsx**:
```typescript
interface PomodoroSettingsProps {
  open: boolean;
  onClose: () => void;
}
```

**PomodoroTaskButton.tsx**:
```typescript
interface PomodoroTaskButtonProps {
  taskId: number;
  compact?: boolean;           // Just show tomato icon
  showSessionCount?: boolean;  // Show completed sessions for task
}
```

### 6.3 Component Integration Points

#### TaskCard Integration (Kanban View)

In [`client/src/components/kanban/TaskCard.tsx`](client/src/components/kanban/TaskCard.tsx):

```typescript
// Add to imports
import { PomodoroTaskButton } from '../pomodoro/PomodoroTaskButton';

// Add to meta info section (after timer button, around line 288)
{/* Pomodoro button */}
<PomodoroTaskButton 
  taskId={task.id} 
  compact 
  showSessionCount 
/>
```

#### TaskRow Integration (List View)

In [`client/src/components/list/TaskRow.tsx`](client/src/components/list/TaskRow.tsx):

```typescript
// Add PomodoroTaskButton in actions column
<td className="px-2 py-3">
  <div className="flex items-center gap-2">
    {/* Existing timer button */}
    <TimerButton entityType="task" entityId={task.id} />
    {/* Add Pomodoro button */}
    <PomodoroTaskButton taskId={task.id} compact />
  </div>
</td>
```

#### TaskForm Integration

In [`client/src/components/common/TaskForm.tsx`](client/src/components/common/TaskForm.tsx):

```typescript
// Add field for estimated pomodoros
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
    Estimated Pomodoros
  </label>
  <input
    type="number"
    min="1"
    value={formData.estimated_pomodoros || ''}
    onChange={(e) => setFormData({ ...formData, estimated_pomodoros: parseInt(e.target.value) || undefined })}
    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md"
    placeholder="e.g., 4"
  />
</div>
```

**Note**: This requires adding `estimated_pomodoros` column to tasks table as an optional enhancement.

#### Header Widget

In [`client/src/components/layout/Header.tsx`](client/src/components/layout/Header.tsx):

```typescript
import { PomodoroWidget } from '../pomodoro/PomodoroWidget';

// Add after breadcrumbs, before theme toggle
<div className="flex items-center gap-4">
  <PomodoroWidget variant="header" />
  {/* Existing theme toggle, etc. */}
</div>
```

#### Sidebar Widget

In [`client/src/components/layout/Sidebar.tsx`](client/src/components/layout/Sidebar.tsx):

```typescript
import { PomodoroWidget } from '../pomodoro/PomodoroWidget';

// Add after views list, before project tree
<nav className="p-4 space-y-2">
  {/* Existing view buttons */}
</nav>
<div className="px-4 py-2">
  <PomodoroWidget variant="sidebar" />
</div>
```

---

## 7. Timer State Machine

### 7.1 State Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         POMODORO STATE MACHINE                       │
└─────────────────────────────────────────────────────────────────────┘

                              ┌─────────┐
                              │  IDLE   │
                              └────┬────┘
                                   │
                         startSession(work)
                                   │
                                   ▼
                         ┌─────────────────┐
              ┌─────────►│  WORK_RUNNING   │◄─────────┐
              │          └────────┬────────┘          │
              │                   │                   │
              │          [completed]                  │
              │     sessions < max_sessions           │
              │                   │                   │
              │                   ▼                   │
              │          ┌─────────────────┐          │
              │          │ SHORT_BREAK_RUN │          │
              │          └────────┬────────┘          │
              │                   │                   │
              │          [completed]                  │
              │                   │                   │
              └───────────────────┴───────────────────┘
                                   │
                      sessions >= max_sessions
                                   │
                                   ▼
                         ┌─────────────────┐
                         │ LONG_BREAK_RUN  │
                         └────────┬────────┘
                                   │
                          [completed]
                                   │
                                   ▼
                         Reset session count
                                   │
                              ┌─────────┐
                              │  IDLE   │
                              └─────────┘

                  ┌─────────────────────────────┐
                  │     ANY RUNNING STATE       │
                  └──────────────┬──────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
               [pause]      [stop]       [skip]
                    │            │            │
                    ▼            ▼            ▼
              ┌─────────┐  ┌────────┐   ┌────────┐
              │ PAUSED  │  │ IDLE   │   │ IDLE   │
              └────┬────┘  │(recorded)│  │(recorded)│
                   │       └────────┘   └────────┘
              [resume]
                   │
                   ▼
              Original State
```

### 7.2 State Transitions Table

| Current State | Event | Next State | Action |
|--------------|-------|------------|--------|
| `idle` | `start(work)` | `work_running` | Create session, start timer |
| `idle` | `start(short_break)` | `short_break_running` | Create session, start timer |
| `idle` | `start(long_break)` | `long_break_running` | Create session, start timer |
| `*_running` | `pause` | `*_paused` | Store remaining time |
| `*_paused` | `resume` | `*_running` | Resume with stored time |
| `*_running` | `stop` | `idle` | Mark interrupted, save session |
| `*_running` | `complete` | `idle` or `next` | Mark completed, start next or idle |
| `*_running` | `skip` | `idle` or `next` | Mark skipped, start next or idle |
| `work_running` | `complete` (count < max) | `short_break_running` | Increment count, start short break |
| `work_running` | `complete` (count >= max) | `long_break_running` | Reset count, start long break |
| `*_break_running` | `complete` | `idle` or `work_running` | If auto_start: start work, else idle |

### 7.3 Session Flow Logic

```typescript
function getNextSessionType(): PomodoroSessionType {
  if (!currentSession) return 'work';
  
  if (currentSession.session_type === 'work') {
    // Check if long break is due
    if (completedWorkSessions >= settings.sessions_until_long_break) {
      return 'long_break';
    }
    return 'short_break';
  }
  
  // After break, always work
  return 'work';
}

function handleSessionComplete(): void {
  if (currentSession.session_type === 'work') {
    const newCount = completedWorkSessions + 1;
    setCompletedWorkSessions(newCount);
    
    // Determine next break type
    const nextType = newCount >= settings.sessions_until_long_break 
      ? 'long_break' 
      : 'short_break';
    
    if (nextType === 'long_break') {
      setCompletedWorkSessions(0); // Reset counter
    }
    
    // Auto-start break if enabled
    if (settings.auto_start_break) {
      startSession(nextType, currentSession.task_id);
    }
  } else {
    // After break
    if (settings.auto_start_work) {
      startSession('work');
    }
  }
}
```

---

## 8. Keyboard Shortcuts

Add to existing keyboard shortcuts in [`client/src/context/ShortcutContext.tsx`](client/src/context/ShortcutContext.tsx):

| Key | Action | Category |
|-----|--------|----------|
| `t` | Toggle Pomodoro timer | Pomodoro |
| `Shift+T` | Start Pomodoro for current task | Pomodoro |
| `Ctrl/Cmd+Shift+P` | Open Pomodoro settings | Pomodoro |

Add to keyboard shortcut help:

```typescript
// In ShortcutContext or ShortcutHelp component
const pomodoroShortcuts: ShortcutConfig[] = [
  {
    id: 'pomodoro-toggle',
    key: 't',
    description: 'Toggle Pomodoro timer',
    action: () => {
      if (isTimerRunning()) {
        pauseSession();
      } else if (currentSession) {
        resumeSession();
      } else {
        startSession('work');
      }
    },
    category: 'Pomodoro',
  },
  {
    id: 'pomodoro-start-task',
    key: 'T', // Shift+T
    shiftKey: true,
    description: 'Start Pomodoro for selected task',
    action: () => {
      if (selectedTaskId) {
        startSession('work', selectedTaskId);
      }
    },
    category: 'Pomodoro',
    enabled: !!selectedTaskId,
  },
];
```

---

## 9. Import/Export Integration

Add pomodoro data to the existing import/export system.

### 9.1 Export Payload Addition

```typescript
// In server/routes/importExport.js export endpoint
data: {
  // ... existing tables
  pomodoro_settings: [...],
  pomodoro_sessions: [...],
}
```

### 9.2 Import Order

Add to table import order (after time_entries):

```
13. pomodoro_settings (single row, upsert)
14. pomodoro_sessions
```

---

## 10. Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Add `pomodoro_settings` table to [`server/db/schema.js`](server/db/schema.js)
- [ ] Add `pomodoro_sessions` table to [`server/db/schema.js`](server/db/schema.js)
- [ ] Create [`server/routes/pomodoro.js`](server/routes/pomodoro.js) with all endpoints
- [ ] Register pomodoro router in [`server/index.js`](server/index.js)
- [ ] Test API endpoints with curl/Postman

### Phase 2: Frontend Types & API
- [ ] Add Pomodoro types to [`client/src/types/index.ts`](client/src/types/index.ts)
- [ ] Add Pomodoro API functions to [`client/src/services/api.ts`](client/src/services/api.ts)
- [ ] Create [`client/src/context/PomodoroContext.tsx`](client/src/context/PomodoroContext.tsx)
- [ ] Add PomodoroProvider to [`client/src/app/providers.tsx`](client/src/app/providers.tsx)

### Phase 3: Core Components
- [ ] Create [`client/src/components/pomodoro/PomodoroProgress.tsx`](client/src/components/pomodoro/PomodoroProgress.tsx)
- [ ] Create [`client/src/components/pomodoro/PomodoroControls.tsx`](client/src/components/pomodoro/PomodoroControls.tsx)
- [ ] Create [`client/src/components/pomodoro/PomodoroTimer.tsx`](client/src/components/pomodoro/PomodoroTimer.tsx)
- [ ] Create [`client/src/components/pomodoro/PomodoroWidget.tsx`](client/src/components/pomodoro/PomodoroWidget.tsx)
- [ ] Create [`client/src/components/pomodoro/PomodoroSettings.tsx`](client/src/components/pomodoro/PomodoroSettings.tsx)

### Phase 4: Task Integration
- [ ] Create [`client/src/components/pomodoro/PomodoroTaskButton.tsx`](client/src/components/pomodoro/PomodoroTaskButton.tsx)
- [ ] Integrate PomodoroTaskButton into [`TaskCard.tsx`](client/src/components/kanban/TaskCard.tsx)
- [ ] Integrate PomodoroTaskButton into [`TaskRow.tsx`](client/src/components/list/TaskRow.tsx)
- [ ] (Optional) Add estimated_pomodoros field to TaskForm

### Phase 5: Layout Integration
- [ ] Add PomodoroWidget to [`Header.tsx`](client/src/components/layout/Header.tsx)
- [ ] Add PomodoroWidget to [`Sidebar.tsx`](client/src/components/layout/Sidebar.tsx)

### Phase 6: Statistics & History
- [ ] Create [`client/src/components/pomodoro/PomodoroSessionList.tsx`](client/src/components/pomodoro/PomodoroSessionList.tsx)
- [ ] Create [`client/src/components/pomodoro/PomodoroStats.tsx`](client/src/components/pomodoro/PomodoroStats.tsx)
- [ ] Add Pomodoro stats to DashboardView

### Phase 7: Polish
- [ ] Add keyboard shortcuts to ShortcutContext
- [ ] Add Pomodoro section to ShortcutHelp
- [ ] Add import/export support for pomodoro data
- [ ] Update AGENTS.md with v2.4.0 documentation
- [ ] Test full flow end-to-end

---

## 11. File Summary

### New Files to Create

| Path | Description |
|------|-------------|
| `server/routes/pomodoro.js` | Pomodoro API routes |
| `client/src/context/PomodoroContext.tsx` | Pomodoro state management |
| `client/src/components/pomodoro/PomodoroTimer.tsx` | Main timer component |
| `client/src/components/pomodoro/PomodoroControls.tsx` | Timer control buttons |
| `client/src/components/pomodoro/PomodoroSettings.tsx` | Settings modal |
| `client/src/components/pomodoro/PomodoroWidget.tsx` | Header/sidebar widget |
| `client/src/components/pomodoro/PomodoroProgress.tsx` | Circular progress |
| `client/src/components/pomodoro/PomodoroSessionList.tsx` | Session history |
| `client/src/components/pomodoro/PomodoroStats.tsx` | Statistics card |
| `client/src/components/pomodoro/PomodoroTaskButton.tsx` | Task card button |
| `client/src/components/pomodoro/index.ts` | Barrel export |

### Files to Modify

| Path | Changes |
|------|---------|
| `server/db/schema.js` | Add pomodoro tables |
| `server/index.js` | Register pomodoro router |
| `server/routes/importExport.js` | Add pomodoro to export/import |
| `client/src/types/index.ts` | Add Pomodoro types |
| `client/src/services/api.ts` | Add Pomodoro API functions |
| `client/src/app/providers.tsx` | Add PomodoroProvider |
| `client/src/components/kanban/TaskCard.tsx` | Add PomodoroTaskButton |
| `client/src/components/list/TaskRow.tsx` | Add PomodoroTaskButton |
| `client/src/components/layout/Header.tsx` | Add PomodoroWidget |
| `client/src/components/layout/Sidebar.tsx` | Add PomodoroWidget |
| `client/src/context/ShortcutContext.tsx` | Add Pomodoro shortcuts |
| `AGENTS.md` | Document v2.4.0 changes |

---

## 12. Design Considerations

### 12.1 Relationship with Time Entries

- Completed work sessions can optionally create time_entries records
- This provides integration with existing time tracking
- User can see Pomodoro time in task time summaries

### 12.2 Browser Notifications

```typescript
// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Show notification on session complete
function showNotification(sessionType: PomodoroSessionType) {
  if (Notification.permission === 'granted' && settings?.notification_sound) {
    new Notification(`${sessionType} complete!`, {
      body: sessionType === 'work' ? 'Time for a break!' : 'Ready to work?',
      icon: '/icon.svg',
    });
  }
}
```

### 12.3 Page Visibility Handling

```typescript
// Handle tab visibility for accurate timing
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden && timerState === 'running') {
      // Store timestamp when tab becomes hidden
      sessionStorage.setItem('pomodoro_hidden_at', Date.now().toString());
    } else if (!document.hidden && timerState === 'running') {
      // Calculate elapsed time while hidden
      const hiddenAt = sessionStorage.getItem('pomodoro_hidden_at');
      if (hiddenAt) {
        const elapsed = Date.now() - parseInt(hiddenAt);
        setTimeRemainingUs(prev => Math.max(0, prev - elapsed * 1000));
        sessionStorage.removeItem('pomodoro_hidden_at');
      }
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [timerState]);
```

### 12.4 Persistence Strategy

- Timer state persists across page reloads via:
  1. Current session stored in database (ended_at IS NULL)
  2. On mount, fetch current session and calculate remaining time
  3. If session should have ended, mark as interrupted

```typescript
useEffect(() => {
  const initPomodoro = async () => {
    const session = await getCurrentPomodoroSession();
    if (session) {
      const elapsed = Date.now() - new Date(session.started_at).getTime();
      const remaining = session.target_duration_us - (elapsed * 1000);
      
      if (remaining > 0) {
        setCurrentSession(session);
        setTimeRemainingUs(remaining);
        setTimerState('running');
      } else {
        // Session expired while away
        await stopPomodoroSession();
      }
    }
  };
  initPomodoro();
}, []);
```

---

This architecture design provides a comprehensive blueprint for implementing the Pomodoro feature while maintaining consistency with the existing Celestask codebase patterns.
