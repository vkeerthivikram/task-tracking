'use client';

import React, { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react';
import { createCrudContext } from './utils/createCrudContext';
import type { Tag, CreateTagDTO, UpdateTagDTO } from '../types';
import * as api from '../services/api';
import { filterByProject } from '../utils/filterByProject';

interface TagContextType {
  // State
  tags: Tag[];
  availableTags: Tag[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchTags: () => Promise<void>;
  fetchAvailableTags: (projectId: number) => Promise<void>;
  createTag: (data: CreateTagDTO) => Promise<Tag>;
  updateTag: (id: number, data: UpdateTagDTO) => Promise<Tag>;
  deleteTag: (id: number) => Promise<void>;
  clearError: () => void;
  
  // Helpers
  getTagById: (id: number) => Tag | undefined;
}

// Create base CRUD context
const { Provider: BaseProvider, useHook: useBaseHook, Context } = createCrudContext<Tag, CreateTagDTO, UpdateTagDTO>({
  entityName: 'tag',
  fetchAll: api.getTags,
  fetchOne: (id: string | number) => api.getTag(Number(id)),
  create: api.createTag,
  update: (id: string | number, data: UpdateTagDTO) => api.updateTag(Number(id), data),
  delete: (id: string | number) => api.deleteTag(Number(id)),
});

// Create extended context for additional functionality
const TagContext = createContext<TagContextType | undefined>(undefined);

interface TagProviderProps {
  children: ReactNode;
  projectId?: number | null;
}

function TagProvider({ children, projectId }: TagProviderProps) {
  return (
    <BaseProvider>
      <TagProviderInner projectId={projectId}>
        {children}
      </TagProviderInner>
    </BaseProvider>
  );
}

function TagProviderInner({ children, projectId }: TagProviderProps) {
  const base = useBaseHook();

  // Filter tags available for current project (global + project-specific)
  const availableTags = useMemo(() => {
    return filterByProject(base.items, projectId);
  }, [base.items, projectId]);

  // Fetch available tags for a specific project
  // This refetches all tags to ensure state consistency
  // (The API with project_id returns global + project-specific tags)
  const fetchAvailableTags = useCallback(async (projId: number) => {
    // Fetch project-specific tags and merge with existing
    const data = await api.getTags(projId);
    const existingIds = new Set(base.items.map(t => t.id));
    const newTags = data.filter(t => !existingIds.has(t.id));

    // If we found new tags, refetch all to get complete state
    // This ensures consistency while avoiding manual state manipulation
    if (newTags.length > 0) {
      await base.fetchAll();
    }
  }, [base.items, base.fetchAll]);

  const value: TagContextType = useMemo(() => ({
    tags: base.items,
    availableTags,
    loading: base.loading,
    error: base.error,
    fetchTags: base.fetchAll,
    fetchAvailableTags,
    createTag: base.create,
    updateTag: base.update,
    deleteTag: base.delete,
    clearError: base.clearError,
    getTagById: base.getById,
  }), [
    base.items,
    base.loading,
    base.error,
    base.fetchAll,
    base.create,
    base.update,
    base.delete,
    base.clearError,
    base.getById,
    availableTags,
    fetchAvailableTags,
  ]);

  return (
    <TagContext.Provider value={value}>
      {children}
    </TagContext.Provider>
  );
}

export function useTags(): TagContextType {
  const context = useContext(TagContext);
  if (context === undefined) {
    throw new Error('useTags must be used within a TagProvider');
  }
  return context;
}

export { TagProvider };
export default TagContext;
