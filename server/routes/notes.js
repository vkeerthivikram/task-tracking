const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');

// Valid entity types for notes
const VALID_ENTITY_TYPES = ['project', 'task', 'person'];

// GET /api/notes - List notes for an entity
// Query params: entity_type, entity_id
router.get('/', (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    
    if (entity_type && entity_id) {
      // Validate entity_type
      if (!VALID_ENTITY_TYPES.includes(entity_type)) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: `Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` 
          } 
        });
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
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch notes' 
      } 
    });
  }
});

// GET /api/notes/:id - Get single note
router.get('/:id', (req, res) => {
  try {
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    
    if (!note) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Note not found' 
        } 
      });
    }
    
    res.json({ success: true, data: note });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch note' 
      } 
    });
  }
});

// POST /api/notes - Create note
router.post('/', (req, res) => {
  try {
    const { content, entity_type, entity_id } = req.body;
    
    // Validation
    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Note content is required' 
        } 
      });
    }
    
    if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type)) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `entity_type is required and must be one of: ${VALID_ENTITY_TYPES.join(', ')}` 
        } 
      });
    }
    
    if (!entity_id) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'entity_id is required' 
        } 
      });
    }
    
    // Validate that the entity exists
    let entityExists = false;
    if (entity_type === 'project') {
      entityExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(entity_id);
    } else if (entity_type === 'task') {
      entityExists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(entity_id);
    } else if (entity_type === 'person') {
      entityExists = db.prepare('SELECT id FROM people WHERE id = ?').get(entity_id);
    }
    
    if (!entityExists) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `${entity_type} with id ${entity_id} not found` 
        } 
      });
    }
    
    const noteId = crypto.randomUUID();
    
    db.prepare(`
      INSERT INTO notes (id, content, entity_type, entity_id) 
      VALUES (?, ?, ?, ?)
    `).run(noteId, content.trim(), entity_type, entity_id);
    
    const newNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    
    res.status(201).json({ success: true, data: newNote });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'CREATE_ERROR', 
        message: 'Failed to create note' 
      } 
    });
  }
});

// PUT /api/notes/:id - Update note content
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    // Check if note exists
    const existingNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existingNote) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Note not found' 
        } 
      });
    }
    
    // Update note
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
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'UPDATE_ERROR', 
        message: 'Failed to update note' 
      } 
    });
  }
});

// DELETE /api/notes/:id - Delete note
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if note exists
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!note) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Note not found' 
        } 
      });
    }
    
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'DELETE_ERROR', 
        message: 'Failed to delete note' 
      } 
    });
  }
});

module.exports = router;
