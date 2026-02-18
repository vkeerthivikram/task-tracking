import type {
  Project,
  Task,
  CreateProjectDTO,
  UpdateProjectDTO,
  CreateTaskDTO,
  UpdateTaskDTO,
  TaskFilters,
  ApiResponse,
} from '../types';

const API_BASE_URL = '/api';

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'An error occurred' } }));
    throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
  }
  const data: ApiResponse<T> = await response.json();
  return data.data;
}

// Build query string from filters
function buildQueryString(filters?: TaskFilters): string {
  if (!filters) return '';
  
  const params = new URLSearchParams();
  
  if (filters.project_id !== undefined) {
    params.append('project_id', filters.project_id.toString());
  }
  if (filters.status) {
    params.append('status', filters.status);
  }
  if (filters.priority) {
    params.append('priority', filters.priority);
  }
  if (filters.due_date_from) {
    params.append('due_date_from', filters.due_date_from);
  }
  if (filters.due_date_to) {
    params.append('due_date_to', filters.due_date_to);
  }
  if (filters.search) {
    params.append('search', filters.search);
  }
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

// ============ Projects API ============

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE_URL}/projects`);
  return handleResponse<Project[]>(response);
}

export async function getProject(id: number): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`);
  return handleResponse<Project>(response);
}

export async function createProject(data: CreateProjectDTO): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(response);
}

export async function updateProject(id: number, data: UpdateProjectDTO): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Project>(response);
}

export async function deleteProject(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
  });
  await handleResponse<{ message: string }>(response);
}

export async function getProjectTasks(projectId: number): Promise<Task[]> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/tasks`);
  return handleResponse<Task[]>(response);
}

// ============ Tasks API ============

export async function getTasks(filters?: TaskFilters): Promise<Task[]> {
  const queryString = buildQueryString(filters);
  const response = await fetch(`${API_BASE_URL}/tasks${queryString}`);
  return handleResponse<Task[]>(response);
}

export async function getTask(id: number): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`);
  return handleResponse<Task>(response);
}

export async function createTask(data: CreateTaskDTO): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Task>(response);
}

export async function updateTask(id: number, data: UpdateTaskDTO): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Task>(response);
}

export async function updateTaskStatus(id: number, status: Task['status']): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return handleResponse<Task>(response);
}

export async function deleteTask(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
    method: 'DELETE',
  });
  await handleResponse<{ message: string }>(response);
}

// Export all functions as a unified API object
export const api = {
  projects: {
    getAll: getProjects,
    getOne: getProject,
    create: createProject,
    update: updateProject,
    delete: deleteProject,
    getTasks: getProjectTasks,
  },
  tasks: {
    getAll: getTasks,
    getOne: getTask,
    create: createTask,
    update: updateTask,
    updateStatus: updateTaskStatus,
    delete: deleteTask,
  },
};

export default api;
