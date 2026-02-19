const express = require('express');
const router = express.Router();
const db = require('../db/database');

const crypto = require('crypto');

const VALID_PROJECT_ROLES = ['lead', 'member', 'observer'];

// ==================== BASIC CRUD ENDPOINTS ====================

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

// GET /api/projects/root - Get all root projects (no parent)
router.get('/root', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT * FROM projects 
      WHERE parent_project_id IS NULL 
      ORDER BY created_at DESC
    `).all();
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('Error fetching root projects:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch root projects' 
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
    const { name, description, color, parent_project_id } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Project name is required' 
        } 
      });
    }
    
    // Validate parent_project_id if provided
    if (parent_project_id !== undefined && parent_project_id !== null) {
      const parentProject = db.prepare('SELECT id FROM projects WHERE id = ?').get(parent_project_id);
      if (!parentProject) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Parent project not found' 
          } 
        });
      }
    }
    
    const result = db.prepare(`
      INSERT INTO projects (name, description, color, parent_project_id) VALUES (?, ?, ?, ?)
    `).run(name.trim(), description?.trim() || null, color || '#3B82F6', parent_project_id || null);
    
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
    const { name, description, color, parent_project_id } = req.body;
    
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
    
    // Validate parent_project_id if provided (prevent self-reference)
    if (parent_project_id !== undefined) {
      if (parent_project_id !== null && parseInt(parent_project_id) === parseInt(id)) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Project cannot be its own parent' 
          } 
        });
      }
      if (parent_project_id !== null) {
        const parentProject = db.prepare('SELECT id FROM projects WHERE id = ?').get(parent_project_id);
        if (!parentProject) {
          return res.status(400).json({ 
            success: false, 
            error: { 
              code: 'VALIDATION_ERROR', 
              message: 'Parent project not found' 
            } 
          });
        }
      }
    }
    
    // Update project
    db.prepare(`
      UPDATE projects 
      SET name = COALESCE(?, name), 
          description = COALESCE(?, description), 
          color = COALESCE(?, color), 
          parent_project_id = COALESCE(?, parent_project_id),
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : null,
      description !== undefined ? (description?.trim() || null) : null,
      color !== undefined ? color : null,
      parent_project_id !== undefined ? parent_project_id : null,
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

// ==================== HIERARCHY ENDPOINTS ====================

// GET /api/projects/:id/children - Get direct children of a project
router.get('/:id/children', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Project not found' 
        } 
      });
    }
    
    const children = db.prepare(`
      SELECT * FROM projects 
      WHERE parent_project_id = ? 
      ORDER BY created_at DESC
    `).all(id);
    
    res.json({ success: true, data: children });
  } catch (error) {
    console.error('Error fetching project children:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch project children' 
      } 
    });
  }
});

// GET /api/projects/:id/descendants - Get all descendants using recursive CTE
router.get('/:id/descendants', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Project not found' 
        } 
      });
    }
    
    const descendants = db.prepare(`
      WITH RECURSIVE descendants AS (
        SELECT * FROM projects WHERE parent_project_id = ?
        UNION ALL
        SELECT p.* FROM projects p
        INNER JOIN descendants d ON p.parent_project_id = d.id
      )
      SELECT * FROM descendants ORDER BY created_at DESC
    `).all(id);
    
    res.json({ success: true, data: descendants });
  } catch (error) {
    console.error('Error fetching project descendants:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch project descendants' 
      } 
    });
  }
});

// GET /api/projects/:id/ancestors - Get all ancestors using recursive CTE
router.get('/:id/ancestors', (req, res) => {
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
    
    const ancestors = db.prepare(`
      WITH RECURSIVE ancestors AS (
        SELECT * FROM projects WHERE id = (SELECT parent_project_id FROM projects WHERE id = ?)
        UNION ALL
        SELECT p.* FROM projects p
        INNER JOIN ancestors a ON p.id = (SELECT parent_project_id FROM projects WHERE id = a.id)
      )
      SELECT * FROM ancestors WHERE id IS NOT NULL ORDER BY created_at ASC
    `).all(id);
    
    res.json({ success: true, data: ancestors });
  } catch (error) {
    console.error('Error fetching project ancestors:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch project ancestors' 
      } 
    });
  }
});

// GET /api/projects/:id/tree - Get full tree as nested JSON
router.get('/:id/tree', (req, res) => {
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
    
    // Recursive function to build tree
    function buildTree(parentId) {
      const children = db.prepare(`
        SELECT * FROM projects WHERE parent_project_id = ? ORDER BY created_at DESC
      `).all(parentId);
      
      return children.map(child => ({
        ...child,
        children: buildTree(child.id)
      }));
    }
    
    const tree = {
      ...project,
      children: buildTree(id)
    };
    
    res.json({ success: true, data: tree });
  } catch (error) {
    console.error('Error fetching project tree:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch project tree' 
      } 
    });
  }
});

// POST /api/projects/:parentId/subprojects - Create a sub-project
router.post('/:parentId/subprojects', (req, res) => {
  try {
    const { parentId } = req.params;
    const { name, description, color } = req.body;
    
    // Check if parent project exists
    const parentProject = db.prepare('SELECT id FROM projects WHERE id = ?').get(parentId);
    if (!parentProject) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Parent project not found' 
        } 
      });
    }
    
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
      INSERT INTO projects (name, description, color, parent_project_id) VALUES (?, ?, ?, ?)
    `).run(name.trim(), description?.trim() || null, color || '#3B82F6', parentId);
    
    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({ success: true, data: newProject });
  } catch (error) {
    console.error('Error creating sub-project:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'CREATE_ERROR', 
        message: 'Failed to create sub-project' 
      } 
    });
  }
});

// PUT /api/projects/:id/move - Move project to a new parent
router.put('/:id/move', (req, res) => {
  try {
    const { id } = req.params;
    const { parent_id } = req.body;
    
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
    
    // Validate parent_id if provided
    if (parent_id !== null && parent_id !== undefined) {
      // Prevent self-reference
      if (parseInt(parent_id) === parseInt(id)) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Project cannot be moved to itself' 
          } 
        });
      }
      
      // Check if parent exists
      const parentProject = db.prepare('SELECT id FROM projects WHERE id = ?').get(parent_id);
      if (!parentProject) {
        return res.status(404).json({ 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: 'Parent project not found' 
          } 
        });
      }
      
      // Check for circular reference (if parent is a descendant)
      const descendants = db.prepare(`
        WITH RECURSIVE descendants AS (
          SELECT id FROM projects WHERE parent_project_id = ?
          UNION ALL
          SELECT p.id FROM projects p
          INNER JOIN descendants d ON p.parent_project_id = d.id
        )
        SELECT id FROM descendants
      `).all(id);
      
      const descendantIds = descendants.map(d => d.id);
      if (descendantIds.includes(parseInt(parent_id))) {
        return res.status(400).json({ 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Cannot move project to one of its descendants' 
          } 
        });
      }
    }
    
    // Update the parent
    db.prepare(`
      UPDATE projects 
      SET parent_project_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(parent_id || null, id);
    
    const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedProject });
  } catch (error) {
    console.error('Error moving project:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'UPDATE_ERROR', 
        message: 'Failed to move project' 
      } 
    });
  }
});

// ==================== PROJECT ASSIGNMENTS ENDPOINTS (v1.3.0) ====================

// PUT /api/projects/:id/owner - Set project owner
router.put('/:id/owner', (req, res) => {
  try {
    const { id } = req.params;
    const { person_id } = req.body;
    
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
    
    // Validate person_id if provided (null means remove owner)
    if (person_id !== null && person_id !== undefined) {
      const person = db.prepare('SELECT id FROM people WHERE id = ?').get(person_id);
      if (!person) {
        return res.status(404).json({ 
          success: false, 
          error: { 
            code: 'NOT_FOUND', 
            message: 'Person not found' 
          } 
        });
      }
    }
    
    // Update owner_id
    db.prepare(`
      UPDATE projects 
      SET owner_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(person_id || null, id);
    
    const updatedProject = db.prepare(`
      SELECT p.*, 
        o.id as owner_id, o.name as owner_name, o.email as owner_email, 
        o.company as owner_company, o.designation as owner_designation
      FROM projects p
      LEFT JOIN people o ON p.owner_id = o.id
      WHERE p.id = ?
    `).get(id);
    
    res.json({ success: true, data: updatedProject });
  } catch (error) {
    console.error('Error updating project owner:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'UPDATE_ERROR', 
        message: 'Failed to update project owner' 
      } 
    });
  }
});

// GET /api/projects/:id/assignees - Get all assignees for a project
router.get('/:id/assignees', (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Project not found' 
        } 
      });
    }
    
    const assignees = db.prepare(`
      SELECT p.*, pa.role, pa.id as assignment_id, pa.created_at as assigned_at
      FROM people p 
      JOIN project_assignees pa ON p.id = pa.person_id 
      WHERE pa.project_id = ?
      ORDER BY pa.created_at ASC
    `).all(id);
    
    res.json({ success: true, data: assignees });
  } catch (error) {
    console.error('Error fetching project assignees:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_ERROR', 
        message: 'Failed to fetch project assignees' 
      } 
    });
  }
});

// POST /api/projects/:id/assignees - Add assignee to project
router.post('/:id/assignees', (req, res) => {
  try {
    const { id } = req.params;
    const { person_id, role } = req.body;
    
    if (!person_id) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Person ID is required' 
        } 
      });
    }
    
    // Check if project exists
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Project not found' 
        } 
      });
    }
    
    // Check if person exists
    const person = db.prepare('SELECT * FROM people WHERE id = ?').get(person_id);
    if (!person) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Person not found' 
        } 
      });
    }
    
    // Validate role
    const assignmentRole = role || 'member';
    if (!VALID_PROJECT_ROLES.includes(assignmentRole)) {
      return res.status(400).json({ 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `Invalid role. Must be one of: ${VALID_PROJECT_ROLES.join(', ')}` 
        } 
      });
    }
    
    // Check if already assigned (handle UNIQUE constraint)
    const existing = db.prepare('SELECT id FROM project_assignees WHERE project_id = ? AND person_id = ?').get(id, person_id);
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        error: { 
          code: 'CONFLICT_ERROR', 
          message: 'Person is already assigned to this project' 
        } 
      });
    }
    
    const assignmentId = crypto.randomUUID();
    
    db.prepare(`
      INSERT INTO project_assignees (id, project_id, person_id, role) 
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
  } catch (error) {
    console.error('Error adding project assignee:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'CREATE_ERROR', 
        message: 'Failed to add project assignee' 
      } 
    });
  }
});

// DELETE /api/projects/:id/assignees/:assigneeId - Remove assignee from project
router.delete('/:id/assignees/:assigneeId', (req, res) => {
  try {
    const { id, assigneeId } = req.params;
    
    const result = db.prepare('DELETE FROM project_assignees WHERE project_id = ? AND id = ?').run(id, assigneeId);
    
    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Assignment not found' 
        } 
      });
    }
    
    res.json({ success: true, message: 'Assignee removed from project' });
  } catch (error) {
    console.error('Error removing project assignee:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'DELETE_ERROR', 
        message: 'Failed to remove project assignee' 
      } 
    });
  }
});

module.exports = router;
