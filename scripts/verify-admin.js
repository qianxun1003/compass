/**
 * 查看指定用户是否已是管理员（用于排查登录问题）
 * 使用: node scripts/verify-admin.js [用户名]
 * 不传用户名则列出所有用户的 id, username, role, status
 */
require('dotenv').config();
const { pool } = require('../db.js');

const username = process.argv[2];

async function main() {
  try {
    if (username) {
      const result = await pool.query(
        'SELECT id, username, email, COALESCE(role, \'<未设置>\') AS role, COALESCE(status, \'<未设置>\') AS status FROM users WHERE username = $1',
        [username.trim()]
      );
      if (result.rows.length === 0) {
        console.log('未找到用户:', username);
        process.exit(1);
      }
      const u = result.rows[0];
      console.log('用户:', u.username, '(id:', u.id + ')');
      console.log('  role:', u.role, u.role === 'admin' ? '✓ 是管理员' : '✗ 不是管理员');
      console.log('  status:', u.status, u.status === 'active' ? '✓ 可登录' : '✗ 不可登录');
    } else {
      const result = await pool.query(
        'SELECT id, username, COALESCE(role, \'user\') AS role, COALESCE(status, \'active\') AS status FROM users ORDER BY id'
      );
      console.log('所有用户:');
      result.rows.forEach((u) => {
        console.log('  id=%s username=%s role=%s status=%s', u.id, u.username, u.role, u.status);
      });
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
