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
      if (i != value.length - 1) {
        issueTracker.addError(
          '% or ‰ symbol not at the end of default patterned number at cell:'
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
  decimal: string,
  groupChar: string
): number | null {
  let strNumber = '';
  let patternIndex = 0;
  let numberIndex = 0;
  while (numberIndex != number.length) {
    const numberChar = number[numberIndex];
    const patternChar = pattern[patternIndex];
    if (patternChar == '#' || patternChar == '0') {
      if (isNumberChar(numberChar)) {
        numberIndex++;
        strNumber += numberChar;
      } else {
        patternIndex++;
      }
      continue;
    } else if (patternChar == groupChar) {
      if (numberChar == groupChar) {
        numberIndex++;
        patternIndex++;
        continue;
      } else {
        issueTracker.addError("Group char isn't where it should be at cell:");
        break;
      }
    } else if (patternChar == decimal) {
      if (numberChar == decimal) {
        numberIndex++;
        patternIndex++;
        strNumber += '.';
      } else {
        issueTracker.addError("Decimal char isn't where it should be at cell:");
        break;
      }
    } else if (
      (patternChar == 'e' || patternChar == 'E') &&
      (numberChar == 'E' || numberChar == 'e')
    ) {
      strNumber += 'E';
      patternIndex++;
      numberIndex++;
    } else {
      issueTracker.addError('FATAL: char unrecognized at cell:');
      return 0;
    }
  }
  return +strNumber;
}

function isNumberChar(char: string): boolean {
  return char >= '0' && char <= '9';
}
