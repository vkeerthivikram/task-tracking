'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';

/**
 * Configuration for creating a CRUD context
 */
interface CrudConfig<T, CreateDTO, UpdateDTO> {
  /** Entity name for error messages and hook naming */
  entityName: string;
  /** Function to fetch all items */
  fetchAll: () => Promise<T[]>;
  /** Optional function to fetch a single item by ID */
  fetchOne?: (id: string | number) => Promise<T>;
  /** Function to create a new item */
  create: (data: CreateDTO) => Promise<T>;
  /** Function to update an existing item */
  update: (id: string | number, data: UpdateDTO) => Promise<T>;
  /** Function to delete an item */
  delete: (id: string | number) => Promise<void>;
  /** Whether to support project-based filtering */
  filterByProject?: boolean;
}

/**
 * State managed by the CRUD context
 */
interface CrudState<T> {
  /** Array of fetched items */
  items: T[];
  /** Loading state indicator */
  loading: boolean;
  /** Error message if any operation failed */
  error: string | null;
}

/**
 * Actions available in the CRUD context
 */
interface CrudActions<T, CreateDTO, UpdateDTO> {
  /** Fetch all items from the API */
  fetchAll: () => Promise<void>;
  /** Fetch a single item by ID */
  fetchOne: (id: string | number) => Promise<T | null>;
  /** Create a new item */
  create: (data: CreateDTO) => Promise<T>;
  /** Update an existing item */
  update: (id: string | number, data: UpdateDTO) => Promise<T>;
  /** Delete an item */
  delete: (id: string | number) => Promise<void>;
  /** Clear the current error state */
  clearError: () => void;
  /** Get an item by ID from local state */
  getById: (id: string | number) => T | undefined;
}

/**
 * Combined state and actions type for the context value
 */
type CrudContextValue<T, CreateDTO, UpdateDTO> = CrudState<T> & CrudActions<T, CreateDTO, UpdateDTO>;

/**
 * Factory function that generates a CRUD context with Provider and hook.
 * 
 * This eliminates repetitive boilerplate when creating contexts for entities
 * that follow the standard CRUD pattern (fetch all, fetch one, create, update, delete).
 * 
 * @example
 * ```typescript
 * // Create the context
 * const { Provider: TagProvider, useHook: useTags } = createCrudContext<Tag, CreateTagDTO, UpdateTagDTO>({
 *   entityName: 'tag',
 *   fetchAll: api.getTags,
 *   fetchOne: api.getTag,
 *   create: api.createTag,
 *   update: api.updateTag,
 *   delete: api.deleteTag,
 * });
 * 
 * // Use in component
 * function TagList() {
 *   const { items, loading, error, create, update, delete } = useTags();
 *   // ...
 * }
 * ```
 * 
 * @param config - Configuration object with entity name and CRUD functions
 * @returns Object containing Provider component, useHook function, and Context object
 */
export function createCrudContext<T extends { id: string | number }, CreateDTO, UpdateDTO>(
  config: CrudConfig<T, CreateDTO, UpdateDTO>
) {
  const { 
    entityName, 
    fetchAll, 
    fetchOne, 
    create: createItem, 
    update: updateItem, 
    delete: deleteItem,
    filterByProject 
  } = config;
  
  // Create the context with undefined default
  const Context = createContext<CrudContextValue<T, CreateDTO, UpdateDTO> | undefined>(undefined);
  
  /**
   * Provider component that manages CRUD state and provides actions
   */
  function Provider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    /**
     * Fetch all items from the API
     */
    const handleFetchAll = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAll();
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to fetch ${entityName}`);
      } finally {
        setLoading(false);
      }
    }, []);
    
    /**
     * Fetch a single item by ID
     * Returns null if fetchOne is not configured or on error
     */
    const handleFetchOne = useCallback(async (id: string | number): Promise<T | null> => {
      if (!fetchOne) return null;
      setLoading(true);
      setError(null);
      try {
        return await fetchOne(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to fetch ${entityName}`);
        return null;
      } finally {
        setLoading(false);
      }
    }, []);
    
    /**
     * Create a new item
     * On success, adds the new item to local state
     * On error, sets error state and rethrows
     */
    const handleCreate = useCallback(async (data: CreateDTO): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        const newItem = await createItem(data);
        setItems(prev => [...prev, newItem]);
        return newItem;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : `Failed to create ${entityName}`;
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    }, []);
    
    /**
     * Update an existing item
     * On success, updates the item in local state
     * On error, sets error state and rethrows
     */
    const handleUpdate = useCallback(async (id: string | number, data: UpdateDTO): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        const updatedItem = await updateItem(id, data);
        setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
        return updatedItem;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : `Failed to update ${entityName}`;
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    }, []);
    
    /**
     * Delete an item
     * On success, removes the item from local state
     * On error, sets error state and rethrows
     */
    const handleDelete = useCallback(async (id: string | number): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await deleteItem(id);
        setItems(prev => prev.filter(item => item.id !== id));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : `Failed to delete ${entityName}`;
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    }, []);
    
    /**
     * Clear the current error state
     */
    const clearError = useCallback(() => setError(null), []);
    
    /**
     * Get an item by ID from local state
     */
    const getById = useCallback((id: string | number): T | undefined => {
      return items.find(item => item.id === id);
    }, [items]);
    
    // Fetch all items on mount
    useEffect(() => {
      handleFetchAll();
    }, [handleFetchAll]);
    
    // Memoize the context value to prevent unnecessary re-renders
    const value: CrudContextValue<T, CreateDTO, UpdateDTO> = useMemo(() => ({
      items,
      loading,
      error,
      fetchAll: handleFetchAll,
      fetchOne: handleFetchOne,
      create: handleCreate,
      update: handleUpdate,
      delete: handleDelete,
      clearError,
      getById,
    }), [
      items, 
      loading, 
      error, 
      handleFetchAll, 
      handleFetchOne, 
      handleCreate, 
      handleUpdate, 
      handleDelete, 
      clearError, 
      getById
    ]);
    
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }
  
  /**
   * Custom hook to access the CRUD context
   * Throws an error if used outside of the Provider
   */
  function useHook(): CrudContextValue<T, CreateDTO, UpdateDTO> {
    const context = useContext(Context);
    if (context === undefined) {
      throw new Error(`${entityName} context must be used within its provider`);
    }
    return context;
  }
  
  return { Provider, useHook, Context };
}

/**
 * Type exports for consumers
 */
export type { CrudConfig, CrudState, CrudActions, CrudContextValue };
