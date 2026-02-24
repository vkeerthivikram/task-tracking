const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');
const { asyncHandler, Errors } = require('../middleware/asyncHandler');
const { validateExists, validateRelatedExists } = require('../middleware/validateExists');

// GET /api/tags - List all tags with optional project filter
// Returns global tags (project_id = NULL) + project-specific tags
router.get('/', asyncHandler(async (req, res) => {
  const { project_id } = req.query;
  
  let query;
  const params = [];
  
  if (project_id) {
    // Return global tags + tags for the specific project
    query = 'SELECT * FROM tags WHERE project_id IS NULL OR project_id = ? ORDER BY project_id NULLS FIRST, name';
    params.push(project_id);
  } else {
    query = 'SELECT * FROM tags ORDER BY project_id NULLS FIRST, name';
  }
  
  const tags = db.prepare(query).all(...params);
  res.json({ success: true, data: tags });
}));

// GET /api/tags/:id - Get single tag
router.get('/:id', validateExists('tags', 'id', 'Tag'), asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.entity });
}));

// POST /api/tags - Create tag
router.post('/', validateRelatedExists('projects', 'project_id', 'Project'), asyncHandler(async (req, res) => {
  const { name, color, project_id } = req.body;
  
  // Validation
  if (!name || name.trim() === '') {
    throw Errors.validation('Tag name is required');
  }
  
  const id = crypto.randomUUID();
  const tagColor = color || '#6B7280';
  
  db.prepare(`
    INSERT INTO tags (id, name, color, project_id) 
    VALUES (?, ?, ?, ?)
  `).run(
    id, 
    name.trim(), 
    tagColor, 
    project_id || null
  );
  
  const newTag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  
  res.status(201).json({ success: true, data: newTag });
}));

// PUT /api/tags/:id - Update tag
router.put('/:id', validateExists('tags', 'id', 'Tag'), validateRelatedExists('projects', 'project_id', 'Project'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, color, project_id } = req.body;
  
  // Update tag
  db.prepare(`
    UPDATE tags 
    SET name = COALESCE(?, name), 
        color = COALESCE(?, color), 
        project_id = COALESCE(?, project_id), 
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : null,
    color !== undefined ? color : null,
    project_id !== undefined ? project_id : null,
    id
  );
  
  const updatedTag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  
  res.json({ success: true, data: updatedTag });
}));

// DELETE /api/tags/:id - Delete tag
router.delete('/:id', validateExists('tags', 'id', 'Tag'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Delete tag (cascade will handle task_tags)
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  
  res.json({ success: true, message: 'Tag deleted successfully' });
}));

module.exports = router;
