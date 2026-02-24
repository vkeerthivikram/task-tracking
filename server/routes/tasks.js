const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');
const { asyncHandler, Errors } = require('../middleware/asyncHandler');
const { validateExists, validateRelatedExists } = require('../middleware/validateExists');

// Valid status and priority values
const VALID_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// ==================== BASIC CRUD ENDPOINTS ====================

// GET /api/tasks - List all tasks with optional filters
router.get('/', asyncHandler(async (req, res) => {
  const { projectId, status, priority, search, assignee_id, tag_id, parent_task_id } = req.query;
  
  let query = 'SELECT DISTINCT t.* FROM tasks t WHERE 1=1';
  const params = [];
  
  if (projectId) {
    query += ' AND t.project_id = ?';
    params.push(projectId);
  }
  
  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  
  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }
  
  if (search) {
    query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }
  
  if (assignee_id) {
    // Filter by primary assignee or co-assignees
    query += ` AND (t.assignee_id = ? OR EXISTS (
      SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.person_id = ?
    ))`;
    params.push(assignee_id, assignee_id);
  }
  
  if (tag_id) {
    query += ` AND EXISTS (
      SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id = ?
    )`;
    params.push(tag_id);
  }
  
  // Filter by parent_task_id (can be 'null' for root tasks)
  if (parent_task_id !== undefined) {
    if (parent_task_id === 'null' || parent_task_id === null) {
      query += ' AND t.parent_task_id IS NULL';
    } else {
      query += ' AND t.parent_task_id = ?';
      params.push(parent_task_id);
    }
  }
  
  query += ' ORDER BY t.created_at DESC';
  
  const tasks = db.prepare(query).all(...params);
  res.json({ success: true, data: tasks });
}));

// GET /api/tasks/:id - Get single task with assignee and tags
router.get('/:id', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const task = req.entity;
  
  // Get primary assignee info
  let assignee = null;
  if (task.assignee_id) {
    assignee = db.prepare('SELECT * FROM people WHERE id = ?').get(task.assignee_id);
  }
  
  // Get co-assignees
  const coAssignees = db.prepare(`
    SELECT p.*, ta.role 
    FROM people p 
    JOIN task_assignees ta ON p.id = ta.person_id 
    WHERE ta.task_id = ?
  `).all(req.params.id);
  
  // Get tags
  const tags = db.prepare(`
    SELECT tg.* 
    FROM tags tg 
    JOIN task_tags tt ON tg.id = tt.tag_id 
    WHERE tt.task_id = ?
  `).all(req.params.id);
  
  res.json({ 
    success: true, 
    data: {
      ...task,
      assignee,
      coAssignees,
      tags
    }
  });
}));

// POST /api/tasks - Create task
router.post('/', 
  validateRelatedExists('projects', 'project_id', 'Project'),
  validateRelatedExists('people', 'assignee_id', 'Assignee'),
  validateRelatedExists('tasks', 'parent_task_id', 'Parent task'),
  asyncHandler(async (req, res) => {
    const { 
      project_id, title, description, status, priority, 
      due_date, start_date, end_date, assignee_id, parent_task_id,
      progress_percent, estimated_duration_minutes, actual_duration_minutes
    } = req.body;
    
    // Validation
    if (!title || title.trim() === '') {
      throw Errors.validation('Task title is required');
    }
    
    if (!project_id) {
      throw Errors.validation('Project ID is required');
    }
    
    // Validate status
    const taskStatus = status || 'todo';
    if (!VALID_STATUSES.includes(taskStatus)) {
      throw Errors.validation(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    
    // Validate priority
    const taskPriority = priority || 'medium';
    if (!VALID_PRIORITIES.includes(taskPriority)) {
      throw Errors.validation(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    
    // Validate progress_percent
    const taskProgress = progress_percent !== undefined ? progress_percent : 0;
    if (taskProgress < 0 || taskProgress > 100) {
      throw Errors.validation('Progress percent must be between 0 and 100');
    }
    
    const result = db.prepare(`
      INSERT INTO tasks (
        project_id, title, description, status, priority, 
        due_date, start_date, end_date, assignee_id, parent_task_id,
        progress_percent, estimated_duration_minutes, actual_duration_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project_id, 
      title.trim(), 
      description?.trim() || null, 
      taskStatus, 
      taskPriority, 
      due_date || null, 
      start_date || null,
      end_date || null,
      assignee_id || null,
      parent_task_id || null,
      taskProgress,
      estimated_duration_minutes || null,
      actual_duration_minutes || null
    );
    
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: newTask });
  })
);

// PUT /api/tasks/:id - Update task
router.put('/:id', 
  validateExists('tasks', 'id', 'Task'),
  validateRelatedExists('projects', 'project_id', 'Project'),
  validateRelatedExists('people', 'assignee_id', 'Assignee'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      project_id, title, description, status, priority, 
      due_date, start_date, end_date, assignee_id, parent_task_id,
      progress_percent, estimated_duration_minutes, actual_duration_minutes
    } = req.body;
    
    // Validate status if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      throw Errors.validation(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    
    // Validate priority if provided
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      throw Errors.validation(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    
    // Validate parent_task_id if provided (prevent self-reference)
    if (parent_task_id !== undefined) {
      if (parent_task_id !== null && parseInt(parent_task_id) === parseInt(id)) {
        throw Errors.validation('Task cannot be its own parent');
      }
      if (parent_task_id !== null) {
        const parentTask = db.prepare('SELECT id FROM tasks WHERE id = ?').get(parent_task_id);
        if (!parentTask) {
          throw Errors.validation('Parent task not found');
        }
      }
    }
    
    // Validate progress_percent if provided
    if (progress_percent !== undefined && (progress_percent < 0 || progress_percent > 100)) {
      throw Errors.validation('Progress percent must be between 0 and 100');
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
          end_date = COALESCE(?, end_date), 
          assignee_id = COALESCE(?, assignee_id),
          parent_task_id = COALESCE(?, parent_task_id),
          progress_percent = COALESCE(?, progress_percent),
          estimated_duration_minutes = COALESCE(?, estimated_duration_minutes),
          actual_duration_minutes = COALESCE(?, actual_duration_minutes),
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
      end_date !== undefined ? (end_date || null) : null,
      assignee_id !== undefined ? assignee_id : null,
      parent_task_id !== undefined ? parent_task_id : null,
      progress_percent !== undefined ? progress_percent : null,
      estimated_duration_minutes !== undefined ? estimated_duration_minutes : null,
      actual_duration_minutes !== undefined ? actual_duration_minutes : null,
      id
    );
    
    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedTask });
  })
);

// PATCH /api/tasks/:id/status - Update task status only (for Kanban)
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // Validate status
  if (!status || !VALID_STATUSES.includes(status)) {
    throw Errors.validation(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  
  // Check if task exists
  const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existingTask) {
    throw Errors.notFound('Task');
  }
  
  // Update status
  db.prepare(`
    UPDATE tasks 
    SET status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(status, id);
  
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  
  res.json({ success: true, data: updatedTask });
}));

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Task deleted successfully' });
}));

// ==================== HIERARCHY ENDPOINTS ====================

// GET /api/tasks/:id/children - Get direct children of a task
router.get('/:id/children', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const children = db.prepare(`
    SELECT * FROM tasks 
    WHERE parent_task_id = ? 
    ORDER BY created_at DESC
  `).all(req.params.id);
  
  res.json({ success: true, data: children });
}));

// GET /api/tasks/:id/descendants - Get all descendants using recursive CTE
router.get('/:id/descendants', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const descendants = db.prepare(`
    WITH RECURSIVE descendants AS (
      SELECT * FROM tasks WHERE parent_task_id = ?
      UNION ALL
      SELECT t.* FROM tasks t
      INNER JOIN descendants d ON t.parent_task_id = d.id
    )
    SELECT * FROM descendants ORDER BY created_at DESC
  `).all(req.params.id);
  
  res.json({ success: true, data: descendants });
}));

// GET /api/tasks/:id/ancestors - Get all ancestors using recursive CTE
router.get('/:id/ancestors', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const ancestors = db.prepare(`
    WITH RECURSIVE ancestors AS (
      SELECT * FROM tasks WHERE id = (SELECT parent_task_id FROM tasks WHERE id = ?)
      UNION ALL
      SELECT t.* FROM tasks t
      INNER JOIN ancestors a ON t.id = (SELECT parent_task_id FROM tasks WHERE id = a.id)
    )
    SELECT * FROM ancestors WHERE id IS NOT NULL ORDER BY created_at ASC
  `).all(req.params.id);
  
  res.json({ success: true, data: ancestors });
}));

// GET /api/tasks/:id/tree - Get full tree as nested JSON
router.get('/:id/tree', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const task = req.entity;
  
  // Recursive function to build tree
  function buildTree(parentId) {
    const children = db.prepare(`
      SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at DESC
    `).all(parentId);
    
    return children.map(child => ({
      ...child,
      children: buildTree(child.id)
    }));
  }
  
  const tree = {
    ...task,
    children: buildTree(req.params.id)
  };
  
  res.json({ success: true, data: tree });
}));

// POST /api/tasks/:parentId/subtasks - Create a sub-task
router.post('/:parentId/subtasks', 
  validateExists('tasks', 'parentId', 'Parent task'),
  asyncHandler(async (req, res) => {
    const parentTask = req.entity;
    const { 
      title, description, status, priority, 
      due_date, start_date, end_date, assignee_id,
      progress_percent, estimated_duration_minutes
    } = req.body;
    
    if (!title || title.trim() === '') {
      throw Errors.validation('Task title is required');
    }
    
    // Validate status
    const taskStatus = status || 'todo';
    if (!VALID_STATUSES.includes(taskStatus)) {
      throw Errors.validation(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    
    // Validate priority
    const taskPriority = priority || 'medium';
    if (!VALID_PRIORITIES.includes(taskPriority)) {
      throw Errors.validation(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
    
    const result = db.prepare(`
      INSERT INTO tasks (
        project_id, title, description, status, priority, 
        due_date, start_date, end_date, assignee_id, parent_task_id,
        progress_percent, estimated_duration_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      parentTask.project_id, 
      title.trim(), 
      description?.trim() || null, 
      taskStatus, 
      taskPriority, 
      due_date || null, 
      start_date || null,
      end_date || null,
      assignee_id || null,
      req.params.parentId,
      progress_percent || 0,
      estimated_duration_minutes || null
    );
    
    const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: newTask });
  })
);

// PUT /api/tasks/:id/move - Move task to a new parent
router.put('/:id/move', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { parent_id } = req.body;
  
  // Validate parent_id if provided
  if (parent_id !== null && parent_id !== undefined) {
    // Prevent self-reference
    if (parseInt(parent_id) === parseInt(id)) {
      throw Errors.validation('Task cannot be moved to itself');
    }
    
    // Check if parent exists
    const parentTask = db.prepare('SELECT id FROM tasks WHERE id = ?').get(parent_id);
    if (!parentTask) {
      throw Errors.notFound('Parent task');
    }
    
    // Check for circular reference (if parent is a descendant)
    const descendants = db.prepare(`
      WITH RECURSIVE descendants AS (
        SELECT id FROM tasks WHERE parent_task_id = ?
        UNION ALL
        SELECT t.id FROM tasks t
        INNER JOIN descendants d ON t.parent_task_id = d.id
      )
      SELECT id FROM descendants
    `).all(id);
    
    const descendantIds = descendants.map(d => d.id);
    if (descendantIds.includes(parseInt(parent_id))) {
      throw Errors.validation('Cannot move task to one of its descendants');
    }
  }
  
  // Update the parent
  db.prepare(`
    UPDATE tasks 
    SET parent_task_id = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(parent_id || null, id);
  
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  
  res.json({ success: true, data: updatedTask });
}));

// ==================== PROGRESS ENDPOINTS ====================

// PUT /api/tasks/:id/progress - Update task progress
router.put('/:id/progress', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { progress_percent, estimated_duration_minutes, actual_duration_minutes } = req.body;
  
  // Validate progress_percent if provided
  if (progress_percent !== undefined && (progress_percent < 0 || progress_percent > 100)) {
    throw Errors.validation('Progress percent must be between 0 and 100');
  }
  
  // Update progress fields
  db.prepare(`
    UPDATE tasks 
    SET progress_percent = COALESCE(?, progress_percent),
        estimated_duration_minutes = COALESCE(?, estimated_duration_minutes),
        actual_duration_minutes = COALESCE(?, actual_duration_minutes),
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(
    progress_percent !== undefined ? progress_percent : null,
    estimated_duration_minutes !== undefined ? estimated_duration_minutes : null,
    actual_duration_minutes !== undefined ? actual_duration_minutes : null,
    id
  );
  
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  
  res.json({ success: true, data: updatedTask });
}));

// GET /api/tasks/:id/progress/rollup - Get calculated progress including children
router.get('/:id/progress/rollup', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const task = req.entity;
  
  // Get all descendants
  const descendants = db.prepare(`
    WITH RECURSIVE descendants AS (
      SELECT * FROM tasks WHERE parent_task_id = ?
      UNION ALL
      SELECT t.* FROM tasks t
      INNER JOIN descendants d ON t.parent_task_id = d.id
    )
    SELECT * FROM descendants
  `).all(id);
  
  // Get only direct children for rollup calculation
  const directChildren = descendants.filter(d => d.parent_task_id === parseInt(id));
  
  if (directChildren.length === 0) {
    // No children, return own progress
    res.json({ 
      success: true, 
      data: {
        task_id: id,
        progress_percent: task.progress_percent || 0,
        children_count: 0,
        rollup_type: 'self'
      }
    });
  } else {
    // Calculate average progress from direct children
    const avgProgress = directChildren.reduce((sum, child) => sum + (child.progress_percent || 0), 0) / directChildren.length;
    
    // Count all descendants
    const allDescendants = descendants.length;
    
    res.json({ 
      success: true, 
      data: {
        task_id: id,
        progress_percent: Math.round(avgProgress),
        children_count: directChildren.length,
        all_descendants_count: allDescendants,
        rollup_type: 'children_average',
        children: directChildren.map(c => ({
          id: c.id,
          title: c.title,
          progress_percent: c.progress_percent || 0
        }))
      }
    });
  }
}));

// ==================== ASSIGNEE ENDPOINTS ====================

// GET /api/tasks/:id/assignees - Get all co-assignees for a task
router.get('/:id/assignees', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const assignees = db.prepare(`
    SELECT p.*, ta.role, ta.id as assignment_id
    FROM people p 
    JOIN task_assignees ta ON p.id = ta.person_id 
    WHERE ta.task_id = ?
  `).all(req.params.id);
  
  res.json({ success: true, data: assignees });
}));

// POST /api/tasks/:id/assignees - Add a co-assignee to a task
router.post('/:id/assignees', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { person_id, role } = req.body;
  
  if (!person_id) {
    throw Errors.validation('Person ID is required');
  }
  
  // Check if person exists
  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(person_id);
  if (!person) {
    throw Errors.notFound('Person');
  }
  
  // Check if already assigned
  const existing = db.prepare('SELECT id FROM task_assignees WHERE task_id = ? AND person_id = ?').get(id, person_id);
  if (existing) {
    throw Errors.validation('Person is already assigned to this task');
  }
  
  const assignmentId = crypto.randomUUID();
  const assignmentRole = role || 'collaborator';
  
  db.prepare(`
    INSERT INTO task_assignees (id, task_id, person_id, role) 
    VALUES (?, ?, ?, ?)
  `).run(assignmentId, id, person_id, assignmentRole);
  
  res.status(201).json({ 
    success: true, 
    data: {
      ...person,
      role: assignmentRole,
      assignment_id: assignmentId
    }
  });
}));

// DELETE /api/tasks/:id/assignees/:personId - Remove a co-assignee from a task
router.delete('/:id/assignees/:personId', asyncHandler(async (req, res) => {
  const { id, personId } = req.params;
  
  const result = db.prepare('DELETE FROM task_assignees WHERE task_id = ? AND person_id = ?').run(id, personId);
  
  if (result.changes === 0) {
    throw Errors.notFound('Assignment');
  }
  
  res.json({ success: true, message: 'Assignee removed from task' });
}));

// PUT /api/tasks/:id/assignee - Set primary assignee
router.put('/:id/assignee', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { assignee_id } = req.body;
  
  // Validate assignee_id if provided (null means unassign)
  if (assignee_id !== null && assignee_id !== undefined) {
    const person = db.prepare('SELECT id FROM people WHERE id = ?').get(assignee_id);
    if (!person) {
      throw Errors.notFound('Person');
    }
  }
  
  db.prepare(`
    UPDATE tasks 
    SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(assignee_id || null, id);
  
  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  
  res.json({ success: true, data: updatedTask });
}));

// ==================== TAG ENDPOINTS ====================

// GET /api/tasks/:id/tags - Get all tags for a task
router.get('/:id/tags', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const tags = db.prepare(`
    SELECT tg.* 
    FROM tags tg 
    JOIN task_tags tt ON tg.id = tt.tag_id 
    WHERE tt.task_id = ?
  `).all(req.params.id);
  
  res.json({ success: true, data: tags });
}));

// POST /api/tasks/:id/tags - Add a tag to a task
router.post('/:id/tags', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tag_id } = req.body;
  
  if (!tag_id) {
    throw Errors.validation('Tag ID is required');
  }
  
  // Check if tag exists
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tag_id);
  if (!tag) {
    throw Errors.notFound('Tag');
  }
  
  // Check if tag is already applied
  const existing = db.prepare('SELECT id FROM task_tags WHERE task_id = ? AND tag_id = ?').get(id, tag_id);
  if (existing) {
    throw Errors.validation('Tag is already applied to this task');
  }
  
  const taskTagId = crypto.randomUUID();
  
  db.prepare(`
    INSERT INTO task_tags (id, task_id, tag_id) 
    VALUES (?, ?, ?)
  `).run(taskTagId, id, tag_id);
  
  res.status(201).json({ 
    success: true, 
    data: {
      ...tag,
      task_tag_id: taskTagId
    }
  });
}));

// DELETE /api/tasks/:id/tags/:tagId - Remove a tag from a task
router.delete('/:id/tags/:tagId', asyncHandler(async (req, res) => {
  const { id, tagId } = req.params;
  
  const result = db.prepare('DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?').run(id, tagId);
  
  if (result.changes === 0) {
    throw Errors.notFound('Tag association');
  }
  
  res.json({ success: true, message: 'Tag removed from task' });
}));

// ==================== BULK OPERATIONS ENDPOINTS ====================

// PUT /api/tasks/bulk - Bulk update multiple tasks
router.put('/bulk', asyncHandler(async (req, res) => {
  const { taskIds, updates } = req.body;
  
  // Validate taskIds
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw Errors.validation('taskIds must be a non-empty array');
  }
  
  // Validate updates
  if (!updates || typeof updates !== 'object') {
    throw Errors.validation('updates object is required');
  }
  
  // Validate status if provided
  if (updates.status !== undefined && !VALID_STATUSES.includes(updates.status)) {
    throw Errors.validation(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  
  // Validate priority if provided
  if (updates.priority !== undefined && !VALID_PRIORITIES.includes(updates.priority)) {
    throw Errors.validation(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  
  // Validate assignee_id if provided
  if (updates.assignee_id !== undefined && updates.assignee_id !== null) {
    const person = db.prepare('SELECT id FROM people WHERE id = ?').get(updates.assignee_id);
    if (!person) {
      throw Errors.validation('Assignee not found');
    }
  }
  
  // Build the update query dynamically
  const setClauses = [];
  const params = [];
  
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }
  
  if (updates.priority !== undefined) {
    setClauses.push('priority = ?');
    params.push(updates.priority);
  }
  
  if (updates.assignee_id !== undefined) {
    setClauses.push('assignee_id = ?');
    params.push(updates.assignee_id);
  }
  
  if (setClauses.length === 0) {
    throw Errors.validation('No valid updates provided');
  }
  
  // Add updated_at timestamp
  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  
  // Build the WHERE clause with placeholders
  const placeholders = taskIds.map(() => '?').join(',');
  const updateQuery = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`;
  
  // Combine params with taskIds
  const allParams = [...params, ...taskIds];
  
  // Execute the bulk update
  const result = db.prepare(updateQuery).run(...allParams);
  
  // Fetch the updated tasks
  const fetchQuery = `SELECT * FROM tasks WHERE id IN (${placeholders})`;
  const updatedTasks = db.prepare(fetchQuery).all(...taskIds);
  
  res.json({ 
    success: true, 
    data: {
      updated: result.changes,
      tasks: updatedTasks
    }
  });
}));

// ==================== CUSTOM FIELD VALUE ENDPOINTS ====================

// GET /api/tasks/:id/custom-fields - Get all custom field values for a task
router.get('/:id/custom-fields', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  // Get all custom field values with their field definitions
  const fieldValues = db.prepare(`
    SELECT cfv.id, cfv.task_id, cfv.custom_field_id, cfv.value, 
           cfv.created_at, cfv.updated_at,
           cf.id as 'custom_field.id', cf.name as 'custom_field.name', 
           cf.field_type as 'custom_field.field_type', cf.project_id as 'custom_field.project_id',
           cf.options as 'custom_field.options', cf.required as 'custom_field.required',
           cf.sort_order as 'custom_field.sort_order'
    FROM custom_field_values cfv
    JOIN custom_fields cf ON cfv.custom_field_id = cf.id
    WHERE cfv.task_id = ?
    ORDER BY cf.sort_order ASC
  `).all(req.params.id);
  
  // Transform the flat results into nested objects
  const transformedValues = fieldValues.map(fv => ({
    id: fv.id,
    task_id: fv.task_id,
    custom_field_id: fv.custom_field_id,
    value: fv.value,
    created_at: fv.created_at,
    updated_at: fv.updated_at,
    custom_field: {
      id: fv['custom_field.id'],
      name: fv['custom_field.name'],
      field_type: fv['custom_field.field_type'],
      project_id: fv['custom_field.project_id'],
      options: fv['custom_field.options'] ? JSON.parse(fv['custom_field.options']) : null,
      required: fv['custom_field.required'] === 1,
      sort_order: fv['custom_field.sort_order']
    }
  }));
  
  res.json({ success: true, data: transformedValues });
}));

// PUT /api/tasks/:id/custom-fields/:fieldId - Set custom field value (create or update)
router.put('/:id/custom-fields/:fieldId', validateExists('tasks', 'id', 'Task'), asyncHandler(async (req, res) => {
  const { id, fieldId } = req.params;
  const task = req.entity;
  const { value } = req.body;
  
  // Check if custom field exists and is applicable to this task
  const customField = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(fieldId);
  if (!customField) {
    throw Errors.notFound('Custom field');
  }
  
  // Check if field is global or belongs to the task's project
  if (customField.project_id !== null && customField.project_id !== task.project_id) {
    throw Errors.validation('Custom field does not belong to this task\'s project');
  }
  
  // Validate value based on field type
  if (value !== null && value !== undefined) {
    switch (customField.field_type) {
      case 'number':
        if (typeof value !== 'number') {
          throw Errors.validation('Value must be a number for number field type');
        }
        break;
      case 'checkbox':
        if (typeof value !== 'boolean') {
          throw Errors.validation('Value must be a boolean for checkbox field type');
        }
        break;
      case 'select':
        // Validate that value is one of the options
        if (customField.options) {
          const options = JSON.parse(customField.options);
          if (!options.includes(value)) {
            throw Errors.validation(`Value must be one of: ${options.join(', ')}`);
          }
        }
        break;
      case 'multiselect':
        // Validate that value is an array and all values are valid options
        if (!Array.isArray(value)) {
          throw Errors.validation('Value must be an array for multiselect field type');
        }
        if (customField.options) {
          const options = JSON.parse(customField.options);
          const invalidValues = value.filter(v => !options.includes(v));
          if (invalidValues.length > 0) {
            throw Errors.validation(`Invalid values: ${invalidValues.join(', ')}. Must be one of: ${options.join(', ')}`);
          }
        }
        break;
      case 'text':
      case 'url':
        if (typeof value !== 'string') {
          throw Errors.validation(`Value must be a string for ${customField.field_type} field type`);
        }
        break;
      case 'date':
        // Validate date format (YYYY-MM-DD or ISO string)
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
          throw Errors.validation('Value must be a valid date string (YYYY-MM-DD) for date field type');
        }
        break;
    }
  }
  
  // Serialize value for storage
  let storedValue = value;
  if (Array.isArray(value)) {
    storedValue = JSON.stringify(value);
  } else if (typeof value === 'boolean') {
    storedValue = value ? 'true' : 'false';
  } else if (value === null || value === undefined) {
    storedValue = null;
  } else {
    storedValue = String(value);
  }
  
  // Check if value already exists
  const existingValue = db.prepare(`
    SELECT id FROM custom_field_values WHERE task_id = ? AND custom_field_id = ?
  `).get(id, fieldId);
  
  if (existingValue) {
    // Update existing value
    db.prepare(`
      UPDATE custom_field_values 
      SET value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(storedValue, existingValue.id);
  } else {
    // Create new value
    const valueId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO custom_field_values (id, task_id, custom_field_id, value) 
      VALUES (?, ?, ?, ?)
    `).run(valueId, id, fieldId, storedValue);
  }
  
  // Fetch the updated/created value with field definition
  const result = db.prepare(`
    SELECT cfv.id, cfv.task_id, cfv.custom_field_id, cfv.value, 
           cfv.created_at, cfv.updated_at,
           cf.id as 'custom_field.id', cf.name as 'custom_field.name', 
           cf.field_type as 'custom_field.field_type', cf.project_id as 'custom_field.project_id',
           cf.options as 'custom_field.options', cf.required as 'custom_field.required',
           cf.sort_order as 'custom_field.sort_order'
    FROM custom_field_values cfv
    JOIN custom_fields cf ON cfv.custom_field_id = cf.id
    WHERE cfv.task_id = ? AND cfv.custom_field_id = ?
  `).get(id, fieldId);
  
  // Transform the result
  const transformedResult = {
    id: result.id,
    task_id: result.task_id,
    custom_field_id: result.custom_field_id,
    value: result.value,
    created_at: result.created_at,
    updated_at: result.updated_at,
    custom_field: {
      id: result['custom_field.id'],
      name: result['custom_field.name'],
      field_type: result['custom_field.field_type'],
      project_id: result['custom_field.project_id'],
      options: result['custom_field.options'] ? JSON.parse(result['custom_field.options']) : null,
      required: result['custom_field.required'] === 1,
      sort_order: result['custom_field.sort_order']
    }
  };
  
  res.json({ success: true, data: transformedResult });
}));

// DELETE /api/tasks/:id/custom-fields/:fieldId - Remove custom field value
router.delete('/:id/custom-fields/:fieldId', asyncHandler(async (req, res) => {
  const { id, fieldId } = req.params;
  
  const result = db.prepare(`
    DELETE FROM custom_field_values WHERE task_id = ? AND custom_field_id = ?
  `).run(id, fieldId);
  
  if (result.changes === 0) {
    throw Errors.notFound('Custom field value for this task');
  }
  
  res.json({ success: true, message: 'Custom field value removed from task' });
}));

module.exports = router;
