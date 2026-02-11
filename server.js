require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

if (!process.env.DATABASE_URL) {
  console.warn('\n[警告] 未设置 DATABASE_URL。请复制 .env.example 为 .env 并填写 PostgreSQL 连接串，然后运行: node scripts/init-db.js\n');
}

const authRoutes = require('./routes/auth.js');
const schoolsRoutes = require('./routes/schools.js');
const planRoutes = require('./routes/plan.js');
const adminRoutes = require('./routes/admin.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 静态文件（HTML/CSS/JS）
app.use(express.static(path.join(__dirname)));

// API
app.use('/api', authRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/admin', adminRoutes);

// SPA 入口：根路径和 /index.html 返回 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
