/**
 * Helps track the location in a file being processed.
 */
export abstract class LocationTracker<T extends object> {
  protected _loc: Partial<T> = {};
  /**
   * The location in the file being processed.
   */
  public get value(): Partial<T> {
    return { ...this._loc };
  }
  set value(value: Partial<T>) {
    this._loc = value;
  }

  /**
   * Returns true if the location is not empty.
   */
  public get hasLocation(): boolean {
    return Object.keys(this._loc).length > 0;
  }

  constructor(protected scopeLayers: (keyof T)[]) {}

  /**
   * Updates the location in the file being processed. If only partial location is provided,
   * less specific layers will be kept from the original location and more specific layers will be removed.
   * @param newLoc The new location to be set.
   *
   * @example
   *
   * ```ts
   * let tracker: LocationTracker<{
   *   table: string; // least specific layer
   *   row: number; // more specific layer
   *   column: number; // most specific layer
   * }>;
   * tracker.loc = { table: 'table1', row: 1, column: 2 };
   * tracker.updateLocation({ row: 2 }); // { table: 'table1', row: 2 }
   * ```
   */
  public update(newLoc: Partial<T>) {
    let keep = true;
    for (const layer of this.scopeLayers) {
      if (layer in newLoc) {
        this._loc[layer] = newLoc[layer] as T[keyof T];
        keep = false;
      } else if (!keep) {
        delete this._loc[layer];
      }
    }
  }
}

export interface CsvLocation {
  table: string;
  row: number;
  column: number;
}
/**
 * CsvLocationTracker is a specialized LocationTracker for CSV files.
 */
export class CsvLocationTracker extends LocationTracker<CsvLocation> {
  constructor() {
    super(['table', 'row', 'column']);
  }
}
