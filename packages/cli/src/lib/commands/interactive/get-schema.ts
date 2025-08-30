import { TableGroupSchema, TableSchema } from '@csvw-rdf-convertor/core';
import { confirm, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import actionSelect from 'inquirer-action-select';

enum TableActions {
  Rename = 'rename',
  Remove = 'remove',
  RemoveColumn = 'removeColumn',
  RenameColumn = 'renameColumn',
  AddTable = 'addTable',
  MoveColumn = 'moveColumn',
}

export async function getSchema(tables: TableGroupSchema) {
  while (true) {
    const answer = await actionSelect.default({
      message: 'Select a table and an action',
      choices: tables.tables.map((t) => ({
        name: stringifyTable(t),
        value: t,
      })),
      actions: [
        { value: TableActions.Rename, name: 'Rename Table', key: 'r' },
        { value: TableActions.Remove, name: 'Delete Table', key: 'd' },
        { value: TableActions.RenameColumn, name: 'Rename Column', key: 'q' },
        { value: TableActions.RemoveColumn, name: 'Delete Column', key: 'e' },
        { value: TableActions.AddTable, name: 'Add Table', key: 'a' },
        { value: TableActions.MoveColumn, name: 'Move Column', key: 'm' },
        { value: undefined, name: 'Continue', key: 'Enter' },
      ],
      loop: false,
    });
    if (!answer.action) {
      break;
    }

    try {
      switch (answer.action) {
        case TableActions.Rename:
          await renameTable(answer.answer, tables);
          break;
        case TableActions.Remove:
          await removeTable(answer.answer, tables);
          break;
        case TableActions.RenameColumn:
          await renameCol(answer.answer, tables);
          break;
        case TableActions.RemoveColumn:
          await removeCol(answer.answer, tables);
          break;
        case TableActions.AddTable:
          await addTable(tables);
          break;
        case TableActions.MoveColumn:
          await moveCol(answer.answer, tables);
          break;
      }
    } catch (error) {
      console.error(
        chalk.red('Error occurred while processing table action:'),
        (error as Error).message,
      );
    }
  }
  return tables;
}

function stringifyTable(table: TableSchema): string {
  const columns = table.tableSchema.columns
    .map((col) => {
      if (table.tableSchema.primaryKey.includes(col.name as string)) {
        return chalk.bold(col.titles);
      }
      return col.titles;
    })
    .join(',');
  return `${table.url}(${columns})`;
}

async function renameTable(table: TableSchema, tg: TableGroupSchema) {
  const newName = await input({ message: 'Enter new table name' });
  if (newName) {
    tg.renameTable(table.url, newName);
  }
}

async function removeTable(table: TableSchema, tg: TableGroupSchema) {
  const ok = await confirm({
    message: 'Are you sure you want to remove this table?',
  });
  if (ok) {
    tg.removeTable(table.url);
  }
}

async function removeCol(table: TableSchema, tg: TableGroupSchema) {
  const colName = await select({
    message: 'Select a column to remove',
    choices: table.tableSchema.columns.map((col) => ({
      name: col.titles,
      value: col.name,
    })),
  });
  const ok = await confirm({
    message: 'Are you sure you want to remove this column?',
  });
  if (ok) {
    tg.removeTableCol(table.url, colName);
  }
}

async function renameCol(table: TableSchema, tg: TableGroupSchema) {
  const colName = await select({
    message: 'Select a column to rename',
    choices: table.tableSchema.columns.map((col) => ({
      name: col.titles,
      value: col.name,
    })),
  });
  const newName = await input({ message: 'Enter new column name' });
  if (newName) {
    tg.renameTableCol(table.url, colName, newName);
  }
}

async function moveCol(table: TableSchema, tg: TableGroupSchema) {
  const colName = await select({
    message: 'Select a column to move',
    choices: table.tableSchema.columns.map((col) => ({
      name: col.titles,
      value: col.name,
    })),
  });
  const toTable = await select({
    message: 'Select a table to move the column to',
    choices: tg.tables
      .filter((t) => t !== table)
      .map((t) => ({
        name: t.url,
        value: t.url,
      })),
  });
  if (toTable) {
    tg.moveTableCol(table.url, colName, toTable);
  }
}

async function addTable(tg: TableGroupSchema) {
  const tableName = await input({ message: 'Enter new table name' });
  if (tableName) {
    tg.addTable(tableName);
  }
}
