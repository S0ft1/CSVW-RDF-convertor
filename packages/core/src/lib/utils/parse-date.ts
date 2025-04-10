import { parse } from 'date-fns';
import { commonPrefixes } from './prefix.js';
import { TZDate } from '@date-fns/tz';

const { xsd } = commonPrefixes;

/**
 * Parse a date string into a Date object.
 * @param value string to parse
 * @param dtUri datatype URI
 * @param format date format string
 * @returns the parsed date
 */
export function parseDate(
  value: string,
  dtUri: string,
  format?: string
): TZDate {
  let tz = '';
  if (format) {
    if (format.endsWith('X')) {
      [value, tz] = splitTz(value, dtUri);
    }
    const date = parse(
      value + tz,
      format.replace(/[T]/g, "'$&'"),
      new Date(2000, 0)
    );
    return new TZDate(date, tz === 'Z' ? 'UTC' : tz || undefined);
  }
  [value, tz] = splitTz(value, dtUri);
  if (dtUri === xsd + 'time') {
    value = '2000-01-01T' + value;
  } else if (dtUri === xsd + 'date') {
    value = value + 'T00:00:00';
  }
  return new TZDate(value + tz, tz === 'Z' ? 'UTC' : tz || undefined);
}

/**
 * Split a date string into date and timezone components.
 * @param value string to parse
 * @param dtUri datatype URI
 * @returns [date string, timezone string]
 */
export function splitTz(value: string, dtUri: string): [string, string] {
  if (value.endsWith('Z')) {
    return [value.slice(0, -1), 'Z'];
  }
  const lastIndex = value.lastIndexOf('+');
  if (lastIndex > -1) {
    return [value.slice(0, lastIndex), value.slice(lastIndex)];
  }
  const dashes = value.split('-');
  const threshold = dtUri === xsd + 'time' ? 1 : 3;
  return [
    dashes.slice(0, threshold).join('-'),
    dashes[threshold] ? '-' + dashes[threshold] : '',
  ];
}
