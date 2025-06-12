import {
  ColumnDescriptionWithNumberDataTypeAndFormat,
  CsvwColumnDescription,
} from '../types/descriptor/column-description.js';
import {
  CsvwDatatype,
  CsvwNumberFormat,
} from '../types/descriptor/datatype.js';
import { IssueTracker } from './issue-tracker.js';

export function findFormatedColumns(allColumns: CsvwColumnDescription[]) {
  const castedColumns = [];
  for (const column of allColumns) {
    castedColumns.push(convertColumnToNumberFormattedColumn(column));
  }
  return castedColumns;
}

export function isNumberColumn(column: CsvwColumnDescription) {
  if (column.datatype) {
    const dataType = column.datatype as CsvwDatatype;
    if (dataType.format) {
      const format = dataType.format as CsvwNumberFormat;
      if (format.pattern) {
        return true;
      }
    }
  }
  return false;
}

export function convertColumnToNumberFormattedColumn(column: CsvwColumnDescription) {
  if (column.datatype) {
    const dataType = column.datatype as CsvwDatatype;
    if (dataType.format) {
      const format = dataType.format as CsvwNumberFormat;
      if (format.pattern) {
        return column as ColumnDescriptionWithNumberDataTypeAndFormat;
      }
    }
  }
}

function patternIsValid(pattern: string): boolean {
  //This probably doesnt encapsulate all the rules of a valid pattern.
  let hasDecimal = false;
  let hasGrouping = false;
  for (const char of pattern) {
    if (char !== '#' && char != '0' && char != '.' && char != ',') {
      return false;
    }
    if (char === '.') {
      if (hasDecimal) {
        return false;
      }
      hasDecimal = true;
    } else if (char === ',') {
      if (hasGrouping) {
        return false;
      }
      hasGrouping = true;
    }
  }
  return true;
}

export function transformNumber(
  value: string,
  columnDescription: ColumnDescriptionWithNumberDataTypeAndFormat,
  issueTracker: IssueTracker
): string {

  if (columnDescription.datatype.format.pattern) {
    if (!patternIsValid(columnDescription.datatype.format.pattern)) {
      issueTracker.addError(
        `Invalid pattern: ${columnDescription.datatype.format.pattern} take a look at https://www.unicode.org/reports/tr35/tr35-39/tr35-numbers.html#Number_Patterns`,
        true
      );
      return value;
    }
    const splitted = value.split('.');
    if (splitted.length == 1) {
      return value;
    } else if (splitted.length == 2) {
      const decimalChar = columnDescription.datatype.format.decimalChar || '.';
      const groupChar = columnDescription.datatype.format.groupChar || ',';
      const pattern = columnDescription.datatype.format.pattern;
      const decimalPart = splitted[1];
      const integerPart = splitted[0];
      const splittedPattern = pattern.split('.');
      const integerPattern = splittedPattern[0];
      const decimalPattern = splittedPattern[1];
      const reversedIntegerPart = integerPart.split('').reverse().join('');
      const reversedIntegerPattern = integerPattern.split('').reverse().join('');
      let transformedNumber = transformNumberInner(reversedIntegerPattern, reversedIntegerPart, groupChar).split('').reverse().join('') 
      + decimalChar + transformNumberInner(decimalPattern, decimalPart, groupChar) //merging the integer and decimal parts on decimalChar
      let stringTransformedNumber = +transformedNumber;
      return stringTransformedNumber.toString();
    } else {
      issueTracker.addError(
        `Too many decimal characters in value: ${value}`,
        true
      );
      return value;
    }
  }
  return value;
}

function transformNumberInner(
  pattern: string,
  number: string,
  groupChar: string
): string {
  let transformedPart = '';
  let patternLongerThanNumber = false;
  let numberIndex = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (numberIndex == number.length) {
      patternLongerThanNumber = true;
    }
    if (pattern[i] == '0') {
      transformedPart += patternLongerThanNumber ? '0' : number[numberIndex];
      numberIndex++;
    } else if (pattern[i] == '#' && !patternLongerThanNumber) {
      transformedPart += number[numberIndex] || '';
      numberIndex++;
    } else if (pattern[i] == ',' && !patternLongerThanNumber) {
      transformedPart += groupChar;
    }
    else if (pattern[i]== 'E' || pattern[i] == 'e') {
      transformedPart += 'E'; //this will be taken care later using + operation at let stringTransformedNumber = +transformedNumber;
    }
  }
  /*
    if (!patternLongerThanNumber) {
      //add the rest of the number
      //maybe this should not happend in case of decimal part, as shown in the table https://www.unicode.org/reports/tr35/tr35-numbers.html#Number_Format_Patterns
      transformedPart += number.substring(pattern.length);
    }*/
  return transformedPart;
}

/**
 * Transforms numeric values in a JSON table string based on the column formatting
 * specified in the provided descriptor. The transformation is applied to columns
 * that are identified as requiring formatting.
 *
 * @param jsonTable - The JSON table as a string where numeric values need to be transformed.
 * @param descriptor - The descriptor wrapper containing metadata about the table schema and columns.
 * @param issueTracker - An issue tracker instance to log any issues encountered during transformation.
 * @returns The transformed JSON table as a string with formatted numeric values.
 */

/*
export function transformNumbersInTable(
  jsonTable: string,
  descriptor: DescriptorWrapper,
  issueTracker: IssueTracker
): string {
  const rgxForNumberRowInJson = `\\s*:\\s*"\\d*\\.*\\d*"`;
  const regexForNumberInJson = /"(\d*\.?\d*)"/;
  const colums = descriptor.descriptor.tableSchema?.columns;
  if (colums) {
    const formatedColumns = findFormatedColumns(colums);
    for (const column of formatedColumns) {
      if (column.name) {
        const regex = new RegExp(
          `"${column.name}"${rgxForNumberRowInJson}`,
          'g'
        );
        jsonTable = jsonTable.replace(regex, (match) => {
          const value = match.match(regexForNumberInJson)?.[1] || '';
          const transformedValue = transformNumber(value, column, issueTracker);
          return match.replace(value, transformedValue);
        });
      }
    }
  }
  return jsonTable;
}
*/