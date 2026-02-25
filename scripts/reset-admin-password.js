/**
 * 查看所有用户 或 重置指定用户为管理员并设置新密码（测试环境用）
 *
 * 查看所有账号（不修改任何东西）：
 *   node scripts/reset-admin-password.js
 *
 * 把某账号设为管理员并改密码（例如用户名是 ichikawaadmin）：
 *   node scripts/reset-admin-password.js ichikawaadmin 新密码
 *
 * 需配置 .env 中的 DATABASE_URL
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../db.js');

async function listUsers() {
  const res = await pool.query(
    "SELECT id, username, email, COALESCE(role, 'user') AS role, COALESCE(status, 'active') AS status, created_at FROM users ORDER BY id"
  );
  if (res.rows.length === 0) {
    console.log('数据库里暂无用户。');
    return;
  }
  console.log('当前用户列表：');
  const idW = 4, nameW = 18, emailW = 28, roleW = 12, statusW = 8;
  const pad = (s, w) => String(s).slice(0, w).padEnd(w);
  console.log(pad('ID', idW) + pad('用户名', nameW) + pad('邮箱', emailW) + pad('角色', roleW) + pad('状态', statusW));
  console.log('-'.repeat(idW + nameW + emailW + roleW + statusW));
  res.rows.forEach((u) => {
    console.log(pad(u.id, idW) + pad(u.username || '', nameW) + pad(u.email || '', emailW) + pad(u.role, roleW) + pad(u.status, statusW));
  });
  console.log('\n若要把某用户设为管理员并改密码，请执行：');
  console.log('  node scripts/reset-admin-password.js <用户名> <新密码>');
}

async function resetPassword(username, newPassword) {
  if (!username || !newPassword) {
    console.log('用法: node scripts/reset-admin-password.js <用户名> <新密码>');
    console.log('示例: node scripts/reset-admin-password.js ichikawaadmin mynewpass');
    process.exit(1);
  }
  if (newPassword.length < 6) {
    console.log('密码至少 6 位。');
    process.exit(1);
  }
  const hashed = await bcrypt.hash(String(newPassword), 10);
  const res = await pool.query(
    "UPDATE users SET password = $1, role = 'admin', status = 'active' WHERE username = $2 RETURNING id, username, role, status",
    [hashed, String(username).trim()]
  );
  if (res.rows.length === 0) {
    console.log('未找到用户名为 "' + username + '" 的账号，请先执行无参数命令查看用户列表。');
    process.exit(1);
  }
  const u = res.rows[0];
  console.log('已更新：', u.username, '→ 角色:', u.role, '状态:', u.status);
  console.log('请使用用户名 "' + u.username + '" 和新密码登录管理后台。');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('请先配置 .env 中的 DATABASE_URL');
    process.exit(1);
  }
  const [, , username, newPassword] = process.argv;
  try {
    if (!username) {
      await listUsers();
    } else {
      await resetPassword(username, newPassword);
    }
  } catch (err) {
    console.error('错误:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
