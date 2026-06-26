// MySQL connection pool shared by all route handlers.
const mysql = require('mysql2/promise');
require('dotenv').config();

// Supports two sets of env var names: DB_* for local development and MYSQL* for Railway deployments.
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || process.env.MYSQLHOST     || 'localhost',
  port:     Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
  user:     process.env.DB_USER     || process.env.MYSQLUSER     || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME     || process.env.MYSQLDATABASE || 'estatehub_db',
  waitForConnections: true,
  connectionLimit: 10,
  // Railway injects MYSQLHOST; if present the server is remote so TLS is required.
  ssl: process.env.MYSQLHOST ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
