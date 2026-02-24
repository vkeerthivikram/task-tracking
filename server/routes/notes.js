const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');
const { asyncHandler, Errors } = require('../middleware/asyncHandler');
const { validateExists } = require('../middleware/validateExists');

// Valid entity types for notes
const VALID_ENTITY_TYPES = ['project', 'task', 'person'];

// Map entity types to their tables
const ENTITY_TABLES = {
  project: 'projects',
  task: 'tasks',
  person: 'people'
};

/**
 * Validates that the entity referenced by entity_type and entity_id exists
 */
function validateEntityExists(req, res, next) {
  const { entity_type, entity_id } = req.body;
  
  if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type)) {
    throw Errors.validation(`entity_type is required and must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
  }
  
  if (!entity_id) {
    throw Errors.validation('entity_id is required');
  }
  
  const table = ENTITY_TABLES[entity_type];
  const entity = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(entity_id);
  
  if (!entity) {
    throw Errors.validation(`${entity_type} with id ${entity_id} not found`);
  }
  
  next();
}

// GET /api/notes - List notes for an entity
// Query params: entity_type, entity_id
router.get('/', asyncHandler(async (req, res) => {
  const { entity_type, entity_id } = req.query;
  
  if (entity_type && entity_id) {
    // Validate entity_type
    if (!VALID_ENTITY_TYPES.includes(entity_type)) {
      throw Errors.validation(`Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
    }
    
    const notes = db.prepare(`
      SELECT * FROM notes 
      WHERE entity_type = ? AND entity_id = ? 
      ORDER BY created_at DESC
    `).all(entity_type, entity_id);
    
    res.json({ success: true, data: notes });
  } else {
    // Return all notes if no filter provided
    const notes = db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all();
    res.json({ success: true, data: notes });
  }
}));

// GET /api/notes/:id - Get single note
router.get('/:id', validateExists('notes', 'id', 'Note'), (req, res) => {
  res.json({ success: true, data: req.entity });
});

// POST /api/notes - Create note
router.post('/', validateEntityExists, asyncHandler(async (req, res) => {
  const { content, entity_type, entity_id } = req.body;
  
  if (!content || content.trim() === '') {
    throw Errors.validation('Note content is required');
  }
  
  const noteId = crypto.randomUUID();
  
  db.prepare(`
    INSERT INTO notes (id, content, entity_type, entity_id) 
    VALUES (?, ?, ?, ?)
  `).run(noteId, content.trim(), entity_type, entity_id);
  
  const newNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  
  res.status(201).json({ success: true, data: newNote });
}));

// PUT /api/notes/:id - Update note content
router.put('/:id', validateExists('notes', 'id', 'Note'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  db.prepare(`
    UPDATE notes 
    SET content = COALESCE(?, content), 
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(
    content !== undefined ? content.trim() : null,
    id
  );
  
  const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  
  res.json({ success: true, data: updatedNote });
}));

// DELETE /api/notes/:id - Delete note
router.delete('/:id', validateExists('notes', 'id', 'Note'), asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Note deleted successfully' });
}));

module.exports = router;
