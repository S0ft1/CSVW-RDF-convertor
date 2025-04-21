import { CsvwNumberFormat } from '../types/descriptor/datatype.js';
import issueTracker from '../utils/error-collector.js';

export function parseNumber(value: string, format: CsvwNumberFormat): string {
  if (value === 'INF' || value === 'NaN' || value === '-INF') {
    return value;
  }

  const decimal = format?.decimalChar as string;
  const groupChar = format?.groupChar as string;
  const pattern = format?.pattern as string;

  const transformedNumber =
    pattern == null
      ? castToNumberWithoutPattern(value, decimal, groupChar)
      : castToNumberByPattern(pattern, value, decimal, groupChar);

  if (transformedNumber == null) {
    throw Error(`Invalid number format: ${value} ${pattern}`);
  }
  if (transformedNumber === 0 && value.startsWith('-')) return '-0';
  return transformedNumber + '';
}

function castToNumberWithoutPattern(
  value: string,
  decimal: string,
  groupChar: string
): number | null {
  let newVal = '';
  let divideBy = 1;

  for (let i = 0; i < value.length; ++i) {
    if (value[i] == decimal) {
      newVal += '.';
    } else if (value[i] == groupChar) {
      //ignore group characters
      continue;
    } else if (value[i] == '%' || value[i] == '‰') {
      //if the value is notated with % or ‰, we need to divide it by 100 or 1000
      if (i != value.length - 1 && i !== 0) {
        issueTracker.addError(
          '% or ‰ symbol not at the end or start of default patterned number at cell:'
        );
      } else {
        divideBy = value[i] == '%' ? 100 : 1000;
      }
    } else {
      newVal += value[i];
    }
  }
  return +newVal / divideBy;
}

function castToNumberByPattern(
  pattern: string,
  number: string,
  decimalChar: string,
  groupChar: string
): number | null {
  pattern = pattern.toLowerCase();
  number = number.toLowerCase();
  let divideBy: number;
  ({ pattern, number, divideBy } = getDivideBy(pattern, number));

  const [mantissaPattern, expPattern] = pattern.split('e');
  const [integerPattern, decimalPattern] = mantissaPattern.split('.');
  const [mantissa, exp] = number.split('e');
  const [integer, decimal] = mantissa.split(decimalChar);

  if (!expPattern !== !exp) {
    issueTracker.addError('exponent pattern mismatch at cell:');
  }
  let res = castInteger(integer, integerPattern, groupChar);
  if (decimal) {
    res += '.' + castDecimals(decimal, decimalPattern, groupChar);
  }
  if (exp) {
    res += 'e' + exp;
  }
  return +res / divideBy;
}

function getDivideBy(
  pattern: string,
  number: string
): {
  pattern: string;
  number: string;
  divideBy: number;
} {
  for (const [char, val] of [
    ['%', 100],
    ['‰', 1000],
  ] as const) {
    for (const pos of ['startsWith', 'endsWith'] as const) {
      if (pattern[pos](char)) {
        if (!number[pos](char)) {
          issueTracker.addError(
            `${char} symbol not at the ${pos.slice(0, -4)} of number at cell:`
          );
        }
        const i = pos === 'startsWith' ? 1 : 0;
        return {
          pattern: pattern.slice(i, pattern.length - 1 + i),
          number: number.slice(i, number.length - 1 + i),
          divideBy: val,
        };
      }
    }
  }
  return {
    pattern: pattern,
    number: number,
    divideBy: 1,
  };
}

function castDecimals(
  decimals: string,
  pattern: string,
  groupChar: string
): string {
  let res = '';
  let pI = 0;

  for (let dI = 0; dI < decimals.length; dI++) {
    const p = pattern[pI];
    const d = decimals[dI];
    if (p === '0') {
      if (!isNumberChar(d)) {
        issueTracker.addError('integer part is not a number at cell:');
        return '0';
      }
      res += d;
      pI++;
    } else if (p === '#') {
      if (isNumberChar(d)) {
        res += d;
        pI++;
      } else {
        while (pI < pattern.length && pattern[pI] === '#') ++pI;
        dI--;
      }
    } else if (p === ',') {
      if (d !== groupChar) {
        issueTracker.addError('missing number separator at cell:');
        return '0';
      }
      pI++;
    } else if (p === undefined && isNumberChar(d)) {
      res += d;
    } else if (p === undefined && d === groupChar) {
      continue;
    } else {
      issueTracker.addError(`char ${d} unrecognized at cell:`);
      return '0';
    }
  }
  return res;
}
function castInteger(
  integer: string,
  pattern: string,
  groupChar: string
): string {
  let res = '';
  let pI = pattern.length - 1;
  let pEnd = 0;
  let iEnd = 0;
  let sign = '';

  if (pattern[0] === '+') {
    pEnd = 1;
    if (integer[0] !== '-' && integer[0] !== '+') {
      issueTracker.addError('missing sign at cell:');
    }
  }
  if (integer[0] === '-' || integer[0] === '+') {
    iEnd = 1;
    sign = integer[0];
  }
  for (let iI = integer.length - 1; iI >= iEnd; --iI) {
    const p = pattern[pI];
    const d = integer[iI];
    if (p === '0') {
      if (!isNumberChar(d)) {
        issueTracker.addError('integer part is not a number at cell:');
        return '0';
      }
      res = d + res;
      pI--;
    } else if (p === '#') {
      if (isNumberChar(d)) {
        res = d + res;
        pI--;
      } else {
        while (pI >= pEnd && pattern[pI] === '#') pI--;
        iI++;
      }
    } else if (p === ',') {
      if (d !== groupChar) {
        issueTracker.addError('missing number separator at cell:');
        return '0';
      }
      pI--;
    } else if (p === undefined && isNumberChar(d)) {
      res = d + res;
    } else if (p === undefined && d === groupChar) {
      continue;
    } else {
      issueTracker.addError(`char ${d} unrecognized at cell:`);
      return '0';
    }
  }
  return sign + res;
}

function isNumberChar(char: string): boolean {
  return char >= '0' && char <= '9';
}
