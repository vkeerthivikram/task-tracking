import type {
  Project,
  Task,
  Person,
  Tag,
  TaskAssignee,
  TaskTag,
  Note,
  TreeNode,
  TaskProgressRollup,
  CreateProjectDTO,
  UpdateProjectDTO,
  CreateTaskDTO,
  UpdateTaskDTO,
  CreatePersonDTO,
  UpdatePersonDTO,
  CreateTagDTO,
  UpdateTagDTO,
  CreateNoteDTO,
  UpdateNoteDTO,
  UpdateTaskProgressDTO,
  MoveEntityDTO,
  TaskFilters,
  ApiResponse,
  ProjectAssignee,
  ProjectAssigneeRole,
  CreateProjectAssigneeDTO,
  BulkUpdateDTO,
  BulkUpdateResponse,
  CustomField,
  CustomFieldValue,
  CreateCustomFieldDTO,
  UpdateCustomFieldDTO,
  SetCustomFieldValueDTO,
  SavedView,
  CreateSavedViewDTO,
  UpdateSavedViewDTO,
  ExportStatus,
  ImportPayload,
  ImportResult,
  ImportMode,
  TimeEntry,
  TaskTimeSummary,
  ProjectTimeSummary,
  CreateTimeEntryDTO,
  StartTimerDTO,
  UpdateTimeEntryDTO,
  PomodoroSettings,
  PomodoroSession,
  PomodoroDailyStats,
  StartPomodoroDTO,
  UpdatePomodoroSettingsDTO,
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

// Generic request helpers
const request = {
  get: async <T>(path: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`);
    return handleResponse<T>(response);
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  put: async <T>(path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  patch: async <T>(path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  del: async <T>(path: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
    });
    return handleResponse<T>(response);
  },
};

// Generic query string builder
function buildQuery(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

// Build query string from TaskFilters
function buildTaskFiltersQuery(filters?: TaskFilters): string {
  if (!filters) return '';
  return buildQuery({
    project_id: filters.project_id,
    status: filters.status,
    priority: filters.priority,
    due_date_from: filters.due_date_from,
    due_date_to: filters.due_date_to,
    search: filters.search,
    assignee_id: filters.assignee_id,
    tag_id: filters.tag_id,
  });
}

// ============ Projects API ============

export const getProjects = () => request.get<Project[]>('/projects');
export const getProject = (id: number) => request.get<Project>(`/projects/${id}`);
export const createProject = (data: CreateProjectDTO) => request.post<Project>('/projects', data);
export const updateProject = (id: number, data: UpdateProjectDTO) => request.put<Project>(`/projects/${id}`, data);
export const deleteProject = (id: number) => request.del<void>(`/projects/${id}`);
export const getProjectTasks = (projectId: number) => request.get<Task[]>(`/projects/${projectId}/tasks`);

// ============ Tasks API ============

export const getTasks = (filters?: TaskFilters) => request.get<Task[]>(`/tasks${buildTaskFiltersQuery(filters)}`);
export const getTask = (id: number) => request.get<Task>(`/tasks/${id}`);
export const createTask = (data: CreateTaskDTO) => request.post<Task>('/tasks', data);
export const updateTask = (id: number, data: UpdateTaskDTO) => request.put<Task>(`/tasks/${id}`, data);
export const updateTaskStatus = (id: number, status: Task['status']) => request.patch<Task>(`/tasks/${id}/status`, { status });
export const deleteTask = (id: number) => request.del<void>(`/tasks/${id}`);

// Task Assignees API
export const getTaskAssignees = (taskId: number) => request.get<TaskAssignee[]>(`/tasks/${taskId}/assignees`);
export const addTaskAssignee = (taskId: number, data: { person_id: number; role?: string }) =>
  request.post<TaskAssignee>(`/tasks/${taskId}/assignees`, data);
export const removeTaskAssignee = (taskId: number, personId: number) =>
  request.del<void>(`/tasks/${taskId}/assignees/${personId}`);
export const setPrimaryAssignee = (taskId: number, assigneeId: number) =>
  request.put<Task>(`/tasks/${taskId}/assignee`, { assignee_id: assigneeId });

// Task Tags API
export const getTaskTags = (taskId: number) => request.get<TaskTag[]>(`/tasks/${taskId}/tags`);
export const addTaskTag = (taskId: number, tagId: number) => request.post<TaskTag>(`/tasks/${taskId}/tags`, { tag_id: tagId });
export const removeTaskTag = (taskId: number, tagId: number) => request.del<void>(`/tasks/${taskId}/tags/${tagId}`);

// ============ People API ============

export const getPeople = (projectId?: number) => request.get<Person[]>(`/people${buildQuery({ project_id: projectId })}`);
export const getPerson = (id: number) => request.get<Person>(`/people/${id}`);
export const createPerson = (data: CreatePersonDTO) => request.post<Person>('/people', data);
export const updatePerson = (id: number, data: UpdatePersonDTO) => request.put<Person>(`/people/${id}`, data);
export const deletePerson = (id: number) => request.del<void>(`/people/${id}`);

// ============ Tags API ============

export const getTags = (projectId?: number) => request.get<Tag[]>(`/tags${buildQuery({ project_id: projectId })}`);
export const getTag = (id: number) => request.get<Tag>(`/tags/${id}`);
export const createTag = (data: CreateTagDTO) => request.post<Tag>('/tags', data);
export const updateTag = (id: number, data: UpdateTagDTO) => request.put<Tag>(`/tags/${id}`, data);
export const deleteTag = (id: number) => request.del<void>(`/tags/${id}`);

// ============ Notes API ============

export const getNotes = (entityType: string, entityId: number) =>
  request.get<Note[]>(`/notes${buildQuery({ entity_type: entityType, entity_id: entityId })}`);
export const getNote = (id: number) => request.get<Note>(`/notes/${id}`);
export const createNote = (data: CreateNoteDTO) => request.post<Note>('/notes', data);
export const updateNote = (id: number, data: UpdateNoteDTO) => request.put<Note>(`/notes/${id}`, data);
export const deleteNote = (id: number) => request.del<void>(`/notes/${id}`);

// ============ Project Hierarchy API ============

export const getRootProjects = () => request.get<Project[]>('/projects/root');
export const getProjectChildren = (id: number) => request.get<Project[]>(`/projects/${id}/children`);
export const getProjectDescendants = (id: number) => request.get<Project[]>(`/projects/${id}/descendants`);
export const getProjectTree = (id: number) => request.get<TreeNode<Project>>(`/projects/${id}/tree`);
export const createSubProject = (parentId: number, data: CreateProjectDTO) =>
  request.post<Project>(`/projects/${parentId}/subprojects`, data);
export const moveProject = (id: number, parentId: number | null) =>
  request.put<Project>(`/projects/${id}/move`, { parent_id: parentId } as MoveEntityDTO);

// ============ Project Assignments API ============

export const setProjectOwner = (projectId: number, personId: number | null) =>
  request.put<Project>(`/projects/${projectId}/owner`, { owner_id: personId });
export const getProjectAssignees = (projectId: number) => request.get<ProjectAssignee[]>(`/projects/${projectId}/assignees`);
export const addProjectAssignee = (projectId: number, data: CreateProjectAssigneeDTO) =>
  request.post<ProjectAssignee>(`/projects/${projectId}/assignees`, data);
export const removeProjectAssignee = (projectId: number, assigneeId: number) =>
  request.del<void>(`/projects/${projectId}/assignees/${assigneeId}`);

// ============ Task Hierarchy API ============

export const getTaskChildren = (id: number) => request.get<Task[]>(`/tasks/${id}/children`);
export const getTaskDescendants = (id: number) => request.get<Task[]>(`/tasks/${id}/descendants`);
export const getTaskTree = (id: number) => request.get<TreeNode<Task>>(`/tasks/${id}/tree`);
export const createSubTask = (parentId: number, data: CreateTaskDTO) =>
  request.post<Task>(`/tasks/${parentId}/subtasks`, data);
export const moveTask = (id: number, parentId: number | null) =>
  request.put<Task>(`/tasks/${id}/move`, { parent_id: parentId } as MoveEntityDTO);
export const getRootTasks = (projectId: number) => request.get<Task[]>(`/projects/${projectId}/tasks/root`);

// ============ Task Progress API ============

export const updateTaskProgress = (id: number, data: UpdateTaskProgressDTO) =>
  request.put<Task>(`/tasks/${id}/progress`, data);
export const getTaskProgressRollup = (id: number) => request.get<TaskProgressRollup>(`/tasks/${id}/progress/rollup`);

// ============ Bulk Operations API ============

export const bulkUpdateTasks = (data: BulkUpdateDTO) => request.put<BulkUpdateResponse>('/tasks/bulk', data);
export const bulkDeleteTasks = (taskIds: number[]) => request.del<{ deleted: number }>(`/tasks/bulk?taskIds=${taskIds.join(',')}`);

// ============ Custom Fields API ============

export const getCustomFields = (projectId?: string) =>
  request.get<CustomField[]>(`/custom-fields${buildQuery({ project_id: projectId })}`);
export const getCustomField = (id: string) => request.get<CustomField>(`/custom-fields/${id}`);
export const createCustomField = (data: CreateCustomFieldDTO) => request.post<CustomField>('/custom-fields', data);
export const updateCustomField = (id: string, data: Partial<UpdateCustomFieldDTO>) =>
  request.put<CustomField>(`/custom-fields/${id}`, data);
export const deleteCustomField = (id: string) => request.del<void>(`/custom-fields/${id}`);

// Custom Field Values API
export const getTaskCustomFields = (taskId: number) => request.get<CustomFieldValue[]>(`/tasks/${taskId}/custom-fields`);
export const setTaskCustomField = (taskId: number, fieldId: string, value: SetCustomFieldValueDTO['value']) =>
  request.put<CustomFieldValue>(`/tasks/${taskId}/custom-fields/${fieldId}`, { value });
export const deleteTaskCustomField = (taskId: number, fieldId: string) =>
  request.del<void>(`/tasks/${taskId}/custom-fields/${fieldId}`);

// ============ Saved Views API ============

export const getSavedViews = (projectId?: string, viewType?: string) =>
  request.get<SavedView[]>(`/saved-views${buildQuery({ project_id: projectId, view_type: viewType })}`);
export const getSavedView = (id: string) => request.get<SavedView>(`/saved-views/${id}`);
export const createSavedView = (data: CreateSavedViewDTO) => request.post<SavedView>('/saved-views', data);
export const updateSavedView = (id: string, data: Partial<UpdateSavedViewDTO>) =>
  request.put<SavedView>(`/saved-views/${id}`, data);
export const deleteSavedView = (id: string) => request.del<void>(`/saved-views/${id}`);
export const setDefaultView = (id: string) => request.put<SavedView>(`/saved-views/${id}/default`);

// ============ Import/Export API ============

/**
 * Export all data as JSON (triggers file download)
 */
export async function exportData(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/export`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Export failed' } }));
    throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'celestask-export.json';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(?:;|$)/);
    if (filenameMatch) filename = filenameMatch[1];
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export SQLite database file (triggers file download)
 */
export async function exportSqlite(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/export/sqlite`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'SQLite export failed' } }));
    throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'celestask-backup.db';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(?:;|$)/);
    if (filenameMatch) filename = filenameMatch[1];
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const getExportStatus = () => request.get<ExportStatus>('/export/status');
export const importData = (data: ImportPayload, mode: ImportMode) =>
  request.post<ImportResult>(`/import?mode=${mode}`, data);

// ============ Time Entries API ============

export const getTaskTimeEntries = (taskId: number | string) =>
  request.get<TimeEntry[]>(`/time-entries/task/${taskId}`);
export const getTaskTimeSummary = (taskId: number | string) =>
  request.get<TaskTimeSummary>(`/time-entries/task/${taskId}/summary`);
export const startTaskTimer = (taskId: number | string, data?: StartTimerDTO) =>
  request.post<TimeEntry>(`/time-entries/task/${taskId}/start`, data || {});
export const stopTaskTimer = (taskId: number | string) =>
  request.post<TimeEntry>(`/time-entries/task/${taskId}/stop`);
export const createTaskTimeEntry = (taskId: number | string, data: CreateTimeEntryDTO) =>
  request.post<TimeEntry>(`/time-entries/task/${taskId}`, data);

export const getProjectTimeEntries = (projectId: number | string) =>
  request.get<TimeEntry[]>(`/time-entries/project/${projectId}`);
export const getProjectTimeSummary = (projectId: number | string) =>
  request.get<ProjectTimeSummary>(`/time-entries/project/${projectId}/summary`);
export const startProjectTimer = (projectId: number | string, data?: StartTimerDTO) =>
  request.post<TimeEntry>(`/time-entries/project/${projectId}/start`, data || {});
export const stopProjectTimer = (projectId: number | string) =>
  request.post<TimeEntry>(`/time-entries/project/${projectId}/stop`);
export const createProjectTimeEntry = (projectId: number | string, data: CreateTimeEntryDTO) =>
  request.post<TimeEntry>(`/time-entries/project/${projectId}`, data);

export const updateTimeEntry = (entryId: string, data: UpdateTimeEntryDTO) =>
  request.put<TimeEntry>(`/time-entries/${entryId}`, data);
export const deleteTimeEntry = (entryId: string) => request.del<void>(`/time-entries/${entryId}`);
export const getRunningTimers = () => request.get<TimeEntry[]>('/time-entries/running');
export const stopAllTimers = () => request.post<{ stopped_count: number; stopped_ids: string[] }>('/time-entries/stop-all');

// ============ Pomodoro API ============

export const getPomodoroSettings = () => request.get<PomodoroSettings>('/pomodoro/settings');
export const updatePomodoroSettings = (data: UpdatePomodoroSettingsDTO) =>
  request.put<PomodoroSettings>('/pomodoro/settings', data);
export const getCurrentPomodoro = () => request.get<PomodoroSession | null>('/pomodoro/current');
export const startPomodoro = (data?: StartPomodoroDTO) => request.post<PomodoroSession>('/pomodoro/start', data || {});
export const pausePomodoro = () => request.post<PomodoroSession>('/pomodoro/pause');
export const resumePomodoro = () => request.post<PomodoroSession>('/pomodoro/resume');
export const stopPomodoro = () => request.post<{ message: string }>('/pomodoro/stop');
export const completePomodoro = () => request.post<PomodoroSession>('/pomodoro/complete');
export const skipPomodoro = () => request.post<PomodoroSession>('/pomodoro/skip');

export const getPomodoroSessions = (params?: { task_id?: number; date?: string; limit?: number }) =>
  request.get<PomodoroSession[]>(`/pomodoro/sessions${buildQuery(params || {})}`);
export const getPomodoroStats = (date?: string) =>
  request.get<PomodoroDailyStats>(`/pomodoro/stats${buildQuery({ date })}`);

// Export all functions as a unified API object
export const api = {
  projects: {
    getAll: getProjects,
    getOne: getProject,
    create: createProject,
    update: updateProject,
    delete: deleteProject,
    getTasks: getProjectTasks,
    getRoot: getRootProjects,
    getChildren: getProjectChildren,
    getDescendants: getProjectDescendants,
    getTree: getProjectTree,
    createSub: createSubProject,
    move: moveProject,
    setOwner: setProjectOwner,
    getAssignees: getProjectAssignees,
    addAssignee: addProjectAssignee,
    removeAssignee: removeProjectAssignee,
  },
  tasks: {
    getAll: getTasks,
    getOne: getTask,
    create: createTask,
    update: updateTask,
    updateStatus: updateTaskStatus,
    delete: deleteTask,
    getAssignees: getTaskAssignees,
    addAssignee: addTaskAssignee,
    removeAssignee: removeTaskAssignee,
    setPrimaryAssignee: setPrimaryAssignee,
    getTags: getTaskTags,
    addTag: addTaskTag,
    removeTag: removeTaskTag,
    getChildren: getTaskChildren,
    getDescendants: getTaskDescendants,
    getTree: getTaskTree,
    createSub: createSubTask,
    move: moveTask,
    updateProgress: updateTaskProgress,
    getProgressRollup: getTaskProgressRollup,
    getRoot: getRootTasks,
    bulkUpdate: bulkUpdateTasks,
    bulkDelete: bulkDeleteTasks,
    getCustomFields: getTaskCustomFields,
    setCustomField: setTaskCustomField,
    deleteCustomField: deleteTaskCustomField,
  },
  people: {
    getAll: getPeople,
    getOne: getPerson,
    create: createPerson,
    update: updatePerson,
    delete: deletePerson,
  },
  tags: {
    getAll: getTags,
    getOne: getTag,
    create: createTag,
    update: updateTag,
    delete: deleteTag,
  },
  notes: {
    getAll: getNotes,
    getOne: getNote,
    create: createNote,
    update: updateNote,
    delete: deleteNote,
  },
  customFields: {
    getAll: getCustomFields,
    getOne: getCustomField,
    create: createCustomField,
    update: updateCustomField,
    delete: deleteCustomField,
  },
  savedViews: {
    getAll: getSavedViews,
    getOne: getSavedView,
    create: createSavedView,
    update: updateSavedView,
    delete: deleteSavedView,
    setDefault: setDefaultView,
  },
  importExport: {
    exportData,
    exportSqlite,
    getExportStatus,
    importData,
  },
  timeEntries: {
    getTaskEntries: getTaskTimeEntries,
    getTaskSummary: getTaskTimeSummary,
    startTaskTimer,
    stopTaskTimer,
    createTaskEntry: createTaskTimeEntry,
    getProjectEntries: getProjectTimeEntries,
    getProjectSummary: getProjectTimeSummary,
    startProjectTimer,
    stopProjectTimer,
    createProjectEntry: createProjectTimeEntry,
    update: updateTimeEntry,
    delete: deleteTimeEntry,
    getRunning: getRunningTimers,
    stopAll: stopAllTimers,
  },
  pomodoro: {
    getSettings: getPomodoroSettings,
    updateSettings: updatePomodoroSettings,
    getCurrent: getCurrentPomodoro,
    start: startPomodoro,
    pause: pausePomodoro,
    resume: resumePomodoro,
    stop: stopPomodoro,
    complete: completePomodoro,
    skip: skipPomodoro,
    getSessions: getPomodoroSessions,
    getStats: getPomodoroStats,
  },
};

export default api;
