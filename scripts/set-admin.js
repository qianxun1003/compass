/**
 * 将指定用户设为管理员（执行 migrate-admin 之后运行一次即可）
 * 使用: node scripts/set-admin.js <用户名>
 * 示例: node scripts/set-admin.js admin
 */
require('dotenv').config();
const { pool } = require('../db.js');

const username = process.argv[2];
if (!username) {
  console.log('用法: node scripts/set-admin.js <用户名>');
  console.log('示例: node scripts/set-admin.js admin');
  process.exit(1);
}

async function main() {
  try {
    const result = await pool.query(
      "UPDATE users SET role = 'admin', status = 'active' WHERE username = $1 RETURNING id, username, email",
      [username.trim()]
    );
    if (result.rowCount === 0) {
      console.log('未找到用户:', username);
      console.log('请先在前台注册该账号，或检查用户名是否正确。');
      process.exit(1);
    }
    const user = result.rows[0];
    console.log('已设置为管理员:', user.username, '(id:', user.id + ')');
  } catch (err) {
    console.error('执行失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
