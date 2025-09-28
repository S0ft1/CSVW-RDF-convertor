import { CsvwColumn } from './convertor.js';
import { DescriptorWrapper } from '../descriptor.js';

import { CsvwTableDescriptionWithRequiredColumns } from '../types/descriptor/table.js';

import { coerceArray } from '../utils/coerce.js';
import { expandIri } from '../utils/expand-iri.js';
import { commonPrefixes, dtUris } from '../utils/prefix.js';

import { parseTemplate } from 'url-template';
import { SUBJ_COL, UNKOWN_TYPE_TABLE } from './schema-inferrer.js';
import { getBooleanFilter, isBooleanColumn } from '../utils/format-boolean.js';
import { getNumericFilter, isNumericColumn } from '../utils/format-number.js';
import {
  getDateTimeFilter,
  isDateTimeColumn,
} from '../utils/format-datetime.js';
import {
  getDurationFilter,
  isDurationColumn,
} from '../utils/format-duration.js';
import { getOtherFilter } from '../utils/format-other.js';

const { xsd, rdf } = commonPrefixes;

/**
 * Creates SPARQL query.
 * @param table CSV Table
 * @param columns Columns including virtual ones
 * @param useNamedGraphs Query from named graphs in the SPARQL query
 * @returns SPARQL query as a string
 */
export function createQuery(
  table: CsvwTableDescriptionWithRequiredColumns,
  wrapper: DescriptorWrapper,
): [CsvwColumn[], string] {
  let queryVarCounter = 0;
  const queryVars: Record<string, string> = {};

  const columns: CsvwColumn[] = table.tableSchema.columns.map((column, i) => {
    const defaultLang =
      (wrapper.descriptor['@context']?.[1] as any)?.['@language'] ?? '@none';

    let name = `_col.${i + 1}`;
    if (column.name !== undefined) {
      name = encodeURIComponent(column.name).replaceAll('-', '%2D');
    } else if (column.titles !== undefined) {
      if (typeof column.titles === 'string' || Array.isArray(column.titles)) {
        name = encodeURIComponent(coerceArray(column.titles)[0]).replaceAll(
          '-',
          '%2D',
        );
      } else {
        // TODO: use else (startsWith(defaultLang)) as in core/src/lib/csvw2rdf/convertor.ts, or set inherited properties just away in normalizeDescriptor().
        if (defaultLang in column.titles) {
          name = encodeURIComponent(
            coerceArray(column.titles[defaultLang])[0],
          ).replaceAll('-', '%2D');
        }
      }
    }

    let title = undefined;
    if (column.titles !== undefined) {
      if (typeof column.titles === 'string' || Array.isArray(column.titles)) {
        title = coerceArray(column.titles)[0];
      } else {
        // TODO: use else (startsWith(defaultLang)) as in core/src/lib/csvw2rdf/convertor.ts, or set inherited properties just away in normalizeDescriptor().
        if (defaultLang in column.titles) {
          title = coerceArray(column.titles[defaultLang])[0];
        }
      }
    }
    if (title === undefined && column.name !== undefined) {
      title = column.name;
    }
    if (title === undefined) title = `_col.${i + 1}`;

    const aboutUrl = column.aboutUrl;
    const propertyUrl = column.propertyUrl;
    const valueUrl = column.valueUrl;

    if (queryVars[aboutUrl ?? ''] === undefined)
      queryVars[aboutUrl ?? ''] = `_${queryVarCounter++}`;
    if (valueUrl && queryVars[valueUrl] === undefined)
      queryVars[valueUrl] = `_${queryVarCounter++}`;

    let queryVar: string;
    if (
      (propertyUrl && expandIri(propertyUrl) === rdf + 'type') ||
      name === SUBJ_COL
    ) {
      queryVar = queryVars[aboutUrl ?? ''];
    } else {
      queryVar = valueUrl ? queryVars[valueUrl] : `_${queryVarCounter++}`;
    }

    return { name: name, title: title, queryVariable: queryVar };
  });

  const lines: string[] = [];
  let allOptional = true;
  const topLevel: number[] = [];
  for (let index = 0; index < table.tableSchema.columns.length; index++) {
    const column = table.tableSchema.columns[index];

    const aboutUrl = column.aboutUrl;
    const referencedBy = table.tableSchema.columns.find((col) => {
      if (col.propertyUrl && expandIri(col.propertyUrl) === rdf + 'type')
        return col !== column && col.aboutUrl && col.aboutUrl === aboutUrl;
      else return col !== column && col.valueUrl && col.valueUrl === aboutUrl;
    });

    // TODO: use tableSchema.foreignKeys
    if (
      !referencedBy ||
      (table.tableSchema.primaryKey &&
        coerceArray(table.tableSchema.primaryKey).includes(columns[index].name))
    ) {
      const patterns = createTriplePatterns(table, columns, index, queryVars);
      // Required columns are prepended, because OPTIONAL pattern should not be at the beginning.
      // For more information, see createSelectOfOptionalSubjects function bellow.
      if (column.required) {
        allOptional = false;
        lines.unshift(...patterns.split('\n'));
      } else {
        lines.push(...patterns.split('\n'));
      }
      topLevel.push(index);
    }
  }

  if (allOptional) {
    lines.unshift(
      createSelectOfOptionalSubjects(table, columns, topLevel, queryVars),
    );
  }

  return [
    columns,
    `SELECT ${columns
      .filter((col, i) => !table.tableSchema.columns[i].virtual)
      .map((column) => `?${column.queryVariable}`)
      .join(' ')}
WHERE {
  {
${lines.map((line) => `  ${line}`).join('\n')}
  }
  UNION
  {
    GRAPH ?_graph {
${lines.map((line) => `    ${line}`).join('\n')}
    }
  }
}`,
  ];
}

/**
 * Creates SPARQL nested SELECT query that is used to prevent matching of OPTIONAL against empty mapping
 * if all patterns are optional by adding all top-level subjects to the result mapping first.
 * {@link https://stackoverflow.com/questions/25131365/sparql-optional-query/61395608#61395608}
 * {@link https://github.com/blazegraph/database/wiki/SPARQL_Order_Matters}
 * @param table CSV Table
 * @param columns Columns including virtual ones
 * @param topLevel Indices of top level columns (i.e. those that does are not referenced by other columns)
 * @returns SPARQL query for selecting subjects with some from the optional tripple
 */
function createSelectOfOptionalSubjects(
  table: CsvwTableDescriptionWithRequiredColumns,
  columns: CsvwColumn[],
  topLevel: number[],
  queryVars: Record<string, string>,
): string {
  const subjects = new Set<string>();
  const alternatives: string[] = [];

  for (const index of topLevel) {
    const column = table.tableSchema.columns[index];

    const aboutUrl = column.aboutUrl;
    const propertyUrl = column.propertyUrl;
    const valueUrl = column.valueUrl;
    const lang = column.lang;
    let datatype = undefined;
    if (typeof column.datatype === 'string') datatype = column.datatype;
    else if (column.datatype !== undefined) datatype = column.datatype.base;

    const subject = `?${queryVars[aboutUrl ?? '']}`;

    const predicate = propertyUrl
      ? `<${expandIri(
          decodeURI(
            parseTemplate(propertyUrl).expand({
              _column: index + 1,
              _sourceColumn: index + 1,
              _name: columns[index].name,
            }),
          ),
        )}>`
      : `<${table.url}#${columns[index].name}>`;

    let object = `?_object`;
    if (
      valueUrl &&
      valueUrl.search(/\{(?!_column|_sourceColumn|_name)[^{}]*\}/) === -1
    ) {
      object = decodeURI(
        parseTemplate(valueUrl).expand({
          _column: index + 1,
          _sourceColumn: index + 1,
          _name: columns[index].name,
        }),
      );
      if (predicate === `<${rdf}type>`) {
        object = `<${expandIri(object)}>`;
      } else if (datatype) {
        if (datatype === 'string')
          object = lang
            ? `"${object}"@${lang}`
            : `"${object}"^^<${xsd + 'string'}>`;
        else object = `"${object}"^^<${dtUris[datatype]}>`;
      } else {
        object = `"${object}"`;
      }
    }

    if (predicate === `<${UNKOWN_TYPE_TABLE}#${SUBJ_COL}>`) continue;
    const lines = [`        ${subject} ${predicate} ${object} .`];

    if (datatype && object.startsWith('?')) {
      // TODO: datatype filtering temporarily disabled
      /*if (datatype === 'string') {
        lines.push(
          `        FILTER (DATATYPE(${object}) = <${lang ? rdf + 'langString' : xsd + 'string'}>)`,
        );
      } else if (datatype === 'anyURI') {
        lines.push(
          `        FILTER (isURI(${object}) || DATATYPE(${object}) = <${dtUris[datatype]}>)`,
        );
      } else {
        lines.push(
          `        FILTER (DATATYPE(${object}) = <${dtUris[datatype]}>)`,
        );
      }*/

      if (isBooleanColumn(column)) {
        const filter = getBooleanFilter(object, column);
        if (filter !== undefined)
          lines.push(...filter.split('\n').map((line) => `        ${line}`));
      } else if (isNumericColumn(column)) {
        const filter = getNumericFilter(object, column);
        if (filter !== undefined)
          lines.push(...filter.split('\n').map((line) => `        ${line}`));
      } else if (isDateTimeColumn(column)) {
        const filter = getDateTimeFilter(object, column);
        if (filter !== undefined)
          lines.push(...filter.split('\n').map((line) => `        ${line}`));
      } else if (isDurationColumn(column)) {
        const filter = getDurationFilter(object, column);
        if (filter !== undefined)
          lines.push(...filter.split('\n').map((line) => `        ${line}`));
      } else {
        const filter = getOtherFilter(object, column);
        if (filter !== undefined)
          lines.push(...filter.split('\n').map((line) => `        ${line}`));
      }
    }

    if (lang && object.startsWith('?')) {
      // TODO: Should we lower our expectations if the matching language is not found?
      lines.push(`        FILTER LANGMATCHES(LANG(${object}), "${lang}")`);
    }

    if (aboutUrl && subject.startsWith('?')) {
      const templateUrl = expandIri(
        decodeURI(
          parseTemplate(
            aboutUrl.replaceAll(
              /\{(?!_column|_sourceColumn|_name)[^{}]*\}/g,
              '.*',
            ),
          ).expand({
            _column: index + 1,
            _sourceColumn: index + 1,
            _name: columns[index].name,
          }),
        ),
      );
      if (templateUrl !== '.*')
        lines.push(
          `        FILTER (REGEX(STR(${subject}), "${templateUrl}$"))`,
        );
    }

    if (valueUrl && object.startsWith('?')) {
      const templateUrl = expandIri(
        decodeURI(
          parseTemplate(
            valueUrl.replaceAll(
              /\{(?!_column|_sourceColumn|_name)[^{}]*\}/g,
              '.*',
            ),
          ).expand({
            _column: index + 1,
            _sourceColumn: index + 1,
            _name: columns[index].name,
          }),
        ),
      );
      if (templateUrl !== '.*')
        lines.push(`        FILTER (REGEX(STR(${object}), "${templateUrl}$"))`);
    }

    subjects.add(subject);
    alternatives.push(`{
${lines.join('\n')}
      }`);
  }

  return `  {
    SELECT DISTINCT ${[...subjects].join(' ')}
    WHERE {
      ${alternatives.join(' UNION ')}
    }
  }`;
}

/**
 * Creates SPARQL triple patterns for use in SELECT WHERE query.
 * Triples are created recursively if there are references between the columns.
 * @param table CSV Table
 * @param columns Columns including virtual ones
 * @param index Index of the column for which triples are created
 * @param subject Subject of the triple, it must match the other end of the reference between columns
 * @returns Triple patterns for given column as a string
 */
function createTriplePatterns(
  table: CsvwTableDescriptionWithRequiredColumns,
  columns: CsvwColumn[],
  index: number,
  queryVars: Record<string, string>,
): string {
  const column = table.tableSchema.columns[index];

  const aboutUrl = column.aboutUrl;
  const propertyUrl = column.propertyUrl;
  const valueUrl = column.valueUrl;
  const lang = column.lang;
  let datatype = undefined;
  if (typeof column.datatype === 'string') datatype = column.datatype;
  else if (column.datatype !== undefined) datatype = column.datatype.base;

  const subject = `?${queryVars[aboutUrl ?? '']}`;

  const predicate = propertyUrl
    ? `<${expandIri(
        decodeURI(
          parseTemplate(propertyUrl).expand({
            _column: index + 1,
            _sourceColumn: index + 1,
            _name: columns[index].name,
          }),
        ),
      )}>`
    : `<${table.url}#${columns[index].name}>`;

  let object = `?${columns[index].queryVariable}`;
  if (
    valueUrl &&
    valueUrl.search(/\{(?!_column|_sourceColumn|_name)[^{}]*\}/) === -1 &&
    predicate === `<${rdf}type>`
  ) {
    // literal value can be used instead of the variable
    // only when the variable is not queryVar of the column (i.e. the predicate is rdf:type),
    // this prevents selection of unassigned variables
    object = decodeURI(
      parseTemplate(valueUrl).expand({
        _column: index + 1,
        _sourceColumn: index + 1,
        _name: columns[index].name,
      }),
    );
    object = `<${expandIri(object)}>`;
  }

  if (predicate === `<${UNKOWN_TYPE_TABLE}#${SUBJ_COL}>`) return '';
  const lines = [`  ${subject} ${predicate} ${object} .`];

  if (datatype && object.startsWith('?')) {
    // TODO: datatype filtering temporarily disabled
    /*if (datatype === 'string') {
      lines.push(
        `  FILTER (DATATYPE(${object}) = <${lang ? rdf + 'langString' : xsd + 'string'}>)`,
      );
    } else if (datatype === 'anyURI') {
      lines.push(
        `  FILTER (isURI(${object}) || DATATYPE(${object}) = <${dtUris[datatype]}>)`,
      );
    } else {
      lines.push(`  FILTER (DATATYPE(${object}) = <${dtUris[datatype]}>)`);
    }*/

    if (isBooleanColumn(column)) {
      const filter = getBooleanFilter(object, column);
      if (filter !== undefined)
        lines.push(...filter.split('\n').map((line) => `  ${line}`));
    } else if (isNumericColumn(column)) {
      const filter = getNumericFilter(object, column);
      if (filter !== undefined)
        lines.push(...filter.split('\n').map((line) => `  ${line}`));
    } else if (isDateTimeColumn(column)) {
      const filter = getDateTimeFilter(object, column);
      if (filter !== undefined)
        lines.push(...filter.split('\n').map((line) => `  ${line}`));
    } else if (isDurationColumn(column)) {
      const filter = getDurationFilter(object, column);
      if (filter !== undefined)
        lines.push(...filter.split('\n').map((line) => `  ${line}`));
    } else {
      const filter = getOtherFilter(object, column);
      if (filter !== undefined)
        lines.push(...filter.split('\n').map((line) => `  ${line}`));
    }
  }

  if (lang && object.startsWith('?')) {
    // TODO: Should we lower our expectations if the matching language is not found?
    lines.push(`  FILTER LANGMATCHES(LANG(${object}), "${lang}")`);
  }

  if (aboutUrl && subject.startsWith('?')) {
    const templateUrl = expandIri(
      decodeURI(
        parseTemplate(
          aboutUrl.replaceAll(
            /\{(?!_column|_sourceColumn|_name)[^{}]*\}/g,
            '.*',
          ),
        ).expand({
          _column: index + 1,
          _sourceColumn: index + 1,
          _name: columns[index].name,
        }),
      ),
    );
    if (templateUrl !== '.*')
      lines.push(`  FILTER (REGEX(STR(${subject}), "${templateUrl}$"))`);
  }

  if (valueUrl && object.startsWith('?')) {
    const templateUrl = expandIri(
      decodeURI(
        parseTemplate(
          valueUrl.replaceAll(
            /\{(?!_column|_sourceColumn|_name)[^{}]*\}/g,
            '.*',
          ),
        ).expand({
          _column: index + 1,
          _sourceColumn: index + 1,
          _name: columns[index].name,
        }),
      ),
    );
    if (templateUrl !== '.*')
      lines.push(`  FILTER (REGEX(STR(${object}), "${templateUrl}$"))`);
  }

  if (predicate === `<${rdf}type>`) {
    if (aboutUrl) {
      table.tableSchema.columns.forEach((col, i) => {
        if (col !== column && col.aboutUrl === aboutUrl) {
          const patterns = createTriplePatterns(table, columns, i, queryVars);
          lines.push(...patterns.split('\n'));
        }
      });
    }
  } else {
    if (valueUrl) {
      const typeColumn = table.tableSchema.columns.find(
        (col) =>
          col.propertyUrl &&
          expandIri(col.propertyUrl) === rdf + 'type' &&
          col.aboutUrl === valueUrl,
      );
      table.tableSchema.columns.forEach((col, i) => {
        if (col !== column && col.aboutUrl === valueUrl) {
          // filter out columns that are referenced by typeColumn
          // so their triples are not generated twice
          if (
            typeColumn === undefined ||
            (col.propertyUrl && expandIri(col.propertyUrl) === rdf + 'type')
          ) {
            const patterns = createTriplePatterns(table, columns, i, queryVars);
            lines.push(...patterns.split('\n'));
          }
        }
      });
    }
  }

  if (!column.required) {
    return `  OPTIONAL {
${lines.map((line) => `  ${line}`).join('\n')}
  }`;
  } else {
    return lines.map((line) => `${line}`).join('\n');
  }
}
