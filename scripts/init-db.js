/**
 * 初始化数据库表（users, schools）
 * 使用: DATABASE_URL=postgres://... node scripts/init-db.js
 */
require('dotenv').config();
const { pool } = require('../db.js');

const SQL = `
-- 用户表（含管理员字段，若用旧版 init 建过表请运行 scripts/migrate-admin.js）
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  role VARCHAR(20) DEFAULT 'user',
  status VARCHAR(20) DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0
);

-- 学校表（每个用户只能看到自己添加的）
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_user_id ON schools(user_id);

-- 出愿计划表（每个用户通过条件筛选/成绩/搜索加入的学校·学部列表，永久保存）
CREATE TABLE IF NOT EXISTS plan_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_items_user_id ON plan_items(user_id);

-- 班主任-学生关联
CREATE TABLE IF NOT EXISTS teacher_students (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON teacher_students(student_id);

-- 班主任提醒
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  plan_item_id INTEGER REFERENCES plan_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reminders_student ON reminders(student_id);
CREATE INDEX IF NOT EXISTS idx_reminders_teacher ON reminders(teacher_id);
`;

async function main() {
  try {
    await pool.query(SQL);
    console.log('Database tables initialized.');
  } catch (err) {
    console.error('Init failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
