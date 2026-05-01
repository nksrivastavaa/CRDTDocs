const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'collab',
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'collab',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'collab_password',
  });

  await client.connect();

  for (const file of ['01-init.sql', '02-seed.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    await client.query(sql);
    console.log(`Applied ${file}`);
  }

  await client.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
