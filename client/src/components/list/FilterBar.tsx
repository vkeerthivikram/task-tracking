import React, { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import type { TaskStatus, TaskPriority } from '../../types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../types';

export interface ListFilters {
  search: string;
  status: TaskStatus[];
  priority: TaskPriority[];
}

interface FilterBarProps {
  filters: ListFilters;
  onFilterChange: (filters: ListFilters) => void;
  totalTasks: number;
  filteredCount: number;
}

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Dropdown component for multi-select filters
interface MultiSelectDropdownProps {
  label: string;
  options: { value: string; label: string; color: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function MultiSelectDropdown({ label, options, selected, onChange }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={twMerge(
          clsx(
            'inline-flex items-center gap-2 px-3 py-2',
            'text-sm font-medium rounded-md',
            'border border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-800',
            'text-gray-700 dark:text-gray-300',
            'hover:bg-gray-50 dark:hover:bg-gray-700',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'dark:focus:ring-offset-gray-900',
            'transition-colors duration-150',
            selected.length > 0 && 'ring-2 ring-primary-500'
          )
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Filter className="w-4 h-4" aria-hidden="true" />
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
            {selected.length}
          </span>
        )}
        <ChevronDown
          className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute z-20 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-1"
          role="listbox"
          aria-label={`${label} options`}
        >
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              className={twMerge(
                clsx(
                  'w-full flex items-center gap-3 px-4 py-2 text-sm text-left',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700',
                  'transition-colors duration-150'
                )
              )}
              role="option"
              aria-selected={selected.includes(option.value)}
            >
              <span
                className={clsx(
                  'w-4 h-4 rounded border flex items-center justify-center',
                  selected.includes(option.value)
                    ? 'bg-primary-600 border-primary-600'
                    : 'border-gray-300 dark:border-gray-500'
                )}
              >
                {selected.includes(option.value) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                    <path d="M10.28 2.28L4 8.56 1.72 6.28a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l7-7a.75.75 0 00-1.06-1.06z" />
                  </svg>
                )}
              </span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: option.color }}
                aria-hidden="true"
              />
              <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ filters, onFilterChange, totalTasks, filteredCount }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Update parent when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFilterChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleStatusChange = useCallback(
    (status: string[]) => {
      onFilterChange({ ...filters, status: status as TaskStatus[] });
    },
    [filters, onFilterChange]
  );

  const handlePriorityChange = useCallback(
    (priority: string[]) => {
      onFilterChange({ ...filters, priority: priority as TaskPriority[] });
    },
    [filters, onFilterChange]
  );

  const handleClearFilters = () => {
    setSearchInput('');
    onFilterChange({
      search: '',
      status: [],
      priority: [],
    });
  };

  const hasActiveFilters =
    filters.search || filters.status.length > 0 || filters.priority.length > 0;

  const activeFilterCount =
    (filters.search ? 1 : 0) + filters.status.length + filters.priority.length;

  const statusOptions = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
    value,
    label: config.label,
    color: config.color,
  }));

  const priorityOptions = Object.entries(PRIORITY_CONFIG).map(([value, config]) => ({
    value,
    label: config.label,
    color: config.color,
  }));

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search tasks by title or description..."
            className={twMerge(
              clsx(
                'w-full pl-10 pr-4 py-2 rounded-md',
                'border border-gray-300 dark:border-gray-600',
                'bg-white dark:bg-gray-800',
                'text-gray-900 dark:text-gray-100',
                'placeholder-gray-400 dark:placeholder-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                'transition-colors duration-150'
              )
            )}
            aria-label="Search tasks"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <MultiSelectDropdown
            label="Status"
            options={statusOptions}
            selected={filters.status}
            onChange={handleStatusChange}
          />
          <MultiSelectDropdown
            label="Priority"
            options={priorityOptions}
            selected={filters.priority}
            onChange={handlePriorityChange}
          />

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className={twMerge(
                clsx(
                  'inline-flex items-center gap-1.5 px-3 py-2',
                  'text-sm font-medium rounded-md',
                  'text-gray-600 dark:text-gray-400',
                  'hover:text-gray-900 dark:hover:text-gray-200',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'transition-colors duration-150'
                )
              )}
              aria-label="Clear all filters"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Task Count and Active Filters */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <p>
          Showing <span className="font-medium text-gray-900 dark:text-gray-100">{filteredCount}</span>{' '}
          of <span className="font-medium text-gray-900 dark:text-gray-100">{totalTasks}</span> tasks
        </p>
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default FilterBar;
