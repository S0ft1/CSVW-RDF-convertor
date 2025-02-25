import { Expanded, MaybeExpanded, WithAdditionalProps } from './expanded.js';
import { CsvwTableGroupDescription } from './table-group.js';
import { CsvwTableDescription } from './table.js';
import { CsvwTopLevelProperties } from './top-level-props.js';

export type CompactedCsvwDescriptor =
  | WithAdditionalProps<CsvwTableDescription & CsvwTopLevelProperties>
  | WithAdditionalProps<CsvwTableGroupDescription & CsvwTopLevelProperties>;

export type CompactedExpandedCsvwDescriptor = Expanded<CompactedCsvwDescriptor>;

export type AnyCsvwDescriptor = MaybeExpanded<CompactedCsvwDescriptor>;
