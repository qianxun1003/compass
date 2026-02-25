/**
 * 为 reminders 表添加 read_at 列（学生标记已读时间）
 * 使用: DATABASE_URL=... node scripts/add-reminders-read-at.js
 */
require('dotenv').config();
const { pool } = require('../db.js');

async function main() {
  try {
    await pool.query(`
      ALTER TABLE reminders
      ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL
    `);
    console.log('reminders.read_at column added or already exists.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
