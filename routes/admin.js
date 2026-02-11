const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db.js');
const { JWT_SECRET } = require('../middleware/auth.js');
const { requireAdmin } = require('../middleware/adminAuth.js');

const router = express.Router();

// 健康检查：确认后台接口已挂载（GET /api/admin/ok 返回 200）
router.get('/ok', (req, res) => {
  res.json({ ok: true, message: 'admin API 已就绪' });
});

// Excel 列名 -> JSON 字段（与 export_school_data.py 一致）
const COLUMN_MAP = {
  '大学': 'name',
  '学部': 'department',
  '学科': 'major',
  '位置': 'region',
  '文理': 'bunri',
  '方式': 'selectionMethod',
  '第几期': 'period',
  '併願': 'combined',
  '能使用EJU': 'ejuPeriod',
  '需要EJU科目': 'ejuSubjects',
  '英语': 'english',
  'JLPT': 'jlpt',
  '网上出愿开始时间': 'mailStart',
  '网上出愿截止时间': 'mailEnd',
  '邮寄开始时间': 'mailStartDate',
  '邮寄截止时间': 'mailEndDate',
  '必着/消印': 'mailEndNote',
  '校内考形式': 'examFormat',
  '校内考时间1': 'examDate',
  '校内考时间2': 'examDate2',
  '发榜时间': 'announcementDate',
};
const CSV_COLS = ['大学', '学部', '学科', '位置', '文理', '方式', '第几期', '併願', '能使用EJU', '需要EJU科目', '英语', 'JLPT', '校内考形式', '网上出愿开始时间', '网上出愿截止时间', '邮寄开始时间', '邮寄截止时间', '校内考时间1', '校内考时间2', '发榜时间'];

function toJsValue(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && v instanceof Date) return v.toISOString().replace('T', ' ').substring(0, 19);
  const s = String(v).trim();
  return s || null;
}

function writeOperationLog(operatorId, operatorName, action, targetType, targetId, ip, result, details) {
  pool.query(
    'INSERT INTO operation_logs (operator_id, operator_name, action, target_type, target_id, ip, result, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [operatorId, operatorName, action, targetType || null, targetId || null, ip || null, result || 'success', details ? JSON.stringify(details) : null]
  ).catch((err) => console.error('operation_log write error:', err));
}

// ---------- 管理员登录（不经过 requireAdmin） ----------
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: '请提供用户名和密码' });
    }
    const result = await pool.query(
      'SELECT id, username, email, password, role, status FROM users WHERE username = $1',
      [String(username).trim()]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    const role = (user.role || '').toString().trim().toLowerCase();
    const status = (user.status || '').toString().trim().toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({ message: '该账号不是管理员' });
    }
    if (status !== 'active') {
      return res.status(403).json({ message: '账号已停用' });
    }
    const match = await bcrypt.compare(String(password), user.password);
    if (!match) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    await pool.query(
      'UPDATE users SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1',
      [user.id]
    );
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
    writeOperationLog(user.id, user.username, 'admin_login', 'user', String(user.id), ip, 'success', null);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: 'admin' },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 以下路由均需管理员权限
router.use(requireAdmin);

// ---------- 数据概览 ----------
router.get('/dashboard', async (req, res) => {
  try {
    const [usersRes, schoolsRes, planRes, todayUsersRes, todaySchoolsRes] = await Promise.all([
      pool.query("SELECT COUNT(*) AS c FROM users WHERE COALESCE(status, 'active') != 'deleted'"),
      pool.query('SELECT COUNT(*) AS c FROM schools'),
      pool.query('SELECT COUNT(*) AS c FROM plan_items'),
      pool.query("SELECT COUNT(*) AS c FROM users WHERE created_at >= CURRENT_DATE AND COALESCE(status, 'active') != 'deleted'"),
      pool.query('SELECT COUNT(*) AS c FROM schools WHERE added_at >= CURRENT_DATE'),
    ]);
    res.json({
      totalUsers: parseInt(usersRes.rows[0]?.c || 0, 10),
      totalSchools: parseInt(schoolsRes.rows[0]?.c || 0, 10),
      totalPlans: parseInt(planRes.rows[0]?.c || 0, 10),
      todayUsers: parseInt(todayUsersRes.rows[0]?.c || 0, 10),
      todaySchools: parseInt(todaySchoolsRes.rows[0]?.c || 0, 10),
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 最近动态（最新用户、最新学校）
router.get('/dashboard/recent', async (req, res) => {
  try {
    const [usersRes, schoolsRes] = await Promise.all([
      pool.query(
        "SELECT id, username, email, created_at FROM users WHERE COALESCE(status, 'active') != 'deleted' ORDER BY created_at DESC LIMIT 10"
      ),
      pool.query(
        'SELECT s.id, s.school_name, s.location, s.added_at, u.username AS added_by FROM schools s JOIN users u ON u.id = s.user_id ORDER BY s.added_at DESC LIMIT 20'
      ),
    ]);
    res.json({
      recentUsers: usersRes.rows,
      recentSchools: schoolsRes.rows,
    });
  } catch (err) {
    console.error('Admin dashboard recent error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 用户管理 ----------
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim().replace(/%/g, '\\%');
    const role = req.query.role; // user | admin
    const statusFilter = req.query.status; // active | disabled | deleted

    let where = " WHERE 1=1 ";
    const params = [];
    let n = 1;
    if (search) {
      where += ` AND (username ILIKE $${n} OR email ILIKE $${n}) `;
      params.push('%' + search + '%');
      n++;
    }
    if (role === 'user' || role === 'admin') {
      where += ` AND COALESCE(role, 'user') = $${n} `;
      params.push(role);
      n++;
    }
    if (statusFilter === 'active' || statusFilter === 'disabled' || statusFilter === 'deleted') {
      where += ` AND COALESCE(status, 'active') = $${n} `;
      params.push(statusFilter);
      n++;
    }

    const countRes = await pool.query('SELECT COUNT(*) AS c FROM users' + where, params);
    const total = parseInt(countRes.rows[0]?.c || 0, 10);

    params.push(limit, offset);
    const listRes = await pool.query(
      `SELECT u.id, u.username, u.email, COALESCE(u.role, 'user') AS role, COALESCE(u.status, 'active') AS status,
       u.created_at, u.last_login_at, COALESCE(u.login_count, 0) AS login_count,
       (SELECT COUNT(*) FROM schools WHERE user_id = u.id) AS school_count
       FROM users u ${where} ORDER BY u.created_at DESC LIMIT $${n} OFFSET $${n + 1}`,
      params
    );
    res.json({ list: listRes.rows, total, page, limit });
  } catch (err) {
    console.error('Admin users list error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: '无效ID' });
    const userRes = await pool.query(
      "SELECT id, username, email, COALESCE(role, 'user') AS role, COALESCE(status, 'active') AS status, created_at, last_login_at, COALESCE(login_count, 0) AS login_count FROM users WHERE id = $1",
      [id]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ message: '用户不存在' });
    const schoolsRes = await pool.query('SELECT id, school_name, location, notes, added_at FROM schools WHERE user_id = $1 ORDER BY added_at DESC', [id]);
    res.json({ ...user, schools: schoolsRes.rows });
  } catch (err) {
    console.error('Admin user detail error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: '无效ID' });
    const { username, email, role, status } = req.body || {};
    const updates = [];
    const params = [];
    let n = 1;
    if (username !== undefined && String(username).trim().length >= 3) {
      updates.push(`username = $${n}`);
      params.push(String(username).trim());
      n++;
    }
    if (email !== undefined && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      updates.push(`email = $${n}`);
      params.push(String(email).trim().toLowerCase());
      n++;
    }
    if (role === 'user' || role === 'admin') {
      updates.push(`role = $${n}`);
      params.push(role);
      n++;
    }
    if (status === 'active' || status === 'disabled' || status === 'deleted') {
      updates.push(`status = $${n}`);
      params.push(status);
      n++;
    }
    if (updates.length === 0) return res.status(400).json({ message: '没有可更新字段' });
    params.push(id);
    await pool.query('UPDATE users SET ' + updates.join(', ') + ' WHERE id = $' + n, params);
    writeOperationLog(req.adminUser.id, req.adminUser.username, 'update_user', 'user', String(id), req.headers['x-forwarded-for'] || req.socket?.remoteAddress, 'success', { updates: Object.keys(req.body || {}) });
    res.json({ message: '已更新' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: '用户名或邮箱已被使用' });
    console.error('Admin user update error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 学校管理（全部用户的 schools） ----------
router.get('/schools', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(10, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
    const search = (req.query.search || '').trim().replace(/%/g, '\\%');

    let where = ' WHERE 1=1 ';
    const params = [];
    let n = 1;
    if (userId && !Number.isNaN(userId)) {
      where += ` AND s.user_id = $${n} `;
      params.push(userId);
      n++;
    }
    if (search) {
      where += ` AND (s.school_name ILIKE $${n} OR s.location ILIKE $${n}) `;
      params.push('%' + search + '%');
      n++;
    }
    const countRes = await pool.query('SELECT COUNT(*) AS c FROM schools s' + where, params);
    const total = parseInt(countRes.rows[0]?.c || 0, 10);
    params.push(limit, offset);
    const listRes = await pool.query(
      `SELECT s.id, s.school_name, s.location, s.notes, s.added_at, s.user_id, u.username AS added_by
       FROM schools s JOIN users u ON u.id = s.user_id ${where} ORDER BY s.added_at DESC LIMIT $${n} OFFSET $${n + 1}`,
      params
    );
    res.json({ list: listRes.rows, total, page, limit });
  } catch (err) {
    console.error('Admin schools list error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

router.delete('/schools/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: '无效ID' });
    const result = await pool.query('DELETE FROM schools WHERE id = $1 RETURNING id, school_name', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: '学校不存在' });
    writeOperationLog(req.adminUser.id, req.adminUser.username, 'delete_school', 'school', String(id), req.headers['x-forwarded-for'] || req.socket?.remoteAddress, 'success', { school_name: result.rows[0].school_name });
    res.json({ message: '已删除' });
  } catch (err) {
    console.error('Admin school delete error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 学校总览数据更新（Excel 上传） ----------
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const projectRoot = path.resolve(__dirname, '..');
const backupsDir = path.join(projectRoot, 'backups');

router.post('/data-update', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: '请上传 Excel 文件' });
    }
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (raw.length < 2) {
      return res.status(400).json({ message: 'Excel 表为空或只有表头' });
    }
    const headers = raw[0].map((h) => (h != null ? String(h).trim() : ''));
    const rows = [];
    for (let i = 1; i < raw.length; i++) {
      const row = {};
      headers.forEach((excelCol, idx) => {
        const jsKey = COLUMN_MAP[excelCol];
        if (jsKey) {
          const v = raw[i][idx];
          const val = toJsValue(v);
          if (val != null) row[jsKey] = val;
        }
      });
      if (row.name) rows.push(row);
    }
    if (rows.length === 0) {
      return res.status(400).json({ message: '未解析到有效数据，请确保第一行为表头且包含「大学」列' });
    }
    const data = { data: rows };

    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const jsonPath = path.join(projectRoot, '学校总览.json');
    const csvPath = path.join(projectRoot, '学校总览.csv');
    if (fs.existsSync(jsonPath)) {
      fs.copyFileSync(jsonPath, path.join(backupsDir, `学校总览_${timestamp}.json`));
      if (fs.existsSync(csvPath)) fs.copyFileSync(csvPath, path.join(backupsDir, `学校总览_${timestamp}.csv`));
    }

    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 0), 'utf8');
    const csvHeader = CSV_COLS.join(',');
    const csvRows = rows.map((r) => {
      const revMap = {};
      Object.keys(COLUMN_MAP).forEach((k) => (revMap[COLUMN_MAP[k]] = k));
      return CSV_COLS.map((c) => {
        const key = COLUMN_MAP[c];
        const val = key ? (r[key] != null ? String(r[key]).replace(/"/g, '""') : '') : '';
        return val.includes(',') || val.includes('"') ? '"' + val + '"' : val;
      }).join(',');
    });
    fs.writeFileSync(csvPath, '\uFEFF' + csvHeader + '\n' + csvRows.join('\n'), 'utf8');

    writeOperationLog(req.adminUser.id, req.adminUser.username, 'data_update', 'school_master', null, req.headers['x-forwarded-for'] || req.socket?.remoteAddress, 'success', { count: rows.length, backup: `学校总览_${timestamp}.json` });
    res.json({ message: '更新成功', count: rows.length, backup: `学校总览_${timestamp}` });
  } catch (err) {
    console.error('Admin data-update error:', err);
    res.status(500).json({ message: err.message || '服务器错误' });
  }
});

// 当前数据版本信息（仅统计条数，便于后台显示）
router.get('/data-update/info', async (req, res) => {
  try {
    const jsonPath = path.join(projectRoot, '学校总览.json');
    let count = 0;
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      try {
        const obj = JSON.parse(raw);
        count = Array.isArray(obj.data) ? obj.data.length : 0;
      } catch (e) {}
    }
    const backups = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 10) : [];
    res.json({ currentCount: count, recentBackups: backups });
  } catch (err) {
    console.error('Admin data-update info error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
