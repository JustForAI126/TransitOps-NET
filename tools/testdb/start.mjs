// Portable PostgreSQL for local testing, isolated from the shared Supabase database.
// Usage: node start.mjs [--reset]   (Ctrl+C to stop)
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, 'data');
if (process.argv.includes('--reset') && existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'transitops',
  password: 'transitops_local_test',
  port: 5433,
  persistent: true,
});

const fresh = !existsSync(dataDir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('transitops_test');
console.log('READY postgres on localhost:5433, database transitops_test');

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
