import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';

const { Pool, types } = pg;

types.setTypeParser(1082, (value) => value); // date
types.setTypeParser(1083, (value) => value); // time
types.setTypeParser(1266, (value) => value); // timetz

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in' | 'is' | 'not_eq' | 'not_is';
type DbValue = unknown;
type DbRow = Record<string, DbValue>;
type AdapterData = { [key: string]: never } & never[];
type AdapterError = { message: string; details?: string; code?: string };
type AdapterResult = { data: AdapterData; error: AdapterError | null; count: number | null };
type Filter = { column: string; op: FilterOp; value: DbValue };
type Order = { column: string; ascending: boolean };
type SelectOptions = { count?: 'exact'; head?: boolean };
type RelationSpec = { name: string; inner: boolean; columns: string[]; children: RelationSpec[] };
type RelationConfig = {
  table: string;
  localKey: string;
  foreignKey: string;
  many?: boolean;
  via?: (row: DbRow) => DbValue;
};

export const tencentPgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: Number(process.env.PGPOOL_MAX || 10),
});

const pool = tencentPgPool;
const columnTypeCache = new Map<string, Map<string, string>>();

async function getColumnTypes(table: string) {
  const cached = columnTypeCache.get(table);
  if (cached) return cached;
  const result = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  const map = new Map<string, string>();
  for (const row of result.rows as Array<{ column_name: string; data_type: string }>) {
    map.set(row.column_name, row.data_type);
  }
  columnTypeCache.set(table, map);
  return map;
}

function mutationValueForType(value: DbValue, dataType?: string) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return dataType === 'json' || dataType === 'jsonb' ? JSON.stringify(value) : value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function adapterData(value: DbValue): AdapterData {
  return value as AdapterData;
}

async function prepareMutationRows(table: string, rows: DbRow[]) {
  const columnTypes = await getColumnTypes(table);
  return rows.map(row => {
    const out: DbRow = {};
    for (const [key, value] of Object.entries(row)) out[key] = mutationValueForType(value, columnTypes.get(key));
    return out;
  });
}

const RELATIONS: Record<string, Record<string, RelationConfig>> = {
  schedules: {
    scripts: { table: 'scripts', localKey: 'script_id', foreignKey: 'id' },
    rooms: { table: 'rooms', localKey: 'room_id', foreignKey: 'id' },
    jzg_stores: { table: 'jzg_stores', localKey: 'tenant_id', foreignKey: 'id' },
  },
  schedule_actors: {
    schedules: { table: 'schedules', localKey: 'schedule_id', foreignKey: 'id' },
    actors: { table: 'actors', localKey: 'actor_id', foreignKey: 'id' },
  },
  actor_skills: {
    scripts: { table: 'scripts', localKey: 'script_id', foreignKey: 'id' },
    actors: { table: 'actors', localKey: 'actor_id', foreignKey: 'id' },
  },
  scripts: {
    script_player_roles: { table: 'script_player_roles', localKey: 'id', foreignKey: 'script_id', many: true },
    script_actor_roles: { table: 'script_actor_roles', localKey: 'id', foreignKey: 'script_id', many: true },
  },
  evaluations: {
    schedules: { table: 'schedules', localKey: 'schedule_id', foreignKey: 'id' },
    scripts: { table: 'scripts', localKey: 'schedule_id', foreignKey: 'id', via: row => asDbRow(row.schedules).script_id },
  },
  conflict_records: {
    customers: { table: 'customers', localKey: 'customer_id', foreignKey: 'id' },
    actors: { table: 'actors', localKey: 'actor_id', foreignKey: 'id' },
  },
  checkins: {
    schedules: { table: 'schedules', localKey: 'schedule_id', foreignKey: 'id' },
  },
  jzg_carpool_join_requests: {
    schedules: { table: 'schedules', localKey: 'schedule_id', foreignKey: 'id' },
    players: { table: 'players', localKey: 'player_id', foreignKey: 'id' },
  },
  lc_transactions: {
    lc_profiles: { table: 'lc_profiles', localKey: 'profile_id', foreignKey: 'id' },
  },
};

function pgError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string };
    return { message: error.message, details: error.stack, code: withCode.code };
  }
  return { message: String(error) };
}

function splitTopLevel(input: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of input) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseRelations(selectClause = '*'): RelationSpec[] {
  return splitTopLevel(selectClause)
    .map(part => {
      const match = part.match(/^([A-Za-z0-9_]+)(![A-Za-z0-9_]+)?\((.*)\)$/);
      if (!match) return null;
      const inner = match[3];
      return {
        name: match[1],
        inner: Boolean(match[2]),
        columns: splitTopLevel(inner).filter(item => item !== '*' && !item.includes('(')),
        children: parseRelations(inner),
      };
    })
    .filter(Boolean) as RelationSpec[];
}

function parseBaseColumns(selectClause = '*') {
  const parts = splitTopLevel(selectClause);
  if (!parts.length || parts.includes('*')) return null;
  const columns = parts.filter(part => !part.includes('(') && /^[A-Za-z_][A-Za-z0-9_]*$/.test(part));
  return columns.length ? columns : null;
}

function quoteIdent(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe SQL identifier: ${name}`);
  return `"${name}"`;
}

function normalizeRows(input: DbValue) {
  return Array.isArray(input) ? input : [input];
}

function asDbRow(value: DbValue): DbRow {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRow : {};
}

function getRowValue(row: DbRow, key: string) {
  return row[key];
}

function compactRow(row: DbRow) {
  const out: DbRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function applyPostFilters(rows: DbRow[], filters: Filter[]) {
  return rows.filter(row => filters.every(filter => {
    const [relation, column] = filter.column.split('.');
    const relationValue = relation ? row[relation] : null;
    const target = column && relationValue && typeof relationValue === 'object' && !Array.isArray(relationValue)
      ? (relationValue as DbRow)[column]
      : row[filter.column];
    switch (filter.op) {
      case 'eq': return target === filter.value;
      case 'neq':
      case 'not_eq': return target !== filter.value;
      case 'gt': return target > filter.value;
      case 'gte': return target >= filter.value;
      case 'lt': return target < filter.value;
      case 'lte': return target <= filter.value;
      case 'is': return filter.value === null ? target === null || target === undefined : target === filter.value;
      case 'not_is': return filter.value === null ? target !== null && target !== undefined : target !== filter.value;
      case 'in': return Array.isArray(filter.value) && filter.value.includes(target);
      case 'ilike': return String(target || '').toLowerCase().includes(String(filter.value || '').replaceAll('%', '').toLowerCase());
      default: return true;
    }
  }));
}

function projectRow(row: DbRow, baseColumns: string[] | null, relations: RelationSpec[]) {
  const out: DbRow = {};
  if (!baseColumns) {
    Object.assign(out, row);
  } else {
    for (const column of baseColumns) out[column] = row[column];
  }
  for (const spec of relations) {
    if (!(spec.name in row)) continue;
    out[spec.name] = projectRelationValue(row[spec.name], spec);
  }
  return out;
}

function projectRelationValue(value: DbValue, spec: RelationSpec): DbValue {
  if (Array.isArray(value)) return value.map(item => projectRelationRow(item, spec));
  if (!value || typeof value !== 'object') return value;
  return projectRelationRow(value as DbRow, spec);
}

function projectRelationRow(row: DbRow, spec: RelationSpec) {
  const out: DbRow = {};
  if (!spec.columns.length) {
    Object.assign(out, row);
  } else {
    for (const column of spec.columns) out[column] = row[column];
  }
  for (const child of spec.children) {
    if (child.name in row) out[child.name] = projectRelationValue(row[child.name], child);
  }
  return out;
}

class PgQueryBuilder {
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectClause = '*';
  private selectOptions: SelectOptions = {};
  private filters: Filter[] = [];
  private orClauses: Filter[][] = [];
  private orders: Order[] = [];
  private limitCount?: number;
  private rangeFrom?: number;
  private rangeTo?: number;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private payload: DbValue;
  private upsertConflict: string[] = [];

  constructor(private table: string) {}

  select(clause = '*', options: SelectOptions = {}) {
    this.action = this.action || 'select';
    this.selectClause = clause || '*';
    this.selectOptions = options || {};
    return this;
  }

  insert(payload: DbValue) {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: DbValue) {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(payload: DbValue, options: { onConflict?: string } = {}) {
    this.action = 'upsert';
    this.payload = payload;
    this.upsertConflict = (options.onConflict || '').split(',').map(s => s.trim()).filter(Boolean);
    return this;
  }

  eq(column: string, value: DbValue) { this.filters.push({ column, op: 'eq', value }); return this; }
  neq(column: string, value: DbValue) { this.filters.push({ column, op: 'neq', value }); return this; }
  gt(column: string, value: DbValue) { this.filters.push({ column, op: 'gt', value }); return this; }
  gte(column: string, value: DbValue) { this.filters.push({ column, op: 'gte', value }); return this; }
  lt(column: string, value: DbValue) { this.filters.push({ column, op: 'lt', value }); return this; }
  lte(column: string, value: DbValue) { this.filters.push({ column, op: 'lte', value }); return this; }
  ilike(column: string, value: DbValue) { this.filters.push({ column, op: 'ilike', value }); return this; }
  in(column: string, value: DbValue[]) { this.filters.push({ column, op: 'in', value }); return this; }
  is(column: string, value: DbValue) { this.filters.push({ column, op: 'is', value }); return this; }
  not(column: string, op: string, value: DbValue) {
    this.filters.push({ column, op: op === 'is' ? 'not_is' : 'not_eq', value });
    return this;
  }

  or(expression: string) {
    const group = expression.split(',').map(part => {
      const match = part.match(/^([A-Za-z0-9_.]+)\.(ilike|eq|neq)\.(.*)$/);
      if (!match) return null;
      return { column: match[1], op: match[2] === 'neq' ? 'neq' : match[2] as FilterOp, value: match[3] };
    }).filter(Boolean) as Filter[];
    if (group.length) this.orClauses.push(group);
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number) { this.limitCount = count; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }

  then<TResult1 = AdapterResult, TResult2 = never>(
    onfulfilled?: ((value: AdapterResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private baseFilters() {
    return this.filters.filter(f => !f.column.includes('.'));
  }

  private postFilters() {
    return this.filters.filter(f => f.column.includes('.'));
  }

  private whereSql(values: DbValue[]) {
    const clauses: string[] = [];
    for (const filter of this.baseFilters()) {
      const col = quoteIdent(filter.column);
      if (filter.op === 'eq') clauses.push(`${col} = $${values.push(filter.value)}`);
      if (filter.op === 'neq') clauses.push(`${col} <> $${values.push(filter.value)}`);
      if (filter.op === 'gt') clauses.push(`${col} > $${values.push(filter.value)}`);
      if (filter.op === 'gte') clauses.push(`${col} >= $${values.push(filter.value)}`);
      if (filter.op === 'lt') clauses.push(`${col} < $${values.push(filter.value)}`);
      if (filter.op === 'lte') clauses.push(`${col} <= $${values.push(filter.value)}`);
      if (filter.op === 'ilike') clauses.push(`${col} ILIKE $${values.push(filter.value)}`);
      if (filter.op === 'in') clauses.push(`${col} = ANY($${values.push(filter.value)})`);
      if (filter.op === 'is') clauses.push(filter.value === null ? `${col} IS NULL` : `${col} IS $${values.push(filter.value)}`);
      if (filter.op === 'not_is') clauses.push(filter.value === null ? `${col} IS NOT NULL` : `${col} IS NOT $${values.push(filter.value)}`);
      if (filter.op === 'not_eq') clauses.push(`${col} <> $${values.push(filter.value)}`);
    }
    for (const group of this.orClauses) {
      const orParts = group.filter(f => !f.column.includes('.')).map(filter => {
        const col = quoteIdent(filter.column);
        if (filter.op === 'ilike') return `${col} ILIKE $${values.push(filter.value)}`;
        if (filter.op === 'neq') return `${col} <> $${values.push(filter.value)}`;
        return `${col} = $${values.push(filter.value)}`;
      });
      if (orParts.length) clauses.push(`(${orParts.join(' OR ')})`);
    }
    return clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  }

  private orderSql() {
    const baseOrders = this.orders.filter(order => !order.column.includes('.'));
    if (!baseOrders.length) return '';
    return ` ORDER BY ${baseOrders.map(order => `${quoteIdent(order.column)} ${order.ascending ? 'ASC' : 'DESC'}`).join(', ')}`;
  }

  private limitSql(values: DbValue[]) {
    if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
      const limit = Math.max(0, this.rangeTo - this.rangeFrom + 1);
      return ` LIMIT $${values.push(limit)} OFFSET $${values.push(this.rangeFrom)}`;
    }
    if (this.limitCount !== undefined) return ` LIMIT $${values.push(this.limitCount)}`;
    return '';
  }

  private async execute(): Promise<AdapterResult> {
    try {
      if (this.action === 'insert') return await this.executeInsert();
      if (this.action === 'update') return await this.executeUpdate();
      if (this.action === 'delete') return await this.executeDelete();
      if (this.action === 'upsert') return await this.executeUpsert();
      return await this.executeSelect();
    } catch (e) {
      return { data: adapterData(null), error: pgError(e), count: null };
    }
  }

  private async executeSelect(): Promise<AdapterResult> {
    const values: DbValue[] = [];
    const countRequested = this.selectOptions.count === 'exact';
    if (countRequested) {
      const countSql = `SELECT count(*)::int AS count FROM ${quoteIdent(this.table)}${this.whereSql(values)}`;
      const countResult = await pool.query(countSql, values);
      if (this.selectOptions.head) return { data: adapterData(null), error: null, count: countResult.rows[0]?.count || 0 };
    }

    values.length = 0;
    const sql = `SELECT * FROM ${quoteIdent(this.table)}${this.whereSql(values)}${this.orderSql()}${this.limitSql(values)}`;
    const result = await pool.query(sql, values);
    let rows = result.rows as DbRow[];
    const relationSpecs = parseRelations(this.selectClause);
    await this.attachRelations(rows, relationSpecs);
    rows = applyPostFilters(rows, this.postFilters());
    rows = rows.map(row => projectRow(row, parseBaseColumns(this.selectClause), relationSpecs));
    const data = this.formatRows(rows);
    return { data, error: null, count: countRequested ? rows.length : null };
  }

  private async executeInsert(): Promise<AdapterResult> {
    const rows = await prepareMutationRows(this.table, normalizeRows(this.payload).map(value => compactRow(asDbRow(value))));
    if (!rows.length) return { data: adapterData([]), error: null, count: null };
    const cols = Object.keys(rows[0]);
    const values: DbValue[] = [];
    const placeholders = rows.map(row => `(${cols.map(col => `$${values.push(row[col])}`).join(', ')})`).join(', ');
    const sql = `INSERT INTO ${quoteIdent(this.table)} (${cols.map(quoteIdent).join(', ')}) VALUES ${placeholders} RETURNING *`;
    const result = await pool.query(sql, values);
    const data = this.formatRows(this.projectMutationRows(result.rows));
    return { data, error: null, count: null };
  }

  private async executeUpdate(): Promise<AdapterResult> {
    const row = (await prepareMutationRows(this.table, [compactRow(asDbRow(this.payload || {}))]))[0];
    const cols = Object.keys(row);
    if (!cols.length) return { data: adapterData(null), error: null, count: null };
    const values: DbValue[] = [];
    const sets = cols.map(col => `${quoteIdent(col)} = $${values.push(row[col])}`).join(', ');
    const sql = `UPDATE ${quoteIdent(this.table)} SET ${sets}${this.whereSql(values)} RETURNING *`;
    const result = await pool.query(sql, values);
    const data = this.formatRows(this.projectMutationRows(result.rows));
    return { data, error: null, count: null };
  }

  private async executeDelete(): Promise<AdapterResult> {
    const values: DbValue[] = [];
    const sql = `DELETE FROM ${quoteIdent(this.table)}${this.whereSql(values)} RETURNING *`;
    const result = await pool.query(sql, values);
    const data = this.formatRows(this.projectMutationRows(result.rows));
    return { data, error: null, count: null };
  }

  private async executeUpsert(): Promise<AdapterResult> {
    const rows = await prepareMutationRows(this.table, normalizeRows(this.payload).map(value => compactRow(asDbRow(value))));
    if (!rows.length) return { data: adapterData([]), error: null, count: null };
    const cols = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
    const values: DbValue[] = [];
    const placeholders = rows.map(row => `(${cols.map(col => `$${values.push(row[col] ?? null)}`).join(', ')})`).join(', ');
    const conflict = this.upsertConflict.length ? this.upsertConflict : ['id'];
    const updateCols = cols.filter(col => !conflict.includes(col));
    const updateSql = updateCols.length
      ? `DO UPDATE SET ${updateCols.map(col => `${quoteIdent(col)} = EXCLUDED.${quoteIdent(col)}`).join(', ')}`
      : 'DO NOTHING';
    const sql = `INSERT INTO ${quoteIdent(this.table)} (${cols.map(quoteIdent).join(', ')}) VALUES ${placeholders} ON CONFLICT (${conflict.map(quoteIdent).join(', ')}) ${updateSql} RETURNING *`;
    const result = await pool.query(sql, values);
    const data = this.formatRows(this.projectMutationRows(result.rows));
    return { data, error: null, count: null };
  }

  private projectMutationRows(rows: DbRow[]) {
    const relationSpecs = parseRelations(this.selectClause);
    return rows.map(row => projectRow(row, parseBaseColumns(this.selectClause), relationSpecs));
  }

  private formatRows(rows: DbRow[]): AdapterData {
    if (this.singleMode === 'single') {
      if (rows.length !== 1) throw new Error(rows.length ? 'JSON object requested, multiple rows returned' : 'JSON object requested, no rows returned');
      return adapterData(rows[0]);
    }
    if (this.singleMode === 'maybeSingle') {
      if (rows.length > 1) throw new Error('JSON object requested, multiple rows returned');
      return adapterData(rows[0] || null);
    }
    return adapterData(rows);
  }

  private async attachRelations(rows: DbRow[], specs: RelationSpec[]) {
    if (!rows.length || !specs.length) return;
    for (const spec of specs) await this.attachRelation(rows, this.table, spec);
  }

  private async attachRelation(rows: DbRow[], sourceTable: string, spec: RelationSpec) {
    const relation = RELATIONS[sourceTable]?.[spec.name];
    if (!relation) return;

    const localValues = rows.map(row => relation.via ? relation.via(row) : row[relation.localKey]).filter(value => value !== null && value !== undefined);
    const uniqueValues = Array.from(new Set(localValues));
    if (!uniqueValues.length) {
      for (const row of rows) row[spec.name] = relation.many ? [] : null;
      return;
    }

    const result = await pool.query(
      `SELECT * FROM ${quoteIdent(relation.table)} WHERE ${quoteIdent(relation.foreignKey)} = ANY($1)`,
      [uniqueValues],
    );
    const relatedRows = result.rows as DbRow[];
    await this.attachNestedRelations(relatedRows, relation.table, spec.children);

    for (const row of rows) {
      const local = relation.via ? relation.via(row) : row[relation.localKey];
      const matches = relatedRows.filter(related => getRowValue(related, relation.foreignKey) === local);
      row[spec.name] = relation.many ? matches : matches[0] || null;
    }
  }

  private async attachNestedRelations(rows: DbRow[], table: string, specs: RelationSpec[]) {
    if (!rows.length || !specs.length) return;
    for (const spec of specs) await this.attachRelation(rows, table, spec);
  }
}

export function createTencentPgClient() {
  return {
    from(table: string) {
      return new PgQueryBuilder(table);
    },
    async rpc(name: string, args: DbRow = {}) {
      try {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe function name: ${name}`);
        const entries = Object.entries(args);
        const values = entries.map(([, value]) => value);
        const params = entries.map(([key], index) => {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Unsafe function arg: ${key}`);
          return `${quoteIdent(key)} := $${index + 1}`;
        });
        const result = await pool.query(`SELECT * FROM public.${quoteIdent(name)}(${params.join(', ')})`, values);
        return { data: adapterData(result.rows), error: null };
      } catch (error) {
        return { data: adapterData(null), error: pgError(error) };
      }
    },
    storage: {
      from(bucket: string) {
        return new LocalStorageBucket(bucket);
      },
    },
  };
}

class LocalStorageBucket {
  constructor(private bucket: string) {}

  async upload(objectPath: string, body: Buffer, options: { contentType?: string; upsert?: boolean } = {}) {
    try {
      const safeBucket = this.safePart(this.bucket);
      const safePath = objectPath.split('/').map(part => this.safePart(part)).join('/');
      const root = process.env.LOCAL_UPLOAD_ROOT || path.join(process.cwd(), 'public', 'uploads');
      const target = path.join(root, safeBucket, safePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      if (!options.upsert) {
        try {
          await fs.stat(target);
          return { data: null, error: { message: 'The resource already exists' } };
        } catch (error) {
          const missing = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT';
          if (!missing) throw error;
        }
      }
      await fs.writeFile(target, body);
      return { data: { path: safePath, fullPath: `${safeBucket}/${safePath}`, contentType: options.contentType || null }, error: null };
    } catch (error) {
      return { data: null, error: pgError(error) };
    }
  }

  getPublicUrl(objectPath: string) {
    const site = (process.env.LINGQI_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://lingqi.jusichen.com').replace(/\/$/, '');
    const safeBucket = this.safePart(this.bucket);
    const safePath = objectPath.split('/').map(part => this.safePart(part)).join('/');
    return { data: { publicUrl: `${site}/uploads/${safeBucket}/${safePath}` } };
  }

  private safePart(part: string) {
    const value = String(part || '').replace(/[^A-Za-z0-9._-]/g, '_');
    if (!value || value === '.' || value === '..') return '_';
    return value;
  }
}
