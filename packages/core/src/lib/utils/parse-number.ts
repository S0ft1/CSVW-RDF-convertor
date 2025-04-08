import { CsvwNumberFormat } from '../types/descriptor/datatype.js';

export function parseNumber(value: string, format?: CsvwNumberFormat): number {
  if (value === 'INF') return Infinity;
  if (value === '-INF') return -Infinity;
  if (format?.groupChar) {
    value = value.replaceAll(format.groupChar, '');
  }
  if (format?.decimalChar) {
    value = value.replaceAll(format.decimalChar, '.');
  }
  return +value;
}
