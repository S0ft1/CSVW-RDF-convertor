import { Duration } from '../types/duration.js';

/**
 * Parse a duration string into a Duration object.
 * @param value string to parse
 * @returns the parsed date
 */
export function parseDuration(value: string): Duration {
  const match =
    value.match(
      /^-?P(?:([0-9]+)Y)?(?:([0-9]+)M)?(?:([0-9]+)D)?(?:T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+(?:\.[0-9]+)?)S)?)?$/,
    ) ?? [];

  let years: number;
  let months: number;
  let days: number;
  let hours: number;
  let minutes: number;
  let seconds: number;
  if (value.startsWith('-')) {
    years = match[1] ? -match[1] : 0;
    months = match[2] ? -match[2] : 0;
    days = match[3] ? -match[3] : 0;
    hours = match[4] ? -match[4] : 0;
    minutes = match[5] ? -match[5] : 0;
    seconds = match[6] ? -match[6] : 0;
  } else {
    years = match[1] ? +match[1] : 0;
    months = match[2] ? +match[2] : 0;
    days = match[3] ? +match[3] : 0;
    hours = match[4] ? +match[4] : 0;
    minutes = match[5] ? +match[5] : 0;
    seconds = match[6] ? +match[6] : 0;
  }

  return new Duration(years, months, days, hours, minutes, seconds);
}
