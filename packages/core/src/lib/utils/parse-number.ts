import { CsvwNumberFormat } from '../types/descriptor/datatype.js';
import { IssueTracker } from './issue-tracker.js';
import { commonPrefixes, invalidValuePrefix } from './prefix.js';

const { xsd } = commonPrefixes;

const numericRegexes = {
  [xsd + 'integer']: /^[-+]?[0-9]+$/,
  [xsd + 'decimal']: /^(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)$/,
  [xsd + 'long']: /^[-+]?[0-9]+$/,
  [xsd + 'int']: /^[-+]?[0-9]+$/,
  [xsd + 'short']: /^[-+]?[0-9]+$/,
  [xsd + 'byte']: /^[-+]?[0-9]+$/,
  [xsd + 'nonNegativeInteger']: /^\+?[0-9]+$/,
  [xsd + 'positiveInteger']: /^\+?[1-9][0-9]*$/,
  [xsd + 'unsignedLong']: /^[-+]?[0-9]+$/,
  [xsd + 'unsignedInt']: /^[-+]?[0-9]+$/,
  [xsd + 'unsignedShort']: /^[-+]?[0-9]+$/,
  [xsd + 'unsignedByte']: /^[-+]?[0-9]+$/,
  [xsd + 'double']: /^(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)([Ee](\+|-)?[0-9]+)?$/,
  [xsd + 'float']: /^(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)([Ee](\+|-)?[0-9]+)?$/,
  [xsd + 'nonPositiveInteger']: /^(0|(-[1-9][0-9]*))$/,
  [xsd + 'negativeInteger']: /^-[1-9][0-9]*$/,
};
const extents: Record<string, [number, number]> = {
  [xsd + 'long']: [-(2 ** 63), 2 ** 63 - 1],
  [xsd + 'int']: [-(2 ** 31), 2 ** 31 - 1],
  [xsd + 'short']: [-(2 ** 15), 2 ** 15 - 1],
  [xsd + 'byte']: [-(2 ** 7), 2 ** 7 - 1],
  [xsd + 'unsignedLong']: [0, 2 ** 64 - 1],
  [xsd + 'unsignedInt']: [0, 2 ** 32 - 1],
  [xsd + 'unsignedShort']: [0, 2 ** 16 - 1],
  [xsd + 'unsignedByte']: [0, 2 ** 8 - 1],
};

/**
 * Numbers in csv can be formatted in many different ways. This class can parse them into a standard format.
 */
export class NumberParser {
  constructor(private issueTracker: IssueTracker) {}

  /**
   * Parse a number from a string using the given format.
   */
  parse(value: string, format: CsvwNumberFormat, dtUri: string): string {
    if (
      (dtUri === xsd + 'float' || dtUri === xsd + 'double') &&
      (value === 'INF' || value === 'NaN' || value === '-INF')
    ) {
      return value;
    }

    const decimal = format?.decimalChar as string;
    const groupChar = format?.groupChar as string;
    const pattern = format?.pattern as string;

    const transformedNumber =
      pattern == null
        ? this.castToNumberWithoutPattern(value, decimal, groupChar, dtUri)
        : this.castToNumberByPattern(pattern, value, decimal, groupChar);

    if (transformedNumber == null) {
      if (pattern == null) {
        this.issueTracker.addWarning(
          `The value "${value}" does not match the datatype ${dtUri.slice(
            xsd.length
          )}.`
        );
      } else {
        this.issueTracker.addWarning(
          `The value "${value}" does not match the pattern "${pattern}".`
        );
      }
      return invalidValuePrefix + value;
    }
    if (transformedNumber === 0 && value.startsWith('-')) return '-0';
    return transformedNumber + '';
  }

  private castToNumberWithoutPattern(
    value: string,
    decimal: string,
    groupChar: string,
    dtUri: string
  ): number | null {
    if (value.split(groupChar).some((v) => v.length === 0)) return null;
    value = value.replaceAll(groupChar, '').replaceAll(decimal, '.');
    let divideBy = 1;
    if (value.endsWith('%')) {
      divideBy = 100;
      value = value.slice(0, -1);
    } else if (value.endsWith('‰')) {
      divideBy = 1000;
      value = value.slice(0, -1);
    } else if (value.startsWith('%')) {
      divideBy = 100;
      value = value.slice(1);
    } else if (value.startsWith('‰')) {
      divideBy = 1000;
      value = value.slice(1);
    }

    if (!value.match(numericRegexes[dtUri])) {
      return null;
    }
    const ext = extents[dtUri];
    const num = +value;
    if (ext) {
      if (num < ext[0] || num > ext[1]) {
        return null;
      }
    }
    return num / divideBy;
  }

  private castToNumberByPattern(
    pattern: string,
    number: string,
    decimalChar: string,
    groupChar: string
  ): number | null {
    let divideBy: number;
    const getDivideBy = this.getDivideBy(pattern, number);
    if (getDivideBy == null) {
      return null;
    }
    ({ pattern, number, divideBy } = getDivideBy);

    if (
      pattern.includes('e') !== number.includes('e') ||
      pattern.includes('E') !== number.includes('E')
    ) {
      return null;
    }
    pattern = pattern.toLowerCase();
    number = number.toLowerCase();

    const [mantissaPattern, expPattern] = pattern.split('e');
    const [integerPattern, decimalPattern] = mantissaPattern.split('.');
    const [mantissa, exp] = number.split('e');
    const [integer, decimal] = mantissa.split(decimalChar);

    let res = this.castInteger(integer, integerPattern ?? '', groupChar);
    if (res === null) {
      return null;
    }
    if (decimal) {
      if (decimalPattern === undefined) return null;
      const decRes = this.castDecimals(decimal, decimalPattern, groupChar);
      if (decRes === null) {
        return null;
      }
      res += '.' + decRes;
    }
    if (exp) {
      const expRes = this.castInteger(exp, expPattern ?? '', groupChar);
      if (expRes === null) {
        return null;
      }
      res += 'e' + expRes;
    }
    return +res / divideBy;
  }

  private getDivideBy(
    pattern: string,
    number: string
  ): {
    pattern: string;
    number: string;
    divideBy: number;
  } | null {
    for (const [char, val] of [
      ['%', 100],
      ['‰', 1000],
    ] as const) {
      for (const pos of ['startsWith', 'endsWith'] as const) {
        if (pattern[pos](char)) {
          if (!number[pos](char)) {
            return null;
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

  private castDecimals(
    decimals: string,
    pattern: string,
    groupChar: string
  ): string | null {
    let res = '';
    let pI = 0;

    for (let dI = 0; dI < decimals.length; dI++) {
      const p = pattern[pI];
      const d = decimals[dI];
      if (p === '0') {
        if (!this.isNumberChar(d)) {
          return null;
        }
        res += d;
        pI++;
      } else if (p === '#') {
        if (this.isNumberChar(d)) {
          res += d;
          pI++;
        } else {
          while (pI < pattern.length && pattern[pI] === '#') ++pI;
          dI--;
        }
      } else if (p === ',') {
        if (d !== groupChar) {
          return null;
        }
        pI++;
      } else if (p === undefined && this.isNumberChar(d)) {
        if (decimals.endsWith('0')) return null;
        res += d;
      } else if (p === undefined && d === groupChar) {
        continue;
      } else {
        return null;
      }
    }
    if (
      pI < pattern.length &&
      pattern.slice(pI).replace(/[#,]/g, '').length !== 0
    )
      return null;
    return res;
  }
  private castInteger(
    integer: string,
    pattern: string,
    groupChar: string
  ): string | null {
    let res = '';
    let pI = pattern.length - 1;
    let pEnd = 0;
    let iEnd = 0;
    let sign = '';

    if (pattern[0] === '+' || pattern[0] === '-') {
      pEnd = 1;
      if (integer[0] !== '-' && integer[0] !== '+') {
        return null;
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
        if (!this.isNumberChar(d)) {
          return null;
        }
        res = d + res;
        pI--;
      } else if (p === '#') {
        if (this.isNumberChar(d)) {
          res = d + res;
          pI--;
        } else {
          while (pI >= pEnd && pattern[pI] === '#') pI--;
          iI++;
        }
      } else if (p === ',') {
        if (d !== groupChar) {
          return null;
        }
        pI--;
      } else if (p === undefined && this.isNumberChar(d)) {
        if (integer.startsWith('0')) return null;
        res = d + res;
      } else if (p === undefined && d === groupChar) {
        continue;
      } else {
        return null;
      }
    }
    if (
      pI >= pEnd &&
      pattern.slice(0, pI + 1).replace(/[#,]/g, '').length !== 0
    )
      return null;
    return sign + res;
  }

  private isNumberChar(char: string): boolean {
    return char >= '0' && char <= '9';
  }
}
