import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { Task, TaskFilters, CreateTaskDTO, UpdateTaskDTO, TaskStatus } from '../types';
import * as api from '../services/api';

interface TaskContextType {
  // State
  tasks: Task[];
  filteredTasks: Task[];
  loading: boolean;
  error: string | null;
  
  // Filters
  filters: TaskFilters;
  setFilters: (filters: TaskFilters) => void;
  updateFilter: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void;
  clearFilters: () => void;
  
  // Actions
  fetchTasks: (filters?: TaskFilters) => Promise<void>;
  fetchTasksByProject: (projectId: number) => Promise<void>;
  createTask: (data: CreateTaskDTO) => Promise<Task>;
  updateTask: (id: number, data: UpdateTaskDTO) => Promise<Task>;
  updateTaskStatus: (id: number, status: TaskStatus) => Promise<Task>;
  deleteTask: (id: number) => Promise<void>;
  clearError: () => void;
  
  // Helpers
  getTaskById: (id: number) => Task | undefined;
  getTasksByStatus: (status: TaskStatus) => Task[];
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

interface TaskProviderProps {
  children: ReactNode;
  projectId?: number | null;
}

const DEFAULT_FILTERS: TaskFilters = {};

export function TaskProvider({ children, projectId }: TaskProviderProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<TaskFilters>(DEFAULT_FILTERS);
  
  // Apply filters to tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    
    if (filters.project_id !== undefined) {
      result = result.filter(t => t.project_id === filters.project_id);
    }
    
    if (filters.status) {
      result = result.filter(t => t.status === filters.status);
    }
    
    if (filters.priority) {
      result = result.filter(t => t.priority === filters.priority);
    }
    
    if (filters.due_date_from) {
      result = result.filter(t => 
        t.due_date && new Date(t.due_date) >= new Date(filters.due_date_from!)
      );
    }
    
    if (filters.due_date_to) {
      result = result.filter(t => 
        t.due_date && new Date(t.due_date) <= new Date(filters.due_date_to!)
      );
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }
    
    return result;
  }, [tasks, filters]);
  
  // Fetch all tasks (optionally with filters)
  const fetchTasks = useCallback(async (fetchFilters?: TaskFilters) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.getTasks(fetchFilters);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Fetch tasks by project
  const fetchTasksByProject = useCallback(async (projId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.getTasks({ project_id: projId });
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Set filters
  const setFilters = useCallback((newFilters: TaskFilters) => {
    setFiltersState(newFilters);
  }, []);
  
  // Update a single filter
  const updateFilter = useCallback(<K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    setFiltersState(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);
  
  // Create a new task
  const createTask = useCallback(async (data: CreateTaskDTO): Promise<Task> => {
    setLoading(true);
    setError(null);
    
    try {
      const newTask = await api.createTask(data);
      setTasks(prev => [...prev, newTask]);
      return newTask;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Update an existing task
  const updateTask = useCallback(async (id: number, data: UpdateTaskDTO): Promise<Task> => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedTask = await api.updateTask(id, data);
      setTasks(prev => 
        prev.map(t => t.id === id ? updatedTask : t)
      );
      return updatedTask;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Update task status (for Kanban drag-and-drop)
  const updateTaskStatus = useCallback(async (id: number, status: TaskStatus): Promise<Task> => {
    // Optimistic update
    setTasks(prev => 
      prev.map(t => t.id === id ? { ...t, status } : t)
    );
    
    try {
      const updatedTask = await api.updateTaskStatus(id, status);
      // Update with server response
      setTasks(prev => 
        prev.map(t => t.id === id ? updatedTask : t)
      );
      return updatedTask;
    } catch (err) {
      // Revert on error
      setTasks(prev => 
        prev.map(t => {
          if (t.id === id) {
            const originalTask = tasks.find(orig => orig.id === id);
            return originalTask || t;
          }
          return t;
        })
      );
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task status';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [tasks]);
  
  // Delete a task
  const deleteTask = useCallback(async (id: number): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await api.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete task';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Get task by ID
  const getTaskById = useCallback((id: number): Task | undefined => {
    return tasks.find(t => t.id === id);
  }, [tasks]);
  
  // Get tasks by status
  const getTasksByStatus = useCallback((status: TaskStatus): Task[] => {
    return filteredTasks.filter(t => t.status === status);
  }, [filteredTasks]);
  
  // Fetch tasks when projectId changes
  useEffect(() => {
    if (projectId !== undefined && projectId !== null) {
      fetchTasksByProject(projectId);
      setFiltersState(prev => ({ ...prev, project_id: projectId }));
    } else {
      fetchTasks();
    }
  }, [projectId, fetchTasks, fetchTasksByProject]);
  
  const value: TaskContextType = {
    tasks,
    filteredTasks,
    loading,
    error,
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    fetchTasks,
    fetchTasksByProject,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    clearError,
    getTaskById,
    getTasksByStatus,
  };
  
  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks(): TaskContextType {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}

export default TaskContext;
