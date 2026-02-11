const express = require('express');
const { pool } = require('../db.js');
const { authMiddleware } = require('../middleware/auth.js');

const router = express.Router();
router.use(authMiddleware);

// GET /api/plan - 获取当前用户的出愿计划列表
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, payload FROM plan_items WHERE user_id = $1 ORDER BY created_at ASC',
      [req.user.id]
    );
    res.json(result.rows.map((row) => ({ id: row.id, payload: row.payload })));
  } catch (err) {
    console.error('GET /api/plan error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// POST /api/plan - 添加一条出愿计划（一个学部）
router.post('/', async (req, res) => {
  try {
    const { payload } = req.body || {};
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ message: '请提供 payload' });
    }
    const result = await pool.query(
      'INSERT INTO plan_items (user_id, payload) VALUES ($1, $2) RETURNING id, payload',
      [req.user.id, JSON.stringify(payload)]
    );
    const row = result.rows[0];
    res.status(201).json({ id: row.id, payload: row.payload });
  } catch (err) {
    console.error('POST /api/plan error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE /api/plan/:id - 从出愿计划中删除一条（仅限当前用户）
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: '无效的ID' });
    }
    const result = await pool.query(
      'DELETE FROM plan_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: '计划项不存在或无权删除' });
    }
    res.json({ message: '已删除' });
  } catch (err) {
    console.error('DELETE /api/plan error:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
