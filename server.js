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

// API（先于静态，避免被误当文件）
app.use('/api', authRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/admin', adminRoutes);

// 首页：优先显式返回，避免部署后 404
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 静态文件（HTML/CSS/JS 等）
app.use(express.static(path.join(__dirname)));

// 未匹配到的路径（如前端路由）统一返回 index.html，避免出现 not found
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
