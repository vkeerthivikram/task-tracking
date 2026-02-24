/**
 * Downloads a file from a fetch response
 * Extracts filename from Content-Disposition header
 */
export async function downloadFromResponse(
  response: Response,
  defaultFilename: string
): Promise<void> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Download failed' } }));
    throw new Error(error.error?.message || `HTTP error! status: ${response.status}`);
  }
  
  const blob = await response.blob();
  
  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = defaultFilename;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(?:;|$)/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }
  
  // Create download link and trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
