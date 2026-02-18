const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/projects - List all projects
router.get('/', (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch projects' 
      } 
    });
  }
});

// GET /api/projects/:id - Get single project
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Project not found' 
        } 
      });
    }
    
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch project' 
      } 
    });
  }
});

// POST /api/projects - Create project
router.post('/', (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Project name is required' 
        } 
      });
    }
    
    const result = db.prepare(`
      INSERT INTO projects (name, description, color) VALUES (?, ?, ?)
    `).run(name.trim(), description?.trim() || null, color || '#3B82F6');
    
    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: newProject });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'CREATE_ERROR', 
        message: 'Failed to create project' 
      } 
    });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;
    
    // Check if project exists
    const existingProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existingProject) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Project not found' 
        } 
      });
    }
    
    // Update project
    db.prepare(`
      UPDATE projects 
      SET name = COALESCE(?, name), 
          description = COALESCE(?, description), 
          color = COALESCE(?, color), 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : null,
      description !== undefined ? (description?.trim() || null) : null,
      color !== undefined ? color : null,
      id
    );
    
    const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedProject });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'UPDATE_ERROR', 
        message: 'Failed to update project' 
      } 
    });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Project not found' 
        } 
      });
    }
    
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'DELETE_ERROR', 
        message: 'Failed to delete project' 
      } 
    });
  }
});

module.exports = router;
