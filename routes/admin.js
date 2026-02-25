const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
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
      'SELECT id, username, email, password, "role", "status" FROM users WHERE username = $1',
      [String(username).trim()]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    const role = (user.role || '').toString().trim().toLowerCase();
    const status = (user.status || '').toString().trim().toLowerCase();
    const allowedRoles = ['admin', 'super_admin', 'teacher'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: '该账号不是管理员或班主任' });
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
      { userId: user.id, username: user.username, role: role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;
    writeOperationLog(user.id, user.username, 'admin_login', 'user', String(user.id), ip, 'success', null);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: role },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 以下路由均需管理员权限
router.use(requireAdmin);

// 权限检查：仅最高管理员可执行（admin 或 super_admin）
function requireSuperAdmin(req, res, next) {
  const role = (req.adminUser && req.adminUser.role) || '';
  if (role === 'super_admin' || role === 'admin') return next();
  return res.status(403).json({ message: '仅最高管理员可执行此操作' });
}

// 班主任或最高管理员
function requireTeacherOrSuper(req, res, next) {
  const role = (req.adminUser && req.adminUser.role) || '';
  if (['teacher', 'super_admin', 'admin'].includes(role)) return next();
  return res.status(403).json({ message: '需要班主任或管理员权限' });
}

// ---------- 当前登录者信息（用于前端根据 role 显示不同菜单） ----------
router.get('/me', (req, res) => {
  res.json({
    id: req.adminUser.id,
    username: req.adminUser.username,
    email: req.adminUser.email,
    role: req.adminUser.role || 'admin',
  });
});

// 班主任/管理员共用「学生端预览」账号用户名（跳转学生端时统一用此账号登录）
const STAFF_PREVIEW_USERNAME = 'staff_preview';

// ---------- 获取学生端预览 Token（班主任/管理员跳转学生端时用，统一登录为 staff_preview 账号） ----------
router.post('/student-preview-token', async (req, res) => {
  try {
    let result = await pool.query(
      'SELECT id, username, email FROM users WHERE username = $1',
      [STAFF_PREVIEW_USERNAME]
    );
    let user = result.rows[0];
    if (!user) {
      const hashed = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      const email = STAFF_PREVIEW_USERNAME + '@internal.local';
      result = await pool.query(
        'INSERT INTO users (username, email, password, "role", "status") VALUES ($1, $2, $3, \'user\', \'active\') RETURNING id, username, email',
        [STAFF_PREVIEW_USERNAME, email, hashed]
      );
      user = result.rows[0];
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email || '', role: 'user' },
    });
  } catch (err) {
    console.error('student-preview-token error:', err);
    res.status(500).json({ message: '获取学生端预览账号失败' });
  }
});

// ---------- 生成学生账号（班主任/管理员均可） ----------
router.post('/users/create', async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: '请提供用户名和密码' });
    }
    if (String(username).trim().length < 2) {
      return res.status(400).json({ message: '用户名至少2个字符' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: '密码至少6个字符' });
    }
    const uname = String(username).trim();
    let emailVal = email != null && String(email).trim() ? String(email).trim().toLowerCase() : null;
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      return res.status(400).json({ message: '邮箱格式无效' });
    }
    if (!emailVal) emailVal = uname + '@account.local';
    const hashed = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password, "role", "status") VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, created_at',
      [uname, emailVal, hashed, 'user', 'active']
    );
    const user = result.rows[0];
    writeOperationLog(req.adminUser.id, req.adminUser.username, 'create_student_account', 'user', String(user.id), req.headers['x-forwarded-for'] || req.socket?.remoteAddress, 'success', { username: user.username });
    res.status(201).json({
      message: '账号已生成，请将用户名和密码告知学生',
      user: { id: user.id, username: user.username, email: user.email || '' },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: '用户名或邮箱已被使用' });
    }
    console.error('Admin create user error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 添加班主任账号（仅最高管理员） ----------
router.post('/users/create-teacher', requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: '请提供用户名和密码' });
    }
    if (String(username).trim().length < 2) {
      return res.status(400).json({ message: '用户名至少2个字符' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: '密码至少6个字符' });
    }
    const uname = String(username).trim();
    let emailVal = email != null && String(email).trim() ? String(email).trim().toLowerCase() : null;
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      return res.status(400).json({ message: '邮箱格式无效' });
    }
    if (!emailVal) emailVal = uname + '@teacher.local';
    const hashed = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password, "role", "status") VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, created_at',
      [uname, emailVal, hashed, 'teacher', 'active']
    );
    const user = result.rows[0];
    writeOperationLog(req.adminUser.id, req.adminUser.username, 'create_teacher_account', 'user', String(user.id), req.headers['x-forwarded-for'] || req.socket?.remoteAddress, 'success', { username: user.username });
    res.status(201).json({
      message: '班主任账号已创建，请将用户名和密码告知该同事',
      user: { id: user.id, username: user.username, email: user.email || '', role: 'teacher' },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: '用户名或邮箱已被使用' });
    }
    console.error('Admin create teacher error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 学生角色：非管理员/班主任即视为学生（兼容 role 存 'user'/'学生'/'用户' 等，PostgreSQL 中 role 为保留字用 "role"）
const STUDENT_ROLE_CONDITION = "(LOWER(TRIM(COALESCE(u.\"role\", 'user'))) NOT IN ('admin', 'super_admin', 'teacher'))";

// ---------- 班主任：我的学生列表 ----------
router.get('/teacher/my-students', requireTeacherOrSuper, async (req, res) => {
  try {
    const teacherId = req.adminUser.id;
    const isSuper = ['super_admin', 'admin'].includes(req.adminUser.role || '');
    let list;
    if (isSuper) {
      const r = await pool.query(
        `SELECT u.id, u.username, u.email, u.created_at,
         (SELECT COUNT(*) FROM plan_items WHERE user_id = u.id) AS plan_count,
         (SELECT COUNT(*) FROM reminders WHERE student_id = u.id) AS reminder_count
         FROM users u
         WHERE ${STUDENT_ROLE_CONDITION} AND COALESCE(u."status", 'active') = 'active'
         ORDER BY u.username`
      );
      list = r.rows;
    } else {
      const r = await pool.query(
        `SELECT u.id, u.username, u.email, u.created_at,
         (SELECT COUNT(*) FROM plan_items WHERE user_id = u.id) AS plan_count,
         (SELECT COUNT(*) FROM reminders WHERE student_id = u.id) AS reminder_count
         FROM teacher_students ts
         JOIN users u ON u.id = ts.student_id
         WHERE ts.teacher_id = $1 AND COALESCE(u."status", 'active') = 'active'
         ORDER BY u.username`,
        [teacherId]
      );
      list = r.rows;
    }
    const assignedIds = new Set();
    if (!isSuper) {
      const ar = await pool.query('SELECT student_id FROM teacher_students WHERE teacher_id = $1', [teacherId]);
      ar.rows.forEach((row) => assignedIds.add(row.student_id));
    }
    res.json({ list, assignedIds: Array.from(assignedIds), isSuper });
  } catch (err) {
    console.error('Admin teacher my-students error:', err.message, err.stack);
    res.status(500).json({
      message: '服务器错误',
      ...(process.env.NODE_ENV !== 'production' && { error: err.message, code: err.code }),
    });
  }
});

// ---------- 班主任：用户列表中的学生（全部学生角色），带 inPool 标记，用于「学生池」勾选添加 ----------
// 与「用户管理」一致：凡非 admin/super_admin/teacher 均视为学生，且不按 status 过滤，避免与用户管理所见不一致
router.get('/teacher/students/available', requireTeacherOrSuper, async (req, res) => {
  try {
    const teacherId = req.adminUser.id;
    const isSuper = ['super_admin', 'admin'].includes(req.adminUser.role || '');
    const r = await pool.query(
      `SELECT u.id, u.username, u.email FROM users u
       WHERE ${STUDENT_ROLE_CONDITION}
       ORDER BY u.username`
    );
    let inPoolSet = new Set();
    if (!isSuper) {
      const poolRows = await pool.query(
        'SELECT student_id FROM teacher_students WHERE teacher_id = $1',
        [teacherId]
      );
      poolRows.rows.forEach((row) => inPoolSet.add(row.student_id));
    } else {
      r.rows.forEach((row) => inPoolSet.add(row.id));
    }
    const list = r.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      inPool: inPoolSet.has(row.id)
    }));
    res.json({ list });
  } catch (err) {
    console.error('Admin teacher available students error:', err.message, err.stack);
    res.status(500).json({
      message: '服务器错误',
      ...(process.env.NODE_ENV !== 'production' && { error: err.message, code: err.code }),
    });
  }
});

// ---------- 班主任：将学生加入我的班级 ----------
router.post('/teacher/students/:id', requireTeacherOrSuper, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: '无效ID' });
    const teacherId = req.adminUser.id;
    await pool.query(
      'INSERT INTO teacher_students (teacher_id, student_id) VALUES ($1, $2) ON CONFLICT (teacher_id, student_id) DO NOTHING',
      [teacherId, studentId]
    );
    const u = await pool.query(
      `SELECT id, username FROM users WHERE id = $1 AND (LOWER(TRIM(COALESCE("role", 'user'))) NOT IN ('admin', 'super_admin', 'teacher'))`,
      [studentId]
    );
    if (u.rows.length === 0) return res.status(404).json({ message: '用户不存在或不是学生账号' });
    res.json({ message: '已加入我的学生', student: u.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ message: '用户不存在' });
    console.error('Admin teacher add student error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 班主任：从我的班级移除学生 ----------
router.delete('/teacher/students/:id', requireTeacherOrSuper, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: '无效ID' });
    const teacherId = req.adminUser.id;
    const result = await pool.query(
      'DELETE FROM teacher_students WHERE teacher_id = $1 AND student_id = $2 RETURNING id',
      [teacherId, studentId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: '该学生不在你的班级中' });
    res.json({ message: '已移除' });
  } catch (err) {
    console.error('Admin teacher remove student error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 班主任/管理员：查看某学生的出愿计划（仅班主任本人或超级管理员） ----------
router.get('/teacher/students/:id/plans', requireTeacherOrSuper, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: '无效ID' });
    const teacherId = req.adminUser.id;
    const isSuper = ['super_admin', 'admin'].includes(req.adminUser.role || '');
    if (!isSuper) {
      const check = await pool.query('SELECT 1 FROM teacher_students WHERE teacher_id = $1 AND student_id = $2', [teacherId, studentId]);
      if (check.rows.length === 0) return res.status(403).json({ message: '只能查看自己班级学生的出愿' });
    }
    const result = await pool.query(
      'SELECT id, payload, created_at FROM plan_items WHERE user_id = $1 ORDER BY created_at ASC',
      [studentId]
    );
    res.json(result.rows.map((row) => ({ id: row.id, payload: row.payload, created_at: row.created_at })));
  } catch (err) {
    console.error('Admin teacher student plans error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 班主任/管理员：代某学生添加一条出愿计划（学校管理里点「选择学生并加入其计划」） ----------
router.post('/teacher/students/:id/plan', requireTeacherOrSuper, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: '无效学生ID' });
    const { payload } = req.body || {};
    if (!payload || typeof payload !== 'object') return res.status(400).json({ message: '请提供 payload' });
    const teacherId = req.adminUser.id;
    const isSuper = ['super_admin', 'admin'].includes(req.adminUser.role || '');
    if (!isSuper) {
      const check = await pool.query('SELECT 1 FROM teacher_students WHERE teacher_id = $1 AND student_id = $2', [teacherId, studentId]);
      if (check.rows.length === 0) return res.status(403).json({ message: '只能为自己班级学生添加出愿' });
    }
    const result = await pool.query(
      'INSERT INTO plan_items (user_id, payload) VALUES ($1, $2) RETURNING id, payload',
      [studentId, JSON.stringify(payload)]
    );
    const row = result.rows[0];
    res.status(201).json({ id: row.id, payload: row.payload, message: '已加入该学生的出愿计划' });
  } catch (err) {
    console.error('Admin teacher add student plan error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 班主任：给学生发提醒（支持单人或多人：student_id 或 student_ids 数组） ----------
router.post('/teacher/remind', requireTeacherOrSuper, async (req, res) => {
  try {
    const { student_id, student_ids, message, plan_item_id } = req.body || {};
    const msg = String(message || '').trim();
    if (!msg) return res.status(400).json({ message: '请提供提醒内容' });
    let ids = [];
    if (Array.isArray(student_ids) && student_ids.length > 0) {
      ids = student_ids.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
    } else if (student_id != null) {
      const one = parseInt(student_id, 10);
      if (!Number.isNaN(one)) ids = [one];
    }
    if (ids.length === 0) return res.status(400).json({ message: '请选择至少一名学生' });
    const teacherId = req.adminUser.id;
    const isSuper = ['super_admin', 'admin'].includes(req.adminUser.role || '');
    const planId = plan_item_id != null ? parseInt(plan_item_id, 10) : null;
    const inserted = [];
    for (const studentId of ids) {
      if (!isSuper) {
        const check = await pool.query('SELECT 1 FROM teacher_students WHERE teacher_id = $1 AND student_id = $2', [teacherId, studentId]);
        if (check.rows.length === 0) continue;
      }
      const result = await pool.query(
        'INSERT INTO reminders (teacher_id, student_id, message, plan_item_id) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
        [teacherId, studentId, msg, Number.isNaN(planId) ? null : planId]
      );
      inserted.push(result.rows[0]);
    }
    res.status(201).json({ message: '提醒已发送', count: inserted.length, ids: inserted.map((r) => r.id) });
  } catch (err) {
    console.error('Admin teacher remind error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 班主任：某学生的提醒记录 ----------
router.get('/teacher/students/:id/reminders', requireTeacherOrSuper, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (Number.isNaN(studentId)) return res.status(400).json({ message: '无效ID' });
    const teacherId = req.adminUser.id;
    const isSuper = ['super_admin', 'admin'].includes(req.adminUser.role || '');
    if (!isSuper) {
      const check = await pool.query('SELECT 1 FROM teacher_students WHERE teacher_id = $1 AND student_id = $2', [teacherId, studentId]);
      if (check.rows.length === 0) return res.status(403).json({ message: '只能查看自己班级学生的提醒' });
    }
    const result = await pool.query(
      'SELECT r.id, r.message, r.plan_item_id, r.created_at, r.read_at, u.username AS teacher_name FROM reminders r JOIN users u ON u.id = r.teacher_id WHERE r.student_id = $1 ORDER BY r.created_at DESC LIMIT 50',
      [studentId]
    );
    res.json({ list: result.rows });
  } catch (err) {
    console.error('Admin teacher reminders error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 班主任：我发出的提醒列表（含每条的学生与已读状态，用于发送提醒浮层） ----------
router.get('/teacher/reminders/sent', requireTeacherOrSuper, async (req, res) => {
  try {
    const teacherId = req.adminUser.id;
    const result = await pool.query(
      `SELECT r.id, r.message, r.created_at, r.read_at, r.student_id, u.username AS student_name
       FROM reminders r
       JOIN users u ON u.id = r.student_id
       WHERE r.teacher_id = $1
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT 200`,
      [teacherId]
    );
    res.json({ list: result.rows });
  } catch (err) {
    console.error('Admin teacher reminders/sent error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// ---------- 数据概览（容错：某表不存在或缺列时该统计为 0，不整段报错） ----------
async function safeCount(sql, def = 0) {
  try {
    const res = await pool.query(sql);
    return parseInt(res.rows[0]?.c || 0, 10);
  } catch (e) {
    console.error('Dashboard query error:', e.message);
    return def;
  }
}
router.get('/dashboard', async (req, res) => {
  try {
    const [totalUsers, totalSchools, totalPlans, todayUsers, todaySchools] = await Promise.all([
      safeCount('SELECT COUNT(*) AS c FROM users WHERE COALESCE("status", \'active\') != \'deleted\''),
      safeCount('SELECT COUNT(*) AS c FROM schools'),
      safeCount('SELECT COUNT(*) AS c FROM plan_items'),
      safeCount('SELECT COUNT(*) AS c FROM users WHERE created_at >= CURRENT_DATE AND COALESCE("status", \'active\') != \'deleted\''),
      safeCount('SELECT COUNT(*) AS c FROM schools WHERE added_at >= CURRENT_DATE'),
    ]);
    res.json({
      totalUsers,
      totalSchools,
      totalPlans,
      todayUsers,
      todaySchools,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({
      message: '服务器错误',
      error: err.message,
    });
  }
});

// 最近动态（最新用户、最新学校）
router.get('/dashboard/recent', async (req, res) => {
  try {
    let recentUsers = [];
    let recentSchools = [];
    try {
      const usersRes = await pool.query(
        'SELECT id, username, email, created_at FROM users WHERE COALESCE("status", \'active\') != \'deleted\' ORDER BY created_at DESC LIMIT 10'
      );
      recentUsers = usersRes.rows || [];
    } catch (e) {
      console.error('Dashboard recent users error:', e.message);
    }
    try {
      const schoolsRes = await pool.query(
        'SELECT s.id, s.school_name, s.location, s.added_at, u.username AS added_by FROM schools s JOIN users u ON u.id = s.user_id ORDER BY s.added_at DESC LIMIT 20'
      );
      recentSchools = schoolsRes.rows || [];
    } catch (e) {
      console.error('Dashboard recent schools error:', e.message);
    }
    res.json({ recentUsers, recentSchools });
  } catch (err) {
    console.error('Admin dashboard recent error:', err);
    res.status(500).json({
      message: '服务器错误',
      ...(process.env.NODE_ENV !== 'production' && { error: err.message }),
    });
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
    if (['user', 'admin', 'teacher', 'super_admin'].includes(role)) {
      where += ` AND COALESCE(u."role", 'user') = $${n} `;
      params.push(role);
      n++;
    }
    if (statusFilter === 'active' || statusFilter === 'disabled' || statusFilter === 'deleted') {
      where += ` AND COALESCE(u."status", 'active') = $${n} `;
      params.push(statusFilter);
      n++;
    }

    const countRes = await pool.query('SELECT COUNT(*) AS c FROM users u' + where, params);
    const total = parseInt(countRes.rows[0]?.c || 0, 10);

    params.push(limit, offset);
    const listRes = await pool.query(
      `SELECT u.id, u.username, u.email, COALESCE(u."role", 'user') AS role, COALESCE(u."status", 'active') AS status,
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
      'SELECT id, username, email, COALESCE("role", \'user\') AS role, COALESCE("status", \'active\') AS status, created_at, last_login_at, COALESCE(login_count, 0) AS login_count FROM users WHERE id = $1',
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
    const roleVal = role != null ? String(role).trim().toLowerCase() : '';
    if (['user', 'admin', 'teacher', 'super_admin'].includes(roleVal)) {
      updates.push(`"role" = $${n}`);
      params.push(roleVal);
      n++;
    }
    if (status === 'active' || status === 'disabled' || status === 'deleted') {
      updates.push(`"status" = $${n}`);
      params.push(status);
      n++;
    }
    if (updates.length === 0) return res.status(400).json({ message: '没有可更新字段，请至少修改角色或状态' });
    params.push(id);
    const result = await pool.query('UPDATE users SET ' + updates.join(', ') + ' WHERE id = $' + n, params);
    if (result.rowCount === 0) return res.status(404).json({ message: '用户不存在' });
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

// ---------- 合格实绩数据更新（Excel 上传 + Python 脚本处理） ----------
const execAsync = promisify(exec);

router.post('/admission-score-update', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: '请上传 Excel 文件' });
    }

    const excelPath = path.join(projectRoot, '合格实绩.xlsx');
    const jsonPath = path.join(projectRoot, 'data', 'admission_score_model.json');
    const scriptPath = path.join(projectRoot, 'scripts', 'analyze_admission_scores.py');

    // 备份旧文件
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    
    if (fs.existsSync(excelPath)) {
      fs.copyFileSync(excelPath, path.join(backupsDir, `合格实绩_${timestamp}.xlsx`));
    }
    if (fs.existsSync(jsonPath)) {
      fs.copyFileSync(jsonPath, path.join(backupsDir, `admission_score_model_${timestamp}.json`));
    }

    // 保存上传的文件
    fs.writeFileSync(excelPath, req.file.buffer);

    // 运行 Python 脚本
    try {
      const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`, {
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      
      if (stderr && !stderr.includes('已写入') && !stderr.includes('已生成')) {
        console.warn('Python script stderr:', stderr);
      }
      
      // 读取生成的结果文件统计信息
      let bunkaCount = 0;
      let rikaCount = 0;
      if (fs.existsSync(jsonPath)) {
        try {
          const raw = fs.readFileSync(jsonPath, 'utf8');
          const model = JSON.parse(raw);
          bunkaCount = model.bunka ? Object.keys(model.bunka).length : 0;
          rikaCount = model.rika ? Object.keys(model.rika).length : 0;
        } catch (e) {
          console.error('Failed to parse generated JSON:', e);
        }
      }

      writeOperationLog(
        req.adminUser.id,
        req.adminUser.username,
        'admission_score_update',
        'admission_score_model',
        null,
        req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        'success',
        { bunkaCount, rikaCount, backup: `合格实绩_${timestamp}.xlsx` }
      );

      res.json({
        message: '更新成功',
        bunkaCount,
        rikaCount,
        backup: `合格实绩_${timestamp}`,
      });
    } catch (execErr) {
      console.error('Python script execution error:', execErr);
      // 即使脚本失败，也记录操作日志
      writeOperationLog(
        req.adminUser.id,
        req.adminUser.username,
        'admission_score_update',
        'admission_score_model',
        null,
        req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        'error',
        { error: execErr.message }
      );
      res.status(500).json({
        message: '脚本执行失败：' + (execErr.message || '未知错误'),
        stderr: execErr.stderr || '',
      });
    }
  } catch (err) {
    console.error('Admin admission-score-update error:', err);
    res.status(500).json({ message: err.message || '服务器错误' });
  }
});

// 合格实绩模型信息（统计学校数量）
router.get('/admission-score-update/info', async (req, res) => {
  try {
    const jsonPath = path.join(projectRoot, 'data', 'admission_score_model.json');
    let bunkaCount = 0;
    let rikaCount = 0;
    
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const model = JSON.parse(raw);
        bunkaCount = model.bunka ? Object.keys(model.bunka).length : 0;
        rikaCount = model.rika ? Object.keys(model.rika).length : 0;
      } catch (e) {
        console.error('Failed to parse admission_score_model.json:', e);
      }
    }
    
    res.json({ bunkaCount, rikaCount });
  } catch (err) {
    console.error('Admin admission-score-update info error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
