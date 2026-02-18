import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Project, CreateProjectDTO, UpdateProjectDTO } from '../types';
import * as api from '../services/api';

interface ProjectContextType {
  // State
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchProjects: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  setCurrentProjectById: (id: number | null) => void;
  createProject: (data: CreateProjectDTO) => Promise<Project>;
  updateProject: (id: number, data: UpdateProjectDTO) => Promise<Project>;
  deleteProject: (id: number) => Promise<void>;
  clearError: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
  currentProjectId?: number | null;
}

export function ProjectProvider({ children, currentProjectId }: ProjectProviderProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch all projects
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.getProjects();
      setProjects(data);
      
      // Set current project if not already set
      if (!currentProject && data.length > 0) {
        if (currentProjectId) {
          const found = data.find(p => p.id === currentProjectId);
          if (found) {
            setCurrentProject(found);
          }
        } else {
          setCurrentProject(data[0]);
        }
      } else if (currentProjectId) {
        const found = data.find(p => p.id === currentProjectId);
        if (found) {
          setCurrentProject(found);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [currentProject, currentProjectId]);
  
  // Set current project by ID
  const setCurrentProjectById = useCallback((id: number | null) => {
    if (id === null) {
      setCurrentProject(null);
      return;
    }
    
    const project = projects.find(p => p.id === id);
    if (project) {
      setCurrentProject(project);
    }
  }, [projects]);
  
  // Create a new project
  const createProject = useCallback(async (data: CreateProjectDTO): Promise<Project> => {
    setLoading(true);
    setError(null);
    
    try {
      const newProject = await api.createProject(data);
      setProjects(prev => [...prev, newProject]);
      return newProject;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Update an existing project
  const updateProject = useCallback(async (id: number, data: UpdateProjectDTO): Promise<Project> => {
    setLoading(true);
    setError(null);
    
    try {
      const updatedProject = await api.updateProject(id, data);
      setProjects(prev => 
        prev.map(p => p.id === id ? updatedProject : p)
      );
      
      // Update current project if it's the one being edited
      if (currentProject?.id === id) {
        setCurrentProject(updatedProject);
      }
      
      return updatedProject;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update project';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);
  
  // Delete a project
  const deleteProject = useCallback(async (id: number): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await api.deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      
      // If the deleted project was the current one, select another
      if (currentProject?.id === id) {
        const remainingProjects = projects.filter(p => p.id !== id);
        setCurrentProject(remainingProjects.length > 0 ? remainingProjects[0] : null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentProject, projects]);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);
  
  // Update current project when currentProjectId changes
  useEffect(() => {
    if (currentProjectId !== undefined && currentProjectId !== null) {
      setCurrentProjectById(currentProjectId);
    }
  }, [currentProjectId, setCurrentProjectById]);
  
  const value: ProjectContextType = {
    projects,
    currentProject,
    loading,
    error,
    fetchProjects,
    setCurrentProject,
    setCurrentProjectById,
    createProject,
    updateProject,
    deleteProject,
    clearError,
  };
  
  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}

export default ProjectContext;
