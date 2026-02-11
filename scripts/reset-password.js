/**
 * 重置指定用户的密码（用于忘记密码时）
 * 使用: node scripts/reset-password.js <用户名> <新密码>
 * 示例: node scripts/reset-password.js ichikawaadmin mynewpassword
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../db.js');

const username = process.argv[2];
const newPassword = process.argv[3];

if (!username || !newPassword) {
  console.log('用法: node scripts/reset-password.js <用户名> <新密码>');
  console.log('示例: node scripts/reset-password.js ichikawaadmin mynewpassword');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.log('新密码至少 6 个字符');
  process.exit(1);
}

async function main() {
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username',
      [hashed, username.trim()]
    );
    if (result.rowCount === 0) {
      console.log('未找到用户:', username);
      process.exit(1);
    }
    console.log('已重置密码，用户:', result.rows[0].username);
    console.log('请使用新密码登录管理员后台。');
  } catch (err) {
    console.error('执行失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
