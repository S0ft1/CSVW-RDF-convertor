import { CsvwDialectDescription } from "./descriptor/dialect-description.js";
import { CsvwSchemaDescription } from "./descriptor/schema-description.js";
import { CsvwTableGroupDescription } from "./descriptor/table-group.js";
import { CsvwTableDescription } from "./descriptor/table.js";

export interface CsvwTable extends CsvwTableDescription {
    rows:string[][];
}