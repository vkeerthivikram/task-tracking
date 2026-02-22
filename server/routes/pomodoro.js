/**
 * Pomodoro Timer API Routes
 * 
 * Endpoints:
 * - GET    /api/pomodoro/settings    - Get settings (create default if not exists)
 * - PUT    /api/pomodoro/settings    - Update settings
 * - GET    /api/pomodoro/current     - Get current running/paused session
 * - POST   /api/pomodoro/start       - Start a new session
 * - POST   /api/pomodoro/pause       - Pause current session
 * - POST   /api/pomodoro/resume      - Resume paused session
 * - POST   /api/pomodoro/stop        - Stop and discard current session
 * - POST   /api/pomodoro/complete    - Complete current session
 * - POST   /api/pomodoro/skip        - Skip current break
 * - GET    /api/pomodoro/sessions    - Get session history
 * - GET    /api/pomodoro/stats       - Get daily stats
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');

// ==================== HELPER FUNCTIONS ====================

/**
 * Get current timestamp in ISO format
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Calculate elapsed time in microseconds from started_at to now (or paused_at)
 */
function calculateElapsedUs(startedAt, pausedAt = null) {
  const startTime = new Date(startedAt).getTime();
  const endTime = pausedAt ? new Date(pausedAt).getTime() : Date.now();
  return (endTime - startTime) * 1000; // Convert ms to microseconds
}

/**
 * Get the current active session (running or paused)
 */
function getCurrentSession() {
  const session = db.prepare(`
    SELECT * FROM pomodoro_sessions 
    WHERE timer_state IN ('running', 'paused')
    ORDER BY created_at DESC
    LIMIT 1
  `).get();
  return session || null;
}

/**
 * Get settings, creating default if not exists
 */
function getOrCreateSettings() {
  let settings = db.prepare(`SELECT * FROM pomodoro_settings WHERE id = 'default'`).get();
  
  if (!settings) {
    db.prepare(`INSERT INTO pomodoro_settings (id) VALUES ('default')`).run();
    settings = db.prepare(`SELECT * FROM pomodoro_settings WHERE id = 'default'`).get();
  }
  
  return settings;
}

// ==================== SETTINGS ENDPOINTS ====================

/**
 * GET /api/pomodoro/settings
 * Get Pomodoro settings (creates default if not exists)
 */
router.get('/settings', (req, res) => {
  try {
    const settings = getOrCreateSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching pomodoro settings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch pomodoro settings' }
    });
  }
});

/**
 * PUT /api/pomodoro/settings
 * Update Pomodoro settings
 */
router.put('/settings', (req, res) => {
  try {
    const {
      work_duration_us,
      short_break_us,
      long_break_us,
      sessions_until_long_break,
      auto_start_breaks,
      auto_start_work,
      notifications_enabled,
      daily_goal
    } = req.body;

    // Ensure settings exist
    getOrCreateSettings();

    // Build dynamic update query
    const updates = [];
    const values = {};

    if (work_duration_us !== undefined) {
      updates.push('work_duration_us = @work_duration_us');
      values.work_duration_us = work_duration_us;
    }
    if (short_break_us !== undefined) {
      updates.push('short_break_us = @short_break_us');
      values.short_break_us = short_break_us;
    }
    if (long_break_us !== undefined) {
      updates.push('long_break_us = @long_break_us');
      values.long_break_us = long_break_us;
    }
    if (sessions_until_long_break !== undefined) {
      updates.push('sessions_until_long_break = @sessions_until_long_break');
      values.sessions_until_long_break = sessions_until_long_break;
    }
    if (auto_start_breaks !== undefined) {
      updates.push('auto_start_breaks = @auto_start_breaks');
      values.auto_start_breaks = auto_start_breaks ? 1 : 0;
    }
    if (auto_start_work !== undefined) {
      updates.push('auto_start_work = @auto_start_work');
      values.auto_start_work = auto_start_work ? 1 : 0;
    }
    if (notifications_enabled !== undefined) {
      updates.push('notifications_enabled = @notifications_enabled');
      values.notifications_enabled = notifications_enabled ? 1 : 0;
    }
    if (daily_goal !== undefined) {
      updates.push('daily_goal = @daily_goal');
      values.daily_goal = daily_goal;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No fields provided to update' }
      });
    }

    updates.push("updated_at = datetime('now')");
    
    const sql = `UPDATE pomodoro_settings SET ${updates.join(', ')} WHERE id = 'default'`;
    db.prepare(sql).run(values);

    const updatedSettings = db.prepare(`SELECT * FROM pomodoro_settings WHERE id = 'default'`).get();
    res.json({ success: true, data: updatedSettings });
  } catch (error) {
    console.error('Error updating pomodoro settings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to update pomodoro settings' }
    });
  }
});

// ==================== SESSION ENDPOINTS ====================

/**
 * GET /api/pomodoro/current
 * Get the current active session (running or paused)
 */
router.get('/current', (req, res) => {
  try {
    const session = getCurrentSession();
    
    if (session) {
      // Calculate current elapsed time if running
      if (session.timer_state === 'running') {
        const additionalElapsed = calculateElapsedUs(session.started_at);
        session.current_elapsed_us = session.elapsed_us + additionalElapsed;
      } else {
        session.current_elapsed_us = session.elapsed_us;
      }
    }
    
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching current session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch current session' }
    });
  }
});

/**
 * POST /api/pomodoro/start
 * Start a new Pomodoro session
 * Body: { task_id?: number, session_type?: 'work' | 'short_break' | 'long_break' }
 */
router.post('/start', (req, res) => {
  try {
    const { task_id, session_type = 'work' } = req.body;
    
    // Check if there's already an active session
    const currentSession = getCurrentSession();
    if (currentSession) {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT_ERROR', message: 'A session is already in progress. Stop or complete it first.' }
      });
    }

    // Validate session_type
    const validTypes = ['work', 'short_break', 'long_break'];
    if (!validTypes.includes(session_type)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid session_type. Must be work, short_break, or long_break' }
      });
    }

    // Get settings to determine duration
    const settings = getOrCreateSettings();
    let duration_us;
    switch (session_type) {
      case 'work':
        duration_us = settings.work_duration_us;
        break;
      case 'short_break':
        duration_us = settings.short_break_us;
        break;
      case 'long_break':
        duration_us = settings.long_break_us;
        break;
    }

    const id = crypto.randomUUID();
    const now = getCurrentTimestamp();

    const result = db.prepare(`
      INSERT INTO pomodoro_sessions (
        id, task_id, session_type, timer_state, duration_us, elapsed_us,
        started_at, completed, interrupted, created_at, updated_at
      ) VALUES (?, ?, ?, 'running', ?, 0, ?, 0, 0, ?, ?)
    `).run(id, task_id || null, session_type, duration_us, now, now, now);

    const newSession = db.prepare(`SELECT * FROM pomodoro_sessions WHERE id = ?`).get(id);
    newSession.current_elapsed_us = 0;
    
    res.json({ success: true, data: newSession });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to start session' }
    });
  }
});

/**
 * POST /api/pomodoro/pause
 * Pause the current running session
 */
router.post('/pause', (req, res) => {
  try {
    const currentSession = getCurrentSession();
    
    if (!currentSession) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active session to pause' }
      });
    }

    if (currentSession.timer_state !== 'running') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Session is not running' }
      });
    }

    const now = getCurrentTimestamp();
    const additionalElapsed = calculateElapsedUs(currentSession.started_at);
    const totalElapsed = currentSession.elapsed_us + additionalElapsed;

    db.prepare(`
      UPDATE pomodoro_sessions 
      SET timer_state = 'paused', 
          elapsed_us = ?, 
          paused_at = ?, 
          updated_at = datetime('now')
      WHERE id = ?
    `).run(totalElapsed, now, currentSession.id);

    const updatedSession = db.prepare(`SELECT * FROM pomodoro_sessions WHERE id = ?`).get(currentSession.id);
    updatedSession.current_elapsed_us = totalElapsed;
    
    res.json({ success: true, data: updatedSession });
  } catch (error) {
    console.error('Error pausing session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to pause session' }
    });
  }
});

/**
 * POST /api/pomodoro/resume
 * Resume a paused session
 */
router.post('/resume', (req, res) => {
  try {
    const currentSession = getCurrentSession();
    
    if (!currentSession) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No session to resume' }
      });
    }

    if (currentSession.timer_state !== 'paused') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Session is not paused' }
      });
    }

    const now = getCurrentTimestamp();

    db.prepare(`
      UPDATE pomodoro_sessions 
      SET timer_state = 'running', 
          started_at = ?, 
          paused_at = NULL, 
          updated_at = datetime('now')
      WHERE id = ?
    `).run(now, currentSession.id);

    const updatedSession = db.prepare(`SELECT * FROM pomodoro_sessions WHERE id = ?`).get(currentSession.id);
    updatedSession.current_elapsed_us = currentSession.elapsed_us;
    
    res.json({ success: true, data: updatedSession });
  } catch (error) {
    console.error('Error resuming session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to resume session' }
    });
  }
});

/**
 * POST /api/pomodoro/stop
 * Stop and discard the current session (marks as interrupted)
 */
router.post('/stop', (req, res) => {
  try {
    const currentSession = getCurrentSession();
    
    if (!currentSession) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active session to stop' }
      });
    }

    const now = getCurrentTimestamp();
    
    // Calculate final elapsed time if running
    let finalElapsed = currentSession.elapsed_us;
    if (currentSession.timer_state === 'running') {
      finalElapsed += calculateElapsedUs(currentSession.started_at);
    }

    db.prepare(`
      UPDATE pomodoro_sessions 
      SET timer_state = 'idle', 
          elapsed_us = ?, 
          ended_at = ?, 
          interrupted = 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(finalElapsed, now, currentSession.id);

    const updatedSession = db.prepare(`SELECT * FROM pomodoro_sessions WHERE id = ?`).get(currentSession.id);
    updatedSession.current_elapsed_us = finalElapsed;
    
    res.json({ success: true, data: updatedSession });
  } catch (error) {
    console.error('Error stopping session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to stop session' }
    });
  }
});

/**
 * POST /api/pomodoro/complete
 * Complete the current session successfully
 */
router.post('/complete', (req, res) => {
  try {
    const currentSession = getCurrentSession();
    
    if (!currentSession) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active session to complete' }
      });
    }

    const now = getCurrentTimestamp();
    
    // Calculate final elapsed time if running
    let finalElapsed = currentSession.elapsed_us;
    if (currentSession.timer_state === 'running') {
      finalElapsed += calculateElapsedUs(currentSession.started_at);
    }

    db.prepare(`
      UPDATE pomodoro_sessions 
      SET timer_state = 'idle', 
          elapsed_us = ?, 
          ended_at = ?, 
          completed = 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(finalElapsed, now, currentSession.id);

    const updatedSession = db.prepare(`SELECT * FROM pomodoro_sessions WHERE id = ?`).get(currentSession.id);
    updatedSession.current_elapsed_us = finalElapsed;
    
    res.json({ success: true, data: updatedSession });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to complete session' }
    });
  }
});

/**
 * POST /api/pomodoro/skip
 * Skip the current break session (marks as interrupted)
 */
router.post('/skip', (req, res) => {
  try {
    const currentSession = getCurrentSession();
    
    if (!currentSession) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No active session to skip' }
      });
    }

    if (currentSession.session_type === 'work') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Cannot skip work sessions. Use stop instead.' }
      });
    }

    const now = getCurrentTimestamp();
    
    // Calculate final elapsed time if running
    let finalElapsed = currentSession.elapsed_us;
    if (currentSession.timer_state === 'running') {
      finalElapsed += calculateElapsedUs(currentSession.started_at);
    }

    db.prepare(`
      UPDATE pomodoro_sessions 
      SET timer_state = 'idle', 
          elapsed_us = ?, 
          ended_at = ?, 
          interrupted = 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(finalElapsed, now, currentSession.id);

    const updatedSession = db.prepare(`SELECT * FROM pomodoro_sessions WHERE id = ?`).get(currentSession.id);
    updatedSession.current_elapsed_us = finalElapsed;
    
    res.json({ success: true, data: updatedSession });
  } catch (error) {
    console.error('Error skipping session:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to skip session' }
    });
  }
});

/**
 * GET /api/pomodoro/sessions
 * Get session history
 * Query params: task_id?, date?, limit?
 */
router.get('/sessions', (req, res) => {
  try {
    const { task_id, date, limit = 50 } = req.query;
    
    let sql = `SELECT * FROM pomodoro_sessions WHERE 1=1`;
    const params = [];
    
    if (task_id) {
      sql += ` AND task_id = ?`;
      params.push(task_id);
    }
    
    if (date) {
      sql += ` AND DATE(started_at) = ?`;
      params.push(date);
    }
    
    sql += ` ORDER BY started_at DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    const sessions = db.prepare(sql).all(...params);
    
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch sessions' }
    });
  }
});

/**
 * GET /api/pomodoro/stats
 * Get daily statistics
 * Query params: date? (defaults to today)
 */
router.get('/stats', (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Get completed work sessions for the day
    const workSessions = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(elapsed_us), 0) as total_elapsed_us
      FROM pomodoro_sessions 
      WHERE session_type = 'work' 
        AND completed = 1 
        AND DATE(started_at) = ?
    `).get(targetDate);
    
    // Get total work time (including interrupted sessions)
    const totalWork = db.prepare(`
      SELECT COALESCE(SUM(elapsed_us), 0) as total_elapsed_us
      FROM pomodoro_sessions 
      WHERE session_type = 'work' 
        AND DATE(started_at) = ?
    `).get(targetDate);
    
    // Get break sessions for the day
    const breakSessions = db.prepare(`
      SELECT 
        COUNT(*) as count, 
        COALESCE(SUM(elapsed_us), 0) as total_elapsed_us,
        SUM(CASE WHEN session_type = 'short_break' THEN 1 ELSE 0 END) as short_break_count,
        SUM(CASE WHEN session_type = 'long_break' THEN 1 ELSE 0 END) as long_break_count
      FROM pomodoro_sessions 
      WHERE session_type IN ('short_break', 'long_break') 
        AND completed = 1 
        AND DATE(started_at) = ?
    `).get(targetDate);
    
    // Get settings for daily goal
    const settings = getOrCreateSettings();
    
    const stats = {
      date: targetDate,
      work_sessions_completed: workSessions.count || 0,
      work_time_completed_us: workSessions.total_elapsed_us || 0,
      work_time_total_us: totalWork.total_elapsed_us || 0,
      break_sessions_completed: breakSessions.count || 0,
      short_break_count: breakSessions.short_break_count || 0,
      long_break_count: breakSessions.long_break_count || 0,
      break_time_us: breakSessions.total_elapsed_us || 0,
      daily_goal: settings.daily_goal,
      goal_progress_percent: settings.daily_goal > 0 
        ? Math.min(100, Math.round((workSessions.count / settings.daily_goal) * 100))
        : 0
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch statistics' }
    });
  }
});

module.exports = router;
