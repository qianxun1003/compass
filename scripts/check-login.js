/**
 * 检查某用户用某密码能否通过验证（用于排查登录问题）
 * 使用: node scripts/check-login.js <用户名> <密码>
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../db.js');

const username = (process.argv[2] || '').trim();
const password = process.argv[3];

if (!username || password === undefined) {
  console.log('用法: node scripts/check-login.js <用户名> <密码>');
  process.exit(1);
}

async function main() {
  try {
    const r = await pool.query('SELECT id, username, password, COALESCE(role,\'user\') AS role, COALESCE(status,\'active\') AS status FROM users WHERE username = $1', [username]);
    if (r.rows.length === 0) {
      console.log('未找到用户:', username);
      process.exit(1);
    }
    const u = r.rows[0];
    const match = await bcrypt.compare(password, u.password);
    console.log('用户:', u.username, 'id:', u.id);
    console.log('角色:', u.role, '状态:', u.status);
    console.log('密码匹配:', match ? '是 ✓' : '否 ✗');
    if (!match) console.log('→ 若刚重置过密码，请确认输入的是新密码，且登录的是同一环境（本地/线上）');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
