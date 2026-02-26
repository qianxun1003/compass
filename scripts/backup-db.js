/**
 * 数据库备份脚本：将关键表导出为 JSON，便于每日备份与灾难恢复。
 * 使用: DATABASE_URL=postgres://... node scripts/backup-db.js
 * 建议配合 cron 每日执行，例如: 0 2 * * * cd /path/to/project && node scripts/backup-db.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db.js');

const projectRoot = path.resolve(__dirname, '..');
const backupsDir = path.join(projectRoot, 'backups');

function serializeRow(row) {
  const out = {};
  for (const key of Object.keys(row)) {
    const v = row[key];
    if (v instanceof Date) out[key] = v.toISOString();
    else out[key] = v;
  }
  return out;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('未设置 DATABASE_URL');
    process.exit(1);
  }
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `db-backup-${ts}.json`;
  const filepath = path.join(backupsDir, filename);

  try {
    const [users, schools, planItems, teacherStudents, reminders, operationLogs] = await Promise.all([
      pool.query('SELECT * FROM users ORDER BY id'),
      pool.query('SELECT * FROM schools ORDER BY id'),
      pool.query('SELECT * FROM plan_items ORDER BY id'),
      pool.query('SELECT * FROM teacher_students ORDER BY teacher_id, student_id'),
      pool.query('SELECT * FROM reminders ORDER BY id'),
      pool.query('SELECT * FROM operation_logs ORDER BY id'),
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      users: users.rows.map(serializeRow),
      schools: schools.rows.map(serializeRow),
      plan_items: planItems.rows.map(serializeRow),
      teacher_students: teacherStudents.rows.map(serializeRow),
      reminders: reminders.rows.map(serializeRow),
      operation_logs: operationLogs.rows.map(serializeRow),
    };

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 0), 'utf8');
    console.log('备份已写入:', filepath);

    // 若存在学校总览，一并复制到当日备份目录（与 data-update 的备份命名一致便于统一管理）
    const schoolMasterPath = path.join(projectRoot, '学校总览.json');
    if (fs.existsSync(schoolMasterPath)) {
      const schoolBackupPath = path.join(backupsDir, `学校总览_${ts}.json`);
      fs.copyFileSync(schoolMasterPath, schoolBackupPath);
      console.log('学校总览已复制:', schoolBackupPath);
    }
  } catch (err) {
    console.error('备份失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
