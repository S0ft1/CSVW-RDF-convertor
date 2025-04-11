import { CsvwNumberFormat } from '../types/descriptor/datatype.js';
import issueTracker from '../utils/error-collector.js';

export function parseNumber(value: string, format: CsvwNumberFormat): number {
  if (value === 'INF') return Infinity;
  if (value === '-INF') return -Infinity;
  if (value === 'NaN') return NaN;

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
  return transformedNumber;
}

/** 
function prepareDefaultParameters(decimal: any, groupChar: any, pattern:any) : void {
  if(decimal != typeof String){
    issueTracker.addWarning("DecimalChar property is not string at cell:");
    decimal = null;
  }

  if(decimal == null) {
      decimal = '.'
  }

  if(groupChar != typeof String){
    issueTracker.addWarning("GroupChar property is not string at cell:");
    groupChar = null;
  }

  if(groupChar == null) {
    groupChar = ','
  }

  if(pattern != typeof String){
    issueTracker.addWarning("Pattern property is not string at cell:");
    pattern = null;
  }
}
*/

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
  let zeroPadding = true;

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const numberChar = number[i];
    if (i == number.length) {
      break;
    }
    if (char === '#') {
      if (!isNumberChar(numberChar)) {
        issueTracker.addError('Pattern is not matching with number at cell:');
        return null;
      }
      strNumber += numberChar;
      zeroPadding = false;
    } else if (char === '0') {
      if (!isNumberChar(numberChar)) {
        issueTracker.addError('Pattern is not matching with number at cell:');
        return null;
      }
      if (numberChar != '0' || !zeroPadding) {
        zeroPadding = false;
        strNumber += numberChar;
      }
    } else if (char === groupChar) {
      if (numberChar !== groupChar) {
        issueTracker.addError(
          'Group char is not present in the number at cell:'
        );
        return null;
      }
    } else if (char === decimal) {
      if (numberChar !== decimal) {
        issueTracker.addError(
          'Decimal char is not present in the number at cell:'
        );
        return null;
      }
      strNumber += '.';
    }
  }
  return +strNumber;
}

function isNumberChar(char: string): boolean {
  return char >= '0' && char <= '9';
}
