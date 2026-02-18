const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Valid status and priority values
const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// GET /api/tasks - List all tasks with optional filters
router.get('/', (req, res) => {
  try {
    const { projectId, status, priority, search } = req.query;
    
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    
    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const tasks = db.prepare(query).all(...params);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch tasks' 
      } 
    });
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Task not found' 
        } 
      });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch task' 
      } 
    });
  }
});

// POST /api/tasks - Create task
router.post('/', (req, res) => {
  try {
    const { project_id, title, description, status, priority, due_date, start_date } = req.body;
    
    // Validation
    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Task title is required' 
        } 
      });
    }
    
    if (!project_id) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Project ID is required' 
        } 
      });
    }
    
    // Check if project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id);
    if (!project) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Project not found' 
        } 
      });
    }
    
    // Validate status
    const taskStatus = status || 'todo';
    if (!VALID_STATUSES.includes(taskStatus)) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` 
        } 
      });
    }
    
    // Validate priority
    const taskPriority = priority || 'medium';
    if (!VALID_PRIORITIES.includes(taskPriority)) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` 
        } 
      });
    }
    
    const result = db.prepare(`
      INSERT INTO tasks (project_id, title, description, status, priority, due_date, start_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id, 
      title.trim(), 
      description?.trim() || null, 
      taskStatus, 
      taskPriority, 
      due_date || null, 
      start_date || null
    );
    
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: newTask });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'CREATE_ERROR', 
        message: 'Failed to create task' 
      } 
    });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { project_id, title, description, status, priority, due_date, start_date } = req.body;
    
    // Check if task exists
    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existingTask) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Task not found' 
        } 
      });
    }
    
    // Validate status if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` 
        } 
      });
    }
    
    // Validate priority if provided
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` 
        } 
      });
    }
    
    // Validate project_id if provided
    if (project_id !== undefined) {
      const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(project_id);
      if (!project) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Project not found' 
          } 
        });
      }
    }
    
    // Update task
    db.prepare(`
      UPDATE tasks 
      SET project_id = COALESCE(?, project_id), 
          title = COALESCE(?, title), 
          description = COALESCE(?, description), 
          status = COALESCE(?, status), 
          priority = COALESCE(?, priority), 
          due_date = COALESCE(?, due_date), 
          start_date = COALESCE(?, start_date), 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(
      project_id !== undefined ? project_id : null,
      title !== undefined ? title.trim() : null,
      description !== undefined ? (description?.trim() || null) : null,
      status !== undefined ? status : null,
      priority !== undefined ? priority : null,
      due_date !== undefined ? (due_date || null) : null,
      start_date !== undefined ? (start_date || null) : null,
      id
    );
    
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'UPDATE_ERROR', 
        message: 'Failed to update task' 
      } 
    });
  }
});

// PATCH /api/tasks/:id/status - Update task status only (for Kanban)
router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` 
        } 
      });
    }
    
    // Check if task exists
    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existingTask) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Task not found' 
        } 
      });
    }
    
    // Update status
    db.prepare(`
      UPDATE tasks 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, id);
    
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedTask });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'UPDATE_ERROR', 
        message: 'Failed to update task status' 
      } 
    });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if task exists
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Task not found' 
        } 
      });
    }
    
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'DELETE_ERROR', 
        message: 'Failed to delete task' 
      } 
    });
  }
});

module.exports = router;
