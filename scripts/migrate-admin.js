/**
 * 为管理员后台扩展数据库：users 增加 role/status/登录字段，创建 operation_logs
 * 使用: DATABASE_URL=postgres://... node scripts/migrate-admin.js
 * 对已有库可重复执行（幂等）。
 */
require('dotenv').config();
const { pool } = require('../db.js');

const SQL = `
-- users 表增加管理员与状态字段（存在则跳过）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role') THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='status') THEN
    ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='last_login_at') THEN
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='login_count') THEN
    ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 操作日志表（可选，供后台「操作日志」页使用）
CREATE TABLE IF NOT EXISTS operation_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  operator_id INTEGER REFERENCES users(id),
  operator_name VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(100),
  ip VARCHAR(45),
  result VARCHAR(20) DEFAULT 'success',
  details JSONB
);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operator_id ON operation_logs(operator_id);
`;

async function main() {
  try {
    await pool.query(SQL);
    console.log('Admin migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
