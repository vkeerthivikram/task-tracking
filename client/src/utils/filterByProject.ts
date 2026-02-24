/**
 * Filters items by project, returning both global items (no project_id)
 * and items specific to the given project.
 */
export function filterByProject<T extends { project_id?: number | null }>(
  items: T[],
  projectId: number | null | undefined
): T[] {
  if (!projectId) {
    return items;
  }
  return items.filter(
    item => item.project_id === undefined || item.project_id === null || item.project_id === projectId
  );
}

/**
 * Filters items to only those belonging to a specific project
 */
export function filterByProjectOnly<T extends { project_id?: number | null }>(
  items: T[],
  projectId: number | null | undefined
): T[] {
  if (!projectId) {
    return items.filter(item => !item.project_id);
  }
  return items.filter(item => item.project_id === projectId);
}
