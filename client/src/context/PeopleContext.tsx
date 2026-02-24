'use client';

import React, { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react';
import type { Person, CreatePersonDTO, UpdatePersonDTO } from '../types';
import * as api from '../services/api';
import { createCrudContext } from './utils/createCrudContext';

interface PeopleContextType {
  // State
  people: Person[];
  projectPeople: Person[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchPeople: () => Promise<void>;
  fetchPeopleByProject: (projectId: number) => Promise<void>;
  createPerson: (data: CreatePersonDTO) => Promise<Person>;
  updatePerson: (id: number, data: UpdatePersonDTO) => Promise<Person>;
  deletePerson: (id: number) => Promise<void>;
  clearError: () => void;
  
  // Helpers
  getPersonById: (id: number) => Person | undefined;
}

// Utility function to filter people by project
function filterByProject(people: Person[], projectId: number | null | undefined): Person[] {
  if (!projectId) {
    return people;
  }
  return people.filter(p => p.project_id === undefined || p.project_id === null || p.project_id === projectId);
}

// Wrapper functions to adapt API signatures to factory expectations
const personApi = {
  fetchAll: api.getPeople,
  fetchOne: (id: string | number) => api.getPerson(Number(id)),
  create: api.createPerson,
  update: (id: string | number, data: UpdatePersonDTO) => api.updatePerson(Number(id), data),
  delete: (id: string | number) => api.deletePerson(Number(id)),
};

// Create the base CRUD context using the factory
const { Provider: BaseProvider, useHook: useBasePeople, Context: BasePeopleContext } = createCrudContext<Person, CreatePersonDTO, UpdatePersonDTO>({
  entityName: 'person',
  fetchAll: personApi.fetchAll,
  fetchOne: personApi.fetchOne,
  create: personApi.create,
  update: personApi.update,
  delete: personApi.delete,
});

// Create the extended context for additional functionality
const PeopleContext = createContext<PeopleContextType | undefined>(undefined);

interface PeopleProviderProps {
  children: ReactNode;
  projectId?: number | null;
}

/**
 * Internal component that extends the base CRUD context with project-specific functionality.
 * Must be used inside BaseProvider.
 */
function PeopleProviderInner({ children, projectId }: PeopleProviderProps) {
  // Get base CRUD functionality
  const { 
    items: people, 
    loading, 
    error, 
    fetchAll: fetchPeople, 
    create: baseCreatePerson, 
    update: baseUpdatePerson, 
    delete: baseDeletePerson,
    clearError,
    getById: baseGetPersonById,
  } = useBasePeople();
  
  // Filter people by current project using the utility
  const projectPeople = useMemo(() => {
    return filterByProject(people, projectId);
  }, [people, projectId]);
  
  // Fetch people by project - uses the base fetchPeople which refreshes all data
  // The projectPeople computed property will filter appropriately
  const fetchPeopleByProject = useCallback(async (projId: number) => {
    // Fetch with project filter from API
    await api.getPeople(projId);
    // Then refresh local state via base fetch
    await fetchPeople();
  }, [fetchPeople]);
  
  // Map factory methods to existing interface names
  const createPerson = useCallback(async (data: CreatePersonDTO): Promise<Person> => {
    return baseCreatePerson(data);
  }, [baseCreatePerson]);
  
  const updatePerson = useCallback(async (id: number, data: UpdatePersonDTO): Promise<Person> => {
    return baseUpdatePerson(id, data);
  }, [baseUpdatePerson]);
  
  const deletePerson = useCallback(async (id: number): Promise<void> => {
    return baseDeletePerson(id);
  }, [baseDeletePerson]);
  
  const getPersonById = useCallback((id: number): Person | undefined => {
    return baseGetPersonById(id);
  }, [baseGetPersonById]);
  
  const value: PeopleContextType = useMemo(() => ({
    people,
    projectPeople,
    loading,
    error,
    fetchPeople,
    fetchPeopleByProject,
    createPerson,
    updatePerson,
    deletePerson,
    clearError,
    getPersonById,
  }), [
    people,
    projectPeople,
    loading,
    error,
    fetchPeople,
    fetchPeopleByProject,
    createPerson,
    updatePerson,
    deletePerson,
    clearError,
    getPersonById,
  ]);
  
  return (
    <PeopleContext.Provider value={value}>
      {children}
    </PeopleContext.Provider>
  );
}

/**
 * PeopleProvider - Provides people context with CRUD operations and project filtering.
 * Wraps the base CRUD provider internally for self-contained usage.
 */
export function PeopleProvider({ children, projectId }: PeopleProviderProps) {
  return (
    <BaseProvider>
      <PeopleProviderInner projectId={projectId}>
        {children}
      </PeopleProviderInner>
    </BaseProvider>
  );
}

export function usePeople(): PeopleContextType {
  const context = useContext(PeopleContext);
  if (context === undefined) {
    throw new Error('usePeople must be used within a PeopleProvider');
  }
  return context;
}

export default PeopleContext;
