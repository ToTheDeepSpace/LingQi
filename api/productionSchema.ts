type SchemaColumnRow = {
  table_name: string;
  column_name: string;
};

type SchemaQueryClient = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: SchemaColumnRow[] }>;
};

export const REQUIRED_PRODUCTION_SCHEMA_COLUMNS: Record<string, readonly string[]> = {
  lc_reports: [
    'id',
    'target_type',
    'target_id',
    'target_sub_id',
    'target_title',
    'reporter_id',
    'reporter_name',
    'reason',
    'description',
    'target_snapshot',
    'status',
    'handler_id',
    'handler_note',
    'handler_context',
    'risk_level',
    'auto_action',
    'auto_action_reason',
    'auto_action_at',
    'target_status_before',
    'target_status_after',
    'report_group_count',
    'reporter_trust_score',
    'reviewer_summary',
    'moderation_precheck',
    'evidence_files',
    'created_at',
    'updated_at',
  ],
};

export function missingRequiredProductionSchemaColumns(rows: SchemaColumnRow[]) {
  const present = new Set(rows.map(row => `${row.table_name}.${row.column_name}`));
  return Object.entries(REQUIRED_PRODUCTION_SCHEMA_COLUMNS)
    .flatMap(([table, columns]) => columns.map(column => `${table}.${column}`))
    .filter(column => !present.has(column));
}

export async function assertRequiredProductionSchema(client: SchemaQueryClient) {
  const tables = Object.keys(REQUIRED_PRODUCTION_SCHEMA_COLUMNS);
  const result = await client.query(
    `select table_name, column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])`,
    [tables],
  );
  const missing = missingRequiredProductionSchemaColumns(result.rows);
  if (missing.length) {
    throw new Error(
      `Production database schema is incomplete: ${missing.join(', ')}. Apply pending migrations before starting the service.`,
    );
  }
}
