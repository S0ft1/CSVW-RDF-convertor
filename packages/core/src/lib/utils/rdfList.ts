import { BlankNode, DataFactory, Literal, NamedNode, Quad } from 'n3';
import { CsvwColumnDescription } from '../types/descriptor/column-description.js';
import { Expanded } from '../types/descriptor/expanded.js';
import { CsvwTableDescription } from '../types/descriptor/table.js';
import { CsvwTableGroupDescription } from '../types/descriptor/table-group.js';
import { CSVW2RDFConvertor } from '../csvw2rdf-convertor.js';
import { CsvwInheritedProperties } from '../types/descriptor/inherited-properties.js';
import { commonPrefixes } from './utils/prefix.js';
import { CsvwBuiltinDatatype } from '../types/descriptor/datatype.js';
import { Quadstore, StoreOpts } from 'quadstore';
import { commonPrefixes } from './utils/prefix.js';

export async function createOrderedRDFList(
  arr: string[],
  store: Quadstore,
  col: Expanded<CsvwColumnDescription>,
  table: Expanded<CsvwTableDescription>,
  tg: Expanded<CsvwTableGroupDescription>
): Promise<BlankNode | undefined> {
  const { namedNode, literal, quad, blankNode } = DataFactory;
  const { rdf, csvw, xsd } = commonPrefixes;

  let oldBlank;
  let returnBlank: BlankNode = blankNode();
  for (let i = 0; i < arr.length; ++i) {
    const blank = oldBlank == null ? blankNode() : oldBlank;
    if (i == 0) {
      returnBlank = blank;
    }
    await emmitTriple(
      blank,
      namedNode(rdf + 'type'),
      namedNode(rdf + 'list'),
      store
    );
    await emmitTriple(
      blank,
      namedNode(rdf + 'first'),
      interpretDatatype(arr[i], col, table, tg),
      store
    );

    if (i != arr.length - 1) {
      const nextBlank = blankNode();
      await emmitTriple(blank, namedNode(rdf + 'rest'), nextBlank, store);
      oldBlank = nextBlank;
    } else {
      await emmitTriple(
        blank,
        namedNode(rdf + 'rest'),
        namedNode(rdf + 'nil'),
        store
      );
    }
    return returnBlank;
  }
}

function interpretDatatype(
  value: string,
  col: Expanded<CsvwColumnDescription>,
  table: Expanded<CsvwTableDescription>,
  tg: Expanded<CsvwTableGroupDescription>
) {
  const { literal } = DataFactory;
  const dtOrBuiltin = inherit(
    'http://www.w3.org/ns/csvw#datatype',
    col,
    table['http://www.w3.org/ns/csvw#tableSchema'],
    table,
    tg
  );
  if (!dtOrBuiltin) {
    throw new Error(`No datatype specified for ${debugCol(col, table)}`);
  }
  const dt =
    typeof dtOrBuiltin === 'string'
      ? { 'http://www.w3.org/ns/csvw#base': dtOrBuiltin }
      : dtOrBuiltin;
  let dtUri = dt['@id'];
  const lang = inherit(
    'http://www.w3.org/ns/csvw#lang',
    col,
    table['http://www.w3.org/ns/csvw#tableSchema'],
    table,
    tg
  );
  if (!dtUri) {
    if (!dt['http://www.w3.org/ns/csvw#base']) {
      throw new Error('Datatype must contain either @id or base property');
    } else if (dt['http://www.w3.org/ns/csvw#base'] in dturix) {
      dtUri = dturix[dt['http://www.w3.org/ns/csvw#base']];
    } else if (dt['http://www.w3.org/ns/csvw#base'] === 'string') {
      return lang
        ? literal(value, lang)
        : literal(value, commonPrefixes.xsd + 'string');
    } else {
      dtUri = commonPrefixes.xsd + dt['http://www.w3.org/ns/csvw#base'];
    }
  }
  return literal(value, dtUri);
}

function inherit<K extends keyof Expanded<CsvwInheritedProperties>>(
  prop: K,
  ...levels: (Expanded<CsvwInheritedProperties> | undefined)[]
): Expanded<CsvwInheritedProperties>[K] {
  for (const level of levels) {
    if (level?.[prop] !== undefined) {
      return level[prop];
    }
  }
  return undefined;
}
function debugCol(
  col: Expanded<CsvwColumnDescription>,
  table: Expanded<CsvwTableDescription>
) {
  let res = (col['http://www.w3.org/ns/csvw#name'] || col['@id']) as string;
  if (table) {
    res += ` in table ${table['http://www.w3.org/ns/csvw#url']}`;
  }
  return res;
}

function emmitTriple(
  first: NamedNode | BlankNode,
  second: NamedNode,
  third: NamedNode | BlankNode | Literal,
  store: Quadstore
): Promise<void> {
  store.put(quad(first, second, third, defaultGraph()));
}
