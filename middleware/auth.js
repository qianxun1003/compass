const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * 验证 JWT，将 user { id, username } 挂到 req.user
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未提供认证信息' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, username: payload.username };
    next();
  } catch (e) {
    return res.status(401).json({ message: '认证无效或已过期' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
