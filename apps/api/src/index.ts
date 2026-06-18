import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`CareerForge API listening on ${env.API_BASE_URL} (${env.NODE_ENV})`);
});
