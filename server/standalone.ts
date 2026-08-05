import './loadEnv.js';

const { default: app } = await import('../api/index.js');
const { tencentPgPool } = await import('../api/tencentPgSupabase.js');
const { assertRequiredProductionSchema } = await import('../api/productionSchema.js');

const port = Number(process.env.PORT || 3002);
const host = process.env.HOST || '127.0.0.1';

await assertRequiredProductionSchema(tencentPgPool);

app.listen(port, host, () => {
  console.log(`剧幕录 API listening on http://${host}:${port}`);
});
