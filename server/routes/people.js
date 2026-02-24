const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');
const { asyncHandler, Errors } = require('../middleware/asyncHandler');
const { validateExists, validateRelatedExists } = require('../middleware/validateExists');

// GET /api/people - List all people with optional project filter
router.get('/', asyncHandler(async (req, res) => {
  const { project_id } = req.query;
  
  let query = 'SELECT * FROM people WHERE 1=1';
  const params = [];
  
  if (project_id) {
    query += ' AND project_id = ?';
    params.push(project_id);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const people = db.prepare(query).all(...params);
  res.json({ success: true, data: people });
}));

// GET /api/people/:id - Get single person
router.get('/:id', validateExists('people', 'id', 'Person'), (req, res) => {
  res.json({ success: true, data: req.entity });
});

// POST /api/people - Create person
router.post('/', validateRelatedExists('projects', 'project_id', 'Project'), asyncHandler(async (req, res) => {
  const { name, email, company, designation, project_id } = req.body;
  
  if (!name || name.trim() === '') {
    throw Errors.validation('Person name is required');
  }
  
  const id = crypto.randomUUID();
  
  db.prepare(`
    INSERT INTO people (id, name, email, company, designation, project_id) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id, 
    name.trim(), 
    email?.trim() || null, 
    company?.trim() || null, 
    designation?.trim() || null, 
    project_id || null
  );
  
  const newPerson = db.prepare('SELECT * FROM people WHERE id = ?').get(id);
  res.status(201).json({ success: true, data: newPerson });
}));

// PUT /api/people/:id - Update person
router.put('/:id', 
  validateExists('people', 'id', 'Person'),
  validateRelatedExists('projects', 'project_id', 'Project'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, company, designation, project_id } = req.body;
    
    db.prepare(`
      UPDATE people 
      SET name = COALESCE(?, name), 
          email = COALESCE(?, email), 
          company = COALESCE(?, company), 
          designation = COALESCE(?, designation), 
          project_id = COALESCE(?, project_id), 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : null,
      email !== undefined ? (email?.trim() || null) : null,
      company !== undefined ? (company?.trim() || null) : null,
      designation !== undefined ? (designation?.trim() || null) : null,
      project_id !== undefined ? project_id : null,
      id
    );
    
    const updatedPerson = db.prepare('SELECT * FROM people WHERE id = ?').get(id);
    res.json({ success: true, data: updatedPerson });
  })
);

// DELETE /api/people/:id - Delete person
router.delete('/:id', validateExists('people', 'id', 'Person'), asyncHandler(async (req, res) => {
  db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Person deleted successfully' });
}));

module.exports = router;
