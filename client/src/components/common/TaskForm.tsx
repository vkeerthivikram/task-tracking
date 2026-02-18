import React, { useState, useEffect, type FormEvent } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ClipboardList, Calendar, Flag, Loader2 } from 'lucide-react';
import type { Task, Project, CreateTaskDTO, UpdateTaskDTO, TaskStatus, TaskPriority } from '../../types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../types';
import { Button } from './Button';
import { StatusBadge } from './Badge';
import { PriorityBadge } from './Badge';

interface TaskFormProps {
  task?: Task | null;
  project?: Project | null;
  projectId?: number;
  onSubmit: (data: CreateTaskDTO | UpdateTaskDTO) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormData {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  start_date: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  due_date?: string;
  start_date?: string;
}

export function TaskForm({
  task,
  project,
  projectId: propProjectId,
  onSubmit,
  onCancel,
  isLoading = false,
}: TaskFormProps) {
  const isEditing = Boolean(task);
  const currentProjectId = task?.project_id || propProjectId || project?.id;
  
  const [formData, setFormData] = useState<FormData>({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
    start_date: task?.start_date ? task.start_date.split('T')[0] : '',
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Update form when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        start_date: task.start_date ? task.start_date.split('T')[0] : '',
      });
    }
  }, [task]);
  
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Task title must be less than 200 characters';
    }
    
    if (formData.description.length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters';
    }
    
    // Validate date range
    if (formData.start_date && formData.due_date) {
      const startDate = new Date(formData.start_date);
      const dueDate = new Date(formData.due_date);
      
      if (startDate > dueDate) {
        newErrors.start_date = 'Start date cannot be after due date';
        newErrors.due_date = 'Due date cannot be before start date';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      const data = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        start_date: formData.start_date || null,
        ...(isEditing ? {} : { project_id: currentProjectId }),
      };
      
      if (isEditing) {
        await onSubmit(data as UpdateTaskDTO);
      } else {
        await onSubmit(data as CreateTaskDTO);
      }
    } catch {
      // Error handling is done by the parent component
    }
  };
  
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Project Info (if available) */}
      {project && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 pb-2">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: project.color }}
          />
          <span>{project.name}</span>
        </div>
      )}
      
      {/* Task Title */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Task Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="Enter task title"
          className={twMerge(
            clsx(
              'w-full px-3 py-2 rounded-md border shadow-sm',
              'bg-white dark:bg-gray-900',
              'text-gray-900 dark:text-gray-100',
              'placeholder-gray-400 dark:placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              errors.title
                ? 'border-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600'
            )
          )}
          disabled={isLoading}
          autoFocus
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.title}</p>
        )}
      </div>
      
      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Enter task description (optional)"
          rows={3}
          className={twMerge(
            clsx(
              'w-full px-3 py-2 rounded-md border shadow-sm resize-none',
              'bg-white dark:bg-gray-900',
              'text-gray-900 dark:text-gray-100',
              'placeholder-gray-400 dark:placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              errors.description
                ? 'border-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600'
            )
          )}
          disabled={isLoading}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.description}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {formData.description.length}/2000 characters
        </p>
      </div>
      
      {/* Status and Priority Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Status */}
        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            <ClipboardList className="w-4 h-4 inline-block mr-1" />
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className={twMerge(
              clsx(
                'w-full px-3 py-2 rounded-md border shadow-sm',
                'bg-white dark:bg-gray-900',
                'text-gray-900 dark:text-gray-100',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                'border-gray-300 dark:border-gray-600'
              )
            )}
            disabled={isLoading}
          >
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </select>
          <div className="mt-2">
            <StatusBadge status={formData.status} size="sm" />
          </div>
        </div>
        
        {/* Priority */}
        <div>
          <label
            htmlFor="priority"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            <Flag className="w-4 h-4 inline-block mr-1" />
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleInputChange}
            className={twMerge(
              clsx(
                'w-full px-3 py-2 rounded-md border shadow-sm',
                'bg-white dark:bg-gray-900',
                'text-gray-900 dark:text-gray-100',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                'border-gray-300 dark:border-gray-600'
              )
            )}
            disabled={isLoading}
          >
            {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </select>
          <div className="mt-2">
            <PriorityBadge priority={formData.priority} size="sm" />
          </div>
        </div>
      </div>
      
      {/* Date Range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Start Date */}
        <div>
          <label
            htmlFor="start_date"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            <Calendar className="w-4 h-4 inline-block mr-1" />
            Start Date
          </label>
          <input
            type="date"
            id="start_date"
            name="start_date"
            value={formData.start_date}
            onChange={handleInputChange}
            className={twMerge(
              clsx(
                'w-full px-3 py-2 rounded-md border shadow-sm',
                'bg-white dark:bg-gray-900',
                'text-gray-900 dark:text-gray-100',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                errors.start_date
                  ? 'border-red-500 dark:border-red-400'
                  : 'border-gray-300 dark:border-gray-600'
              )
            )}
            disabled={isLoading}
          />
          {errors.start_date && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.start_date}</p>
          )}
        </div>
        
        {/* Due Date */}
        <div>
          <label
            htmlFor="due_date"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            <Calendar className="w-4 h-4 inline-block mr-1" />
            Due Date
          </label>
          <input
            type="date"
            id="due_date"
            name="due_date"
            value={formData.due_date}
            onChange={handleInputChange}
            className={twMerge(
              clsx(
                'w-full px-3 py-2 rounded-md border shadow-sm',
                'bg-white dark:bg-gray-900',
                'text-gray-900 dark:text-gray-100',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                errors.due_date
                  ? 'border-red-500 dark:border-red-400'
                  : 'border-gray-300 dark:border-gray-600'
              )
            )}
            disabled={isLoading}
          />
          {errors.due_date && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.due_date}</p>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          leftIcon={isLoading ? undefined : <ClipboardList className="w-4 h-4" />}
        >
          {isEditing ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}

export default TaskForm;
