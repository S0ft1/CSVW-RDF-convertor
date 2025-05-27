import { format } from 'date-fns';
import { ColumnDescriptionWithDateDataTypeAndFormat, CsvwColumnDescription } from '../types/descriptor/column-description.js';
import { CsvwDatatype } from '../types/descriptor/datatype.js';

export function formatDate(dateStr: string, formatStr: string): string {
    formatStr = formatStr.replace(/T/g, "'T'");
    const date = new Date(dateStr);
    return format(date, formatStr).toString();
}

export function isDateFormatedColumn(column: CsvwColumnDescription | undefined): boolean {
    if (column === undefined) {
        return false;
    }
    if (column.datatype) {
        const dataType = column.datatype as CsvwDatatype;
        if (dataType.base === 'datetime' || dataType.base === 'date') {
            if (dataType.format) {
                return true
            }
        }
    }
    return false;
}
export function convertColumnToDateFormattedColumn(column: CsvwColumnDescription) : ColumnDescriptionWithDateDataTypeAndFormat | null {
    if (column.datatype) {
        const dataType = column.datatype as CsvwDatatype;
        if (dataType.base === 'datetime' || dataType.base === 'date') {
            if (dataType.format) {
                return column as ColumnDescriptionWithDateDataTypeAndFormat;
            }
        }
    }
    return null;
}