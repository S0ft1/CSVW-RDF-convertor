import { Expanded, MaybeExpanded, WithAdditionalProps } from './expanded.js';
import { CsvwTableGroupDescription } from './table-group.js';
import { CsvwTableDescription } from './table.js';
import { CsvwTopLevelProperties } from './top-level-props.js';

export type CompactedCsvwDescriptor =
  | (CsvwTableDescription & CsvwTopLevelProperties)
  | (CsvwTableGroupDescription & CsvwTopLevelProperties);

export type CompactedExpandedCsvwDescriptor = Expanded<
  WithAdditionalProps<CompactedCsvwDescriptor>
>;

export type AnyCsvwDescriptor = MaybeExpanded<
  WithAdditionalProps<CompactedCsvwDescriptor>
>;
