const express = require('express');
const { pool } = require('../db.js');
const { authMiddleware } = require('../middleware/auth.js');

const router = express.Router();
router.use(authMiddleware);

// GET /api/schools - 获取当前用户的学校列表
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, school_name, location, notes, added_at FROM schools WHERE user_id = $1 ORDER BY added_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/schools error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/schools - 添加学校
router.post('/', async (req, res) => {
  try {
    const { school_name, location, notes } = req.body || {};
    if (!school_name || String(school_name).trim() === '') {
      return res.status(400).json({ message: '请填写学校名称' });
    }
    const result = await pool.query(
      'INSERT INTO schools (user_id, school_name, location, notes) VALUES ($1, $2, $3, $4) RETURNING id, school_name, location, notes, added_at',
      [
        req.user.id,
        String(school_name).trim(),
        location ? String(location).trim() : null,
        notes ? String(notes).trim() : null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/schools error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/schools/:id - 删除学校（仅限当前用户）
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: '无效的ID' });
    }
    const result = await pool.query(
      'DELETE FROM schools WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: '学校不存在或无权删除' });
    }
    res.json({ message: '已删除' });
  } catch (err) {
    console.error('DELETE /api/schools error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
