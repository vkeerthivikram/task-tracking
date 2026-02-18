import React, { useState, useEffect, type FormEvent } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FolderPlus, Loader2 } from 'lucide-react';
import type { Project, CreateProjectDTO, UpdateProjectDTO } from '../../types';
import { PROJECT_COLORS } from '../../types';
import { Button } from './Button';

interface ProjectFormProps {
  project?: Project | null;
  onSubmit: (data: CreateProjectDTO | UpdateProjectDTO) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormData {
  name: string;
  description: string;
  color: string;
}

interface FormErrors {
  name?: string;
  description?: string;
}

export function ProjectForm({
  project,
  onSubmit,
  onCancel,
  isLoading = false,
}: ProjectFormProps) {
  const isEditing = Boolean(project);
  
  const [formData, setFormData] = useState<FormData>({
    name: project?.name || '',
    description: project?.description || '',
    color: project?.color || PROJECT_COLORS[0],
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Update form when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description,
        color: project.color,
      });
    }
  }, [project]);
  
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Project name must be less than 100 characters';
    }
    
    if (formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      if (isEditing && project) {
        await onSubmit({
          name: formData.name.trim(),
          description: formData.description.trim(),
          color: formData.color,
        } as UpdateProjectDTO);
      } else {
        await onSubmit({
          name: formData.name.trim(),
          description: formData.description.trim(),
          color: formData.color,
        } as CreateProjectDTO);
      }
    } catch {
      // Error handling is done by the parent component
    }
  };
  
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      {/* Project Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Project Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="Enter project name"
          className={twMerge(
            clsx(
              'w-full px-3 py-2 rounded-md border shadow-sm',
              'bg-white dark:bg-gray-900',
              'text-gray-900 dark:text-gray-100',
              'placeholder-gray-400 dark:placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              errors.name
                ? 'border-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600'
            )
          )}
          disabled={isLoading}
          autoFocus
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errors.name}</p>
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
          placeholder="Enter project description (optional)"
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
          {formData.description.length}/500 characters
        </p>
      </div>
      
      {/* Color Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Color
        </label>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, color }))}
              className={twMerge(
                clsx(
                  'w-8 h-8 rounded-full transition-all duration-200',
                  'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  'dark:focus:ring-offset-gray-800',
                  formData.color === color && 'ring-2 ring-offset-2 ring-gray-400'
                )
              )}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
              disabled={isLoading}
            />
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Selected: <span className="font-mono">{formData.color}</span>
        </p>
      </div>
      
      {/* Color Preview */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: formData.color }}
        >
          <FolderPlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {formData.name || 'Project Name'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
            {formData.description || 'No description'}
          </p>
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
          leftIcon={isLoading ? undefined : <FolderPlus className="w-4 h-4" />}
        >
          {isEditing ? 'Update Project' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}

export default ProjectForm;
