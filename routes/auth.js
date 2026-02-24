const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db.js');
const { JWT_SECRET } = require('../middleware/auth.js');
const { authMiddleware } = require('../middleware/auth.js');

const router = express.Router();

// GET /api/health 健康检查（部署后打开此地址可确认接口与数据库配置）
router.get('/health', (req, res) => {
  res.json({ ok: true, db: !!process.env.DATABASE_URL });
});

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ message: '请提供用户名、邮箱和密码' });
    }
    if (String(username).trim().length < 3) {
      return res.status(400).json({ message: '用户名至少3个字符' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: '密码至少6个字符' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ message: '请输入有效的邮箱地址' });
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [String(username).trim(), String(email).trim().toLowerCase(), hashed]
    );
    const user = result.rows[0];
    res.status(201).json({
      message: '注册成功',
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: '用户名或邮箱已被使用' });
    }
    console.error('Register error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: '请提供用户名和密码' });
    }

    const result = await pool.query(
      'SELECT id, username, email, password, COALESCE("role", \'user\') AS role FROM users WHERE username = $1',
      [String(username).trim()]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    const match = await bcrypt.compare(String(password), user.password);
    if (!match) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const role = (user.role || 'user').toString().trim().toLowerCase();
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// GET /api/me - 当前登录用户信息（含 role，用于学生端判断是否显示「前往管理后台」）
router.get('/me', authMiddleware, async (req, res) => {
  try {
    console.log('[api] GET /api/me 被请求, userId=', req.user && req.user.id);
    const result = await pool.query(
      'SELECT id, username, email, COALESCE("role", \'user\') AS role FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    const role = (user.role || 'user').toString().trim().toLowerCase();
    console.log('[api] GET /api/me 返回 userId=', req.user.id, 'role=', role);
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: role
    });
  } catch (err) {
    console.error('GET /api/me error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
