/**
 * 新增管理员账号（若用户名已存在则重置为管理员并改密码）
 *
 * 本地使用（需 .env 的 DATABASE_URL 或临时指定）：
 *   node scripts/create-admin.js <用户名> <密码>
 *   node scripts/create-admin.js <用户名> <密码> <邮箱>
 *
 * Render Shell 里使用（环境已有 DATABASE_URL）：
 *   node scripts/create-admin.js admin 你的密码
 *   node scripts/create-admin.js admin 你的密码 admin@example.com
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../db.js');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('请设置 DATABASE_URL（本地 .env 或 Render 环境已自动设置）');
    process.exit(1);
  }
  const username = process.argv[2] && process.argv[2].trim();
  const password = process.argv[3];
  const email = process.argv[4] && process.argv[4].trim();

  if (!username || !password) {
    console.log('用法: node scripts/create-admin.js <用户名> <密码> [邮箱]');
    console.log('示例: node scripts/create-admin.js admin mySecurePass123');
    console.log('      node scripts/create-admin.js admin mySecurePass123 admin@example.com');
    process.exit(1);
  }
  if (password.length < 6) {
    console.log('密码至少 6 位。');
    process.exit(1);
  }

  const hashed = await bcrypt.hash(String(password), 10);
  const emailVal = email || `${username}@admin.local`;

  try {
    const existing = await pool.query(
      'SELECT id, username FROM users WHERE username = $1',
      [username]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE users SET password = $1, "role" = 'admin', "status" = 'active', email = $2 WHERE username = $3`,
        [hashed, emailVal, username]
      );
      console.log('已更新已有账号为管理员：', username);
    } else {
      await pool.query(
        `INSERT INTO users (username, email, password, "role", "status") VALUES ($1, $2, $3, 'admin', 'active')`,
        [username, emailVal, hashed]
      );
      console.log('已新建管理员账号：', username);
    }
    console.log('请使用 用户名:', username, ' 密码: (你刚输入的密码) 登录管理后台。');
  } catch (err) {
    if (err.code === '23505' && err.constraint && err.constraint.includes('email')) {
      console.log('邮箱已被占用，请换一个邮箱或省略邮箱参数（将使用 用户名@admin.local）');
    } else {
      console.error('错误:', err.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
