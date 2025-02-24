import { Expanded } from './expanded.js';
import { CsvwTableGroupDescription } from './table-group.js';
import { CsvwTableDescription } from './table.js';
import { CsvwTopLevelProperties } from './top-level-props.js';

export type CompactedCsvwDescriptor = (
  | CsvwTableDescription
  | CsvwTableGroupDescription
) &
  CsvwTopLevelProperties;

export type WithAdditionalProps<T> = {
  [k in keyof T]: WithAdditionalProps<T[k]>;
} & { [k: string]: unknown };

export type WithoutContext<T> = {
  [k in keyof T as k extends '@context' ? never : k]: WithoutContext<T[k]>;
};

export type CompactedExpandedCsvwDescriptor = Expanded<
  WithoutContext<CompactedCsvwDescriptor>
>;
