import * as vscode from 'vscode';

/**
 * Sanitizes a conversion name to be safe for use as a path segment.
 * @param name The conversion name to sanitize
 * @returns A safe path segment
 */
export function sanitizePathSegment(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_');
}

/**
 * Creates a file URI in the given folder,
 * counter is appended to the preferred name
 * if the file already exists.
 * @param folderPath The URI of the folder where the file will be located
 * @param fileName The preferred name of the file
 * @returns The available file URI
 */
export async function getAvailableFilePath(
  folderPath: vscode.Uri,
  fileName: string,
): Promise<vscode.Uri> {
  const index = fileName.lastIndexOf('.');
  const name = index > 0 ? fileName.substring(0, index) : fileName;
  const extension = index > 0 ? fileName.substring(index) : '';

  let filePath = vscode.Uri.joinPath(folderPath, fileName);
  let counter = 1;

  try {
    while (true) {
      await vscode.workspace.fs.stat(filePath);
      filePath = vscode.Uri.joinPath(
        folderPath,
        `${name}(${counter})${extension}`,
      );
      counter++;
    }
  } catch {
    // there is no file on the given path, the name is available
    return filePath;
  }
}
