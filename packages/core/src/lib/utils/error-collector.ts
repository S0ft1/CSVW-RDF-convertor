type CellPosition = {
  row: number;
  column: number;
};

type Issue = {
  type: 'error' | 'warning';
  message: string;
  cell: CellPosition;
  timestamp: Date;
};

class IssueTracker {
  private currentCell: CellPosition = { row: 0, column: 0 };
  private errors: Issue[] = [];
  private warnings: Issue[] = [];

  setCurrentCell(row: number, column: number): void {
    this.currentCell = { row, column };
  }

  addError(message: string): void {
    const error: Issue = {
      type: 'error',
      message,
      cell: { ...this.currentCell },
      timestamp: new Date(),
    };
    this.errors.push(error);
  }

  addWarning(message: string): void {
    const warning: Issue = {
      type: 'warning',
      message,
      cell: { ...this.currentCell },
      timestamp: new Date(),
    };
    this.warnings.push(warning);
  }

  addErrorWithPos(message: string, cellPos: CellPosition): void {
    const error: Issue = {
      type: 'error',
      message,
      cell: cellPos,
      timestamp: new Date(),
    };
    this.errors.push(error);
  }

  addWarningWithPos(message: string, cellPos: CellPosition): void {
    const warning: Issue = {
      type: 'warning',
      message,
      cell: cellPos,
      timestamp: new Date(),
    };
    this.warnings.push(warning);
  }
  getErrors(): Issue[] {
    return this.errors;
  }

  getWarnings(): Issue[] {
    return this.warnings;
  }

  clearAll(): void {
    this.errors = [];
    this.warnings = [];
  }
}

//Singleton
const issueTracker = new IssueTracker();
export default issueTracker;
