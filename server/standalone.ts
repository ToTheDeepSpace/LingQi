import './loadEnv.js';

const { default: app } = await import('../api/index.js');

const port = Number(process.env.PORT || 3002);
const host = process.env.HOST || '127.0.0.1';

app.listen(port, host, () => {
  console.log(`LingQi API listening on http://${host}:${port}`);
});
