import { readFileSync } from "node:fs";

import { parse } from "csv-parse/sync";

export type CsvRow = Record<string, string>;

export function readCsv(path: string): CsvRow[] {
  const source = readFileSync(path, "utf8");
  return parse(source, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
}

export function requireField(row: CsvRow, field: string, source: string): string {
  const value = row[field];
  if (value === undefined || value === "") {
    throw new Error(`${source}: 필수 필드 ${field}가 비어 있습니다.`);
  }
  return value;
}

export function parseNumberField(row: CsvRow, field: string, source: string): number {
  const raw = requireField(row, field, source);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${source}: ${field} 값이 숫자가 아닙니다: ${raw}`);
  return value;
}

export function parseNullableNumber(row: CsvRow, field: string, source: string): number | null {
  const raw = row[field];
  if (raw === undefined) throw new Error(`${source}: 필수 컬럼 ${field}가 없습니다.`);
  if (raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${source}: ${field} 값이 숫자가 아닙니다: ${raw}`);
  return value;
}

export function indexUnique(rows: CsvRow[], key: string, source: string): Map<string, CsvRow> {
  const index = new Map<string, CsvRow>();
  for (const row of rows) {
    const value = requireField(row, key, source);
    if (index.has(value)) throw new Error(`${source}: 중복 ${key} 값이 있습니다: ${value}`);
    index.set(value, row);
  }
  return index;
}

