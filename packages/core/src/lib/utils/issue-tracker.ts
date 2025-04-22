import { CsvLocationTracker, CsvLocation } from './code-location.js';

export interface Issue {
  type: 'error' | 'warning';
  message: string;
  location?: Partial<CsvLocation>;
}

export class ValidationError extends Error {
  constructor(message: string, public location?: Partial<CsvLocation>) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * IssueTracker is a utility class for tracking issues (errors and warnings) during the validation process.
 * It can throw errors or collect them for later retrieval.
 */
export class IssueTracker {
  private errors: Issue[] = [];
  private warnings: Issue[] = [];

  constructor(
    public location: CsvLocationTracker,
    private throwErrors = true
  ) {}

  /**
   * Adds an error message to the issue tracker.
   * @param message - The error message to be added.
   * @param withLocation - should the error message include the location information?
   */
  addError(message: string, withLocation = true): void {
    if (this.throwErrors) {
      if (withLocation && this.location.hasLocation) {
        throw new ValidationError(message, this.location.value);
      }
      throw new ValidationError(message);
    }
    const error: Issue = {
      type: 'error',
      message,
    };
    if (withLocation && this.location.hasLocation) {
      error.location = this.location.value;
    }
    this.errors.push(error);
  }

  /**
   * Adds a warning message to the issue tracker.
   * @param message - The warning message to be added.
   * @param withLocation - should the warning message include the location information?
   */
  addWarning(message: string, withLocation = true): void {
    const warning: Issue = {
      type: 'warning',
      message,
    };
    if (withLocation && this.location.hasLocation) {
      warning.location = this.location.value;
    }
    this.warnings.push(warning);
  }

  /**
   * Gets all collected errors
   */
  getErrors(): Issue[] {
    return this.errors;
  }

  /**
   * Gets all collected warnings
   */
  getWarnings(): Issue[] {
    return this.warnings;
  }

  /**
   * Clears all collected errors and warnings.
   */
  clearAll(): void {
    this.errors = [];
    this.warnings = [];
  }
}
