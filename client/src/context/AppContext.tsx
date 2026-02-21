'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { ViewType, ModalState, Task, Project, Person } from '../types';

interface AppContextType {
  // View state
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  
  // Current project
  currentProjectId: number | null;
  setCurrentProjectId: (id: number | null) => void;
  
  // Sidebar state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  // Modal state
  modal: ModalState;
  taskModalParentId: number | null;
  projectModalParentId: number | null;
  openTaskModal: (task?: Task, options?: { parentTaskId?: number | null }) => void;
  openSubTaskModal: (parentTaskId: number) => void;
  openProjectModal: (project?: Project, options?: { parentProjectId?: number | null }) => void;
  openSubProjectModal: (parentProjectId: number) => void;
  openPersonModal: (person?: Person) => void;
  openConfirmModal: (data: unknown) => void;
  openImportExportModal: () => void;
  closeModal: () => void;
  
  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // Initialize with false to match server-side render, will be updated by effect
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<ViewType>('kanban');
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [taskModalParentId, setTaskModalParentId] = useState<number | null>(null);
  const [projectModalParentId, setProjectModalParentId] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: null,
    data: null,
  });
  
  // Initialize dark mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) {
      const isDark = JSON.parse(stored);
      setDarkMode(isDark);
      // Sync with DOM in case the inline script didn't run
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);
  
  // Update DOM and localStorage when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);
  
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);
  
  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);
  
  const openTaskModal = useCallback((task?: Task, options?: { parentTaskId?: number | null }) => {
    setTaskModalParentId(options?.parentTaskId ?? null);
    setProjectModalParentId(null);
    setModal({
      isOpen: true,
      type: 'task',
      data: task,
    });
  }, []);

  const openSubTaskModal = useCallback((parentTaskId: number) => {
    openTaskModal(undefined, { parentTaskId });
  }, [openTaskModal]);
  
  const openProjectModal = useCallback((project?: Project, options?: { parentProjectId?: number | null }) => {
    setProjectModalParentId(options?.parentProjectId ?? null);
    setTaskModalParentId(null);
    setModal({
      isOpen: true,
      type: 'project',
      data: project,
    });
  }, []);

  const openSubProjectModal = useCallback((parentProjectId: number) => {
    openProjectModal(undefined, { parentProjectId });
  }, [openProjectModal]);

  const openPersonModal = useCallback((person?: Person) => {
    setTaskModalParentId(null);
    setProjectModalParentId(null);
    setModal({
      isOpen: true,
      type: 'person',
      data: person,
    });
  }, []);
  
  const openConfirmModal = useCallback((_data?: unknown) => {
    setTaskModalParentId(null);
    setProjectModalParentId(null);
    setModal({
      isOpen: true,
      type: 'confirm',
      data: null,
    });
  }, []);
  
  const openImportExportModal = useCallback(() => {
    setTaskModalParentId(null);
    setProjectModalParentId(null);
    setModal({
      isOpen: true,
      type: 'importExport',
      data: null,
    });
  }, []);
  
  const closeModal = useCallback(() => {
    setTaskModalParentId(null);
    setProjectModalParentId(null);
    setModal({
      isOpen: false,
      type: null,
      data: null,
    });
  }, []);
  
  const value: AppContextType = {
    currentView,
    setCurrentView,
    currentProjectId,
    setCurrentProjectId,
    sidebarOpen,
    toggleSidebar,
    setSidebarOpen,
    modal,
    taskModalParentId,
    projectModalParentId,
    openTaskModal,
    openSubTaskModal,
    openProjectModal,
    openSubProjectModal,
    openPersonModal,
    openConfirmModal,
    openImportExportModal,
    closeModal,
    darkMode,
    toggleDarkMode,
  };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
