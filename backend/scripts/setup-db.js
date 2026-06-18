/**
 * Imports estatehub_schema.sql into MySQL.
 * Requires .env with DB credentials. Run: npm run setup-db
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const sqlPath = path.join(__dirname, '..', '..', 'estatehub_schema.sql');

async function setup() {
  if (!fs.existsSync(sqlPath)) {
    console.error('Schema file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('Importing estatehub_schema.sql...');
  await connection.query(sql);
  await connection.end();
  console.log('Database setup complete.');
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
