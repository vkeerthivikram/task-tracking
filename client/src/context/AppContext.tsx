'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { ViewType, ModalState, Task, Project, Person, AppTheme } from '../types';
import { APP_THEME_OPTIONS } from '../types';

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
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [theme, setThemeState] = useState<AppTheme>('taskflow-light');
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
  
  const isDarkTheme = useCallback((themeName: AppTheme) => {
    const themeOption = APP_THEME_OPTIONS.find(option => option.value === themeName);
    return themeOption?.mode === 'dark';
  }, []);

  const applyThemeToDom = useCallback((themeName: AppTheme) => {
    document.documentElement.setAttribute('data-theme', themeName);
    if (isDarkTheme(themeName)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkTheme]);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as AppTheme | null;
    const isValidStoredTheme = storedTheme !== null && APP_THEME_OPTIONS.some(option => option.value === storedTheme);

    if (isValidStoredTheme && storedTheme) {
      setThemeState(storedTheme);
      applyThemeToDom(storedTheme);
    } else {
      // Backward compatibility with previous darkMode storage key
      const legacyDarkMode = localStorage.getItem('darkMode');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldUseDark = legacyDarkMode !== null ? JSON.parse(legacyDarkMode) : prefersDark;
      const fallbackTheme: AppTheme = shouldUseDark ? 'taskflow-dark' : 'taskflow-light';
      setThemeState(fallbackTheme);
      applyThemeToDom(fallbackTheme);
    }
  }, [applyThemeToDom]);
  
  // Update DOM and localStorage when theme changes
  useEffect(() => {
    applyThemeToDom(theme);
    localStorage.setItem('theme', theme);
    localStorage.setItem('darkMode', JSON.stringify(isDarkTheme(theme)));
  }, [theme, applyThemeToDom, isDarkTheme]);
  
  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);
  
  const setTheme = useCallback((themeName: AppTheme) => {
    setThemeState(themeName);
  }, []);

  const darkMode = isDarkTheme(theme);

  const toggleDarkMode = useCallback(() => {
    setThemeState(prevTheme => isDarkTheme(prevTheme) ? 'taskflow-light' : 'taskflow-dark');
  }, [isDarkTheme]);
  
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
    theme,
    setTheme,
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
