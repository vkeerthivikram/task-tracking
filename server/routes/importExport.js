const express = require('express');
const router = express.Router();
const db = require('../db/database');
const path = require('path');
const fs = require('fs');

// Current version for export format
const EXPORT_VERSION = '1.6.0';

// List of all tables in the order they should be imported (respecting foreign keys)
const TABLE_ORDER = [
  'projects',
  'people',
  'tags',
  'tasks',
  'task_assignees',
  'task_tags',
  'project_assignees',
  'notes',
  'custom_fields',
  'custom_field_values',
  'saved_views'
];

/**
 * GET /api/export
 * Export all database tables as a single JSON object
 */
router.get('/', (req, res) => {
  try {
    const exportData = {};
    
    // Export each table
    for (const table of TABLE_ORDER) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      exportData[table] = rows;
    }
    
    // Build the export payload
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      data: exportData
    };
    
    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `celestask-export-${dateStr}.json`;
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json(payload);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: error.message || 'Failed to export database'
      }
    });
  }
});

/**
 * POST /api/import
 * Import data from JSON export
 * Query params:
 *   - mode: 'merge' (default) or 'replace'
 */
router.post('/', (req, res) => {
  try {
    const { mode = 'merge' } = req.query;
    
    // Validate mode
    if (!['merge', 'replace'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MODE',
          message: "Mode must be 'merge' or 'replace'"
        }
      });
    }
    
    // Validate request body structure
    const importPayload = req.body;
    
    if (!importPayload || typeof importPayload !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Request body must be a valid JSON object'
        }
      });
    }
    
    if (!importPayload.data || typeof importPayload.data !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Payload must contain a "data" object with table data'
        }
      });
    }
    
    const { data } = importPayload;
    
    // Validate that at least one valid table exists
    const validTables = TABLE_ORDER.filter(table => 
      Array.isArray(data[table])
    );
    
    if (validTables.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Payload must contain at least one valid table array'
        }
      });
    }
    
    const summary = {};
    const errors = [];
    
    // Run in a transaction for atomicity
    const importTransaction = db.transaction(() => {
      // If replace mode, clear all existing data first (in reverse order to handle FKs)
      if (mode === 'replace') {
        for (const table of [...TABLE_ORDER].reverse()) {
          try {
            db.exec(`DELETE FROM ${table}`);
          } catch (err) {
            // Table might not have data, continue
          }
        }
      }
      
      // Import each table in order
      for (const table of TABLE_ORDER) {
        if (!Array.isArray(data[table]) || data[table].length === 0) {
          summary[table] = { imported: 0, skipped: 0, errors: 0 };
          continue;
        }
        
        const rows = data[table];
        let imported = 0;
        let skipped = 0;
        let errorCount = 0;
        
        // Get table column info for dynamic insertion
        const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all();
        const columns = tableInfo.map(col => col.name);
        
        for (const row of rows) {
          try {
            // Filter row data to only include valid columns
            const validColumns = columns.filter(col => row.hasOwnProperty(col));
            
            if (validColumns.length === 0) {
              skipped++;
              continue;
            }
            
            if (mode === 'merge') {
              // Check if record exists
              const existingRecord = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(row.id);
              
              if (existingRecord) {
                // Update existing record
                const setClause = validColumns
                  .filter(col => col !== 'id')
                  .map(col => `${col} = @${col}`)
                  .join(', ');
                
                if (setClause) {
                  const updateStmt = db.prepare(
                    `UPDATE ${table} SET ${setClause} WHERE id = @id`
                  );
                  updateStmt.run(row);
                  imported++;
                } else {
                  skipped++;
                }
              } else {
                // Insert new record
                const colList = validColumns.join(', ');
                const paramList = validColumns.map(col => `@${col}`).join(', ');
                
                const insertStmt = db.prepare(
                  `INSERT INTO ${table} (${colList}) VALUES (${paramList})`
                );
                insertStmt.run(row);
                imported++;
              }
            } else {
              // Replace mode - just insert (tables already cleared)
              const colList = validColumns.join(', ');
              const paramList = validColumns.map(col => `@${col}`).join(', ');
              
              const insertStmt = db.prepare(
                `INSERT INTO ${table} (${colList}) VALUES (${paramList})`
              );
              insertStmt.run(row);
              imported++;
            }
          } catch (err) {
            errorCount++;
            errors.push({
              table,
              id: row.id || 'unknown',
              error: err.message
            });
          }
        }
        
        summary[table] = { imported, skipped, errors: errorCount };
      }
    });
    
    // Execute the import transaction
    try {
      importTransaction();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'IMPORT_FAILED',
          message: err.message || 'Import transaction failed'
        }
      });
    }
    
    // Calculate totals
    const totals = {
      imported: Object.values(summary).reduce((sum, s) => sum + s.imported, 0),
      skipped: Object.values(summary).reduce((sum, s) => sum + s.skipped, 0),
      errors: Object.values(summary).reduce((sum, s) => sum + s.errors, 0)
    };
    
    // Build response
    const response = {
      success: true,
      data: {
        mode,
        summary,
        totals,
        importedAt: new Date().toISOString()
      }
    };
    
    // Include error details if any
    if (errors.length > 0) {
      response.data.errorDetails = errors.slice(0, 50); // Limit to first 50 errors
      response.data.totalErrors = errors.length;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'IMPORT_ERROR',
        message: error.message || 'Failed to import data'
      }
    });
  }
});

/**
 * GET /api/export/sqlite
 * Download the actual SQLite database file for binary backup
 */
router.get('/sqlite', (req, res) => {
  try {
    const dbPath = path.join(__dirname, '..', 'data', 'celestask.db');
    
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DATABASE_NOT_FOUND',
          message: 'Database file not found'
        }
      });
    }
    
    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `celestask-backup-${dateStr}.db`;
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(dbPath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            code: 'STREAM_ERROR',
            message: 'Failed to stream database file'
          }
        });
      }
    });
  } catch (error) {
    console.error('SQLite export error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: error.message || 'Failed to export database file'
      }
    });
  }
});

/**
 * GET /api/export/status
 * Get export/import status and metadata
 */
router.get('/status', (req, res) => {
  try {
    const stats = {};
    
    // Get record counts for each table
    for (const table of TABLE_ORDER) {
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      stats[table] = result.count;
    }
    
    res.json({
      success: true,
      data: {
        version: EXPORT_VERSION,
        tableStats: stats,
        totalRecords: Object.values(stats).reduce((sum, count) => sum + count, 0),
        supportedTables: TABLE_ORDER
      }
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: error.message || 'Failed to get export status'
      }
    });
  }
});

module.exports = router;
