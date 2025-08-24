import { IssueTracker } from './issue-tracker.js';

export function trimUrl(
  value: string,
  templateUrl: string,
  columnName: string,
  issueTracker: IssueTracker
): string {
  const operators = ['+', '#', '.', '/', ';', '?', '&'];

  let foundColumn = false;
  const regexPattern = templateUrl.replaceAll(
    /\{([^{}]+)\}|([^{}]+)/g,
    (_, template: string, literal: string) => {
      // Convert template into a regex with named capturing groups
      if (template) {
        if (operators.indexOf(template.charAt(0)) !== -1) {
          template = template.substring(1);
        }
        foundColumn = foundColumn || template === columnName;
        return `[${operators.join()}]?(?<${template}>.*?)`;
      }
      // escape special chars
      else {
        return literal.replaceAll(
          /[.*+?^${}()|[\]\\]/g,
          (char: string) => `\\${char}`,
        );
      }
    },
  );

  if (!foundColumn) {
    issueTracker.addWarning(
      `The column "${columnName}" is not found in the template URL "${templateUrl}".`
    );
    return value;
  }

  const regex = new RegExp(`^${regexPattern}$`);
  const match = value.match(regex);
  const result = match?.groups?.[columnName] ?? null;

  if (result) {
    return result;
  } else {
    issueTracker.addWarning(
      `The value "${value}" does not match the template URL "${templateUrl}" for column "${columnName}".`
    );
    return value;
  }
}
