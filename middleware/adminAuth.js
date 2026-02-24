const jwt = require('jsonwebtoken');
const { pool } = require('../db.js');
const { JWT_SECRET } = require('./auth.js');

/**
 * 校验 JWT 且要求用户为 admin、status=active，将 user 挂到 req.adminUser
 * 用于 /api/admin/* 路由
 */
async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '请先登录管理员账号' });
  }
  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ message: '登录已过期或无效，请重新登录' });
  }
  const userId = payload.userId;
  if (!userId) {
    return res.status(401).json({ message: '无效的登录信息' });
  }
  try {
    let user = null;
    try {
      const result = await pool.query(
        'SELECT id, username, email, COALESCE("role", \'admin\') AS role, COALESCE("status", \'active\') AS status FROM users WHERE id = $1',
        [userId]
      );
      user = result.rows[0];
    } catch (qerr) {
      if (/column.*(role|status).*does not exist/i.test(qerr.message)) {
        const fallback = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [userId]);
        user = fallback.rows[0] ? { ...fallback.rows[0], role: 'admin', status: 'active' } : null;
      } else throw qerr;
    }
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }
    const role = (user.role || 'admin').toString().trim().toLowerCase();
    const allowedRoles = ['admin', 'super_admin', 'teacher'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: '仅管理员或班主任可访问' });
    }
    if ((user.status || 'active').toString().toLowerCase() !== 'active') {
      return res.status(403).json({ message: '账号已停用' });
    }
    req.adminUser = { id: user.id, username: user.username, email: user.email, role: role };
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    const hint = /column.*does not exist/i.test(err.message)
      ? ' 若数据库为旧版，请运行：node scripts/migrate-admin.js'
      : '';
    res.status(500).json({
      message: '服务器错误' + hint,
      error: err.message,
    });
  }
}

module.exports = { requireAdmin };
