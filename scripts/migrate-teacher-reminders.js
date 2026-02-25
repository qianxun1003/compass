/**
 * 班主任与提醒功能迁移：teacher_students、reminders 表；角色 super_admin / teacher
 * 使用: DATABASE_URL=... node scripts/migrate-teacher-reminders.js
 */
require('dotenv').config();
const { pool } = require('../db.js');

const SQL = `
-- 班主任-学生关联表（一名班主任可带多名学生）
CREATE TABLE IF NOT EXISTS teacher_students (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON teacher_students(student_id);

-- 班主任提醒记录（学生可端显示）
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

-- 确保 users.role 支持 super_admin, teacher（已有 admin, user）
-- 不修改现有数据，仅表结构已支持 VARCHAR(20)
`;

async function main() {
  try {
    await pool.query(SQL);
    console.log('Migration (teacher_students, reminders) completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
