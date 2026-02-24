'use client';

import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

// Base input styles
const baseInputStyles = 'w-full px-3 py-2 rounded-md border shadow-sm text-sm transition-colors';
const normalBorderStyles = 'border-gray-300 dark:border-gray-600';
const errorBorderStyles = 'border-red-500 dark:border-red-400';
const bgStyles = 'bg-white dark:bg-gray-900';
const textStyles = 'text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500';
const focusStyles = 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
const disabledStyles = 'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800';

interface FormFieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

// Form field wrapper with label and error
export function FormField({ label, error, helperText, required, className, children }: FormFieldProps) {
  return (
    <div className={twMerge('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

// Standard text input
export const FormInput = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={twMerge(
          baseInputStyles,
          bgStyles,
          textStyles,
          focusStyles,
          disabledStyles,
          error ? errorBorderStyles : normalBorderStyles,
          className
        )}
        {...props}
      />
    );
  }
);
FormInput.displayName = 'FormInput';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

// Textarea
export const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={twMerge(
          baseInputStyles,
          bgStyles,
          textStyles,
          focusStyles,
          disabledStyles,
          error ? errorBorderStyles : normalBorderStyles,
          'min-h-[80px] resize-y',
          className
        )}
        {...props}
      />
    );
  }
);
FormTextarea.displayName = 'FormTextarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

// Select dropdown
export const FormSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, options, placeholder, className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={twMerge(
          baseInputStyles,
          bgStyles,
          textStyles,
          focusStyles,
          disabledStyles,
          error ? errorBorderStyles : normalBorderStyles,
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);
FormSelect.displayName = 'FormSelect';

// Number input with optional min/max
interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string;
}

export const FormNumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="number"
        className={twMerge(
          baseInputStyles,
          bgStyles,
          textStyles,
          focusStyles,
          disabledStyles,
          error ? errorBorderStyles : normalBorderStyles,
          className
        )}
        {...props}
      />
    );
  }
);
FormNumberInput.displayName = 'FormNumberInput';

// Date input
interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string;
}

export const FormDateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="date"
        className={twMerge(
          baseInputStyles,
          bgStyles,
          textStyles,
          focusStyles,
          disabledStyles,
          error ? errorBorderStyles : normalBorderStyles,
          className
        )}
        {...props}
      />
    );
  }
);
FormDateInput.displayName = 'FormDateInput';

// Checkbox
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const FormCheckbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <label className={twMerge('flex items-center gap-2 cursor-pointer', className)}>
        <input
          ref={ref}
          type="checkbox"
          className={twMerge(
            'w-4 h-4 rounded border-gray-300 dark:border-gray-600',
            'text-primary-500 focus:ring-primary-500 focus:ring-2',
            'bg-white dark:bg-gray-900',
            disabledStyles
          )}
          {...props}
        />
        {label && (
          <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        )}
      </label>
    );
  }
);
FormCheckbox.displayName = 'FormCheckbox';
