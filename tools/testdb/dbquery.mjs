// Runs one SQL query against the local test database and prints JSON rows. Usage: node dbquery.mjs "<sql>"
import pg from 'pg';
const client = new pg.Client({ host: 'localhost', port: 5433, database: 'transitops_test', user: 'transitops', password: 'transitops_local_test' });
await client.connect();
try {
  const result = await client.query(process.argv[2]);
  console.log(JSON.stringify(result.rows));
} finally {
  await client.end();
}
