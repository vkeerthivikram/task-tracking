# Celestask - AI Agent Coding Guide

## 1. Project Overview

Monorepo with `server/` (Express + SQLite) and `client/` (Next.js 15 + React). Local-first project management app.

**Requirements**: Node.js 22+ (specified in `engines: ">=22 <25"`)

---

## 2. Build/Lint/Test Commands

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies (root + server + client) |
| `make dev` | Start both servers (backend:19096, frontend:12096) |
| `make server` | Start backend server only |
| `make client` | Start frontend dev server only |
| `make build` | Build frontend for production |
| `make clean` | Remove all node_modules |
| `make db-reset` | Delete SQLite DB and reseed with sample data |
| `npm run lint` | Run ESLint on client (from `client/` directory) |

**Note**: No test framework is currently set up.

---

## 3. Project Structure

```
celestask/
├── server/                    # Express backend (CommonJS)
│   ├── index.js               # Entry point, route imports
│   ├── data/celestask.db      # SQLite database file
│   ├── db/                    # database.js, schema.js, seed.js
│   ├── middleware/            # asyncHandler.js, validateExists.js
│   └── routes/                # projects, tasks, people, tags, notes, etc.
│
└── client/                    # Next.js frontend (TypeScript)
    └── src/
        ├── app/               # App Router pages
        ├── types/index.ts     # All TypeScript definitions
        ├── services/api.ts    # Centralized API layer
        ├── context/           # React contexts (*Context.tsx)
        ├── hooks/             # Custom hooks
        ├── utils/             # Utility functions
        └── components/        # ui/, common/, layout/, kanban/, list/, etc.
```

---

## 4. Code Style Guidelines

### Imports Order

**Server (CommonJS)**: Built-ins → External → Local
```javascript
const express = require('express');
const crypto = require('crypto');
const db = require('../db/database');
const { asyncHandler, Errors } = require('../middleware/asyncHandler');
```

**Client (ESM/TypeScript)**: React → External → Types → API → Contexts → Components
```typescript
import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { Calendar, Users } from 'lucide-react';
import type { Task, CreateTaskDTO } from '../../types';
import * as api from '../../services/api';
import { useTasks } from '../../context/TaskContext';
import { Button } from '../common/Button';
import { formatDurationUs } from '@/utils/timeFormat';
```

### Formatting & Naming
- No Prettier config - follow existing patterns
- TypeScript strict mode enabled on client
- Use `clsx` + `tailwind-merge` for conditional Tailwind classes

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TaskForm.tsx` |
| Functions/variables | camelCase | `fetchTasks`, `taskId` |
| True constants | SCREAMING_SNAKE_CASE | `STATUS_CONFIG` |
| Context files | PascalCase + Context | `TaskContext.tsx` |

### Error Handling

**API Response Format**:
```typescript
{ success: true, data: T }  // Success
{ success: false, error: { code: string, message: string } }  // Error
```

**Server Routes** - Use `asyncHandler` wrapper and `Errors` object:
```javascript
const { asyncHandler, Errors } = require('../middleware/asyncHandler');

router.get('/:id', asyncHandler(async (req, res) => {
  const item = db.prepare('SELECT * FROM table WHERE id = ?').get(req.params.id);
  if (!item) throw Errors.notFound('Item');
  res.json({ success: true, data: item });
}));
```

**Error Codes**: `NOT_FOUND`, `VALIDATION_ERROR`, `FETCH_ERROR`, `CREATE_ERROR`, `UPDATE_ERROR`, `DELETE_ERROR`, `INTERNAL_ERROR`

### React/Next.js Patterns
- Use `'use client'` directive for client components
- Access contexts via hooks: `useApp()`, `useTasks()`, `useProjects()`, etc.
- URL as source of truth: project ID and view from `[projectId]/[view]` params
- Use `@/` path alias for imports from `client/src/`

---

## 5. Key Files to Reference

| Purpose | File |
|---------|------|
| All TypeScript types | `client/src/types/index.ts` |
| API service layer | `client/src/services/api.ts` |
| Error handling | `server/middleware/asyncHandler.js` |
| Database schema | `server/db/schema.js` |
| Context providers | `client/src/context/*Context.tsx` |
| Next.js config | `client/next.config.mjs` |
| Tailwind config | `client/tailwind.config.js` |

---

## 6. Common Tasks

### Adding a New API Endpoint
1. Add route in `server/routes/*.js`, wrap with `asyncHandler`
2. Return `{ success: true, data: ... }` or throw `Errors.*`
3. Add function in `client/src/services/api.ts`
4. Add types in `client/src/types/index.ts` if needed

### Adding a New React Component
1. Create in appropriate `client/src/components/` subdirectory
2. Add `'use client'` at top if using state/effects
3. Use contexts via hooks, follow existing patterns

### Modifying Database Schema
1. Edit `server/db/schema.js`
2. Run `make db-reset` (deletes existing data)
3. Update types in `client/src/types/index.ts`

---

## 7. Task Status & Priority Values

**Status**: `backlog`, `todo`, `in_progress`, `review`, `done`

**Priority**: `low`, `medium`, `high`, `urgent`

---

## 8. Ports

- Frontend dev server: `12096`
- Backend API server: `19096`
- API proxy: Next.js rewrites `/api/*` to backend
