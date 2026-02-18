import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Menu,
  Plus,
  Moon,
  Sun,
  MoreHorizontal,
  Settings,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useProjects } from '../../context/ProjectContext';
import { Button } from '../common/Button';

interface HeaderProps {
  onAddTask?: () => void;
  onAddProject?: () => void;
}

export function Header({ onAddTask, onAddProject }: HeaderProps) {
  const { sidebarOpen, toggleSidebar, darkMode, toggleDarkMode, currentView } = useApp();
  const { currentProject } = useProjects();
  
  const viewLabels: Record<string, string> = {
    kanban: 'Kanban Board',
    list: 'List View',
    calendar: 'Calendar',
    timeline: 'Timeline',
    dashboard: 'Dashboard',
  };
  
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <button
          onClick={toggleSidebar}
          className={twMerge(
            clsx(
              'p-2 rounded-md text-gray-500 hover:text-gray-700',
              'dark:text-gray-400 dark:hover:text-gray-200',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'transition-colors duration-200',
              'lg:hidden'
            )
          )}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Project Title & View */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {currentProject && (
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: currentProject.color }}
                aria-hidden="true"
              />
            )}
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {currentProject?.name || 'Task Tracking'}
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {viewLabels[currentView] || 'Tasks'}
          </p>
        </div>
      </div>
      
      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Add Task Button */}
        {currentProject && onAddTask && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onAddTask}
            className="hidden sm:inline-flex"
          >
            Add Task
          </Button>
        )}
        
        {/* Mobile Add Button */}
        {currentProject && onAddTask && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddTask}
            className="sm:hidden"
            aria-label="Add task"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
        
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className={twMerge(
            clsx(
              'p-2 rounded-md text-gray-500 hover:text-gray-700',
              'dark:text-gray-400 dark:hover:text-gray-200',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'transition-colors duration-200'
            )
          )}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>
        
        {/* More Options */}
        <div className="relative">
          <button
            className={twMerge(
              clsx(
                'p-2 rounded-md text-gray-500 hover:text-gray-700',
                'dark:text-gray-400 dark:hover:text-gray-200',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors duration-200'
              )
            )}
            aria-label="More options"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
