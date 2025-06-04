import { CsvLocationTracker, CsvLocation } from './code-location.js';
import type EventEmitter from 'node:events';

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

export interface IssueTrackerOptions {
  /** If supplied, issues will be emitted as events */
  eventEmitter?: EventEmitter;
  /** If true (default), errors will be thrown instead of emitted or collected */
  throwErrors?: boolean;
  /** If true (default), issues will be collected in internal arrays for later retrieval */
  collectIssues?: boolean;
}
export type IssueTrackerOptionsWithDefaults = Required<
  Omit<IssueTrackerOptions, 'eventEmitter'>
> &
  IssueTrackerOptions;

/**
 * IssueTracker is a utility class for tracking issues (errors and warnings) during the validation process.
 * It can throw errors or collect them for later retrieval.
 */
export class IssueTracker {
  private errors: Issue[] = [];
  private warnings: Issue[] = [];
  public options: IssueTrackerOptionsWithDefaults;

  constructor(
    public location: CsvLocationTracker,
    options?: IssueTrackerOptions
  ) {
    this.options = this.setDefaults(options);
  }

  private setDefaults(
    options?: IssueTrackerOptions
  ): IssueTrackerOptionsWithDefaults {
    if (!options) options = {};
    return {
      eventEmitter: options.eventEmitter,
      throwErrors: options.throwErrors ?? true,
      collectIssues: options.collectIssues ?? true,
    };
  }

  /**
   * Adds an error message to the issue tracker.
   * @param message - The error message to be added.
   * @param withLocation - should the error message include the location information?
   */
  addError(message: string, withLocation = true): void {
    if (this.options.throwErrors) {
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
    if (this.options.collectIssues) {
      this.errors.push(error);
    }
    if (this.options.eventEmitter) {
      this.options.eventEmitter.emit('error', error);
    }
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
    if (this.options.collectIssues) {
      this.warnings.push(warning);
    }
    if (this.options.eventEmitter) {
      this.options.eventEmitter.emit('warning', warning);
    }
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
