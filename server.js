require('dotenv').config();
const path = require('path');
const fs = require('fs');
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

// 学校总览数据（公开，供 compass 搜索/筛选等使用）
// 优先读英文路径，避免部署环境（如 Render）下中文文件名无法识别
const schoolMasterPath = path.join(__dirname, 'school-master.json');
const schoolMasterPathZh = path.join(__dirname, '学校总览.json');
function ensureSchoolMasterCopy() {
  if (fs.existsSync(schoolMasterPath)) return;
  if (fs.existsSync(schoolMasterPathZh)) {
    try {
      fs.copyFileSync(schoolMasterPathZh, schoolMasterPath);
      console.log('[school-master] 已从 学校总览.json 复制到 school-master.json');
    } catch (e) {
      console.warn('[school-master] 复制失败:', e.message);
    }
  }
}
function getSchoolMasterPath() {
  ensureSchoolMasterCopy();
  if (fs.existsSync(schoolMasterPath)) return schoolMasterPath;
  if (fs.existsSync(schoolMasterPathZh)) return schoolMasterPathZh;
  console.warn('[school-master] 未找到数据文件：请确保存在 school-master.json 或 学校总览.json（可运行 python3 export_school_data.py 生成）');
  return null;
}
app.get('/api/school-master', (req, res) => {
  console.log('[school-master] GET /api/school-master 被请求');
  const p = getSchoolMasterPath();
  if (!p) {
    return res.status(404).json({ message: '学校总览数据未就绪' });
  }
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    const count = (data && data.data && data.data.length) || 0;
    console.log('[school-master] 返回', count, '条');
    res.json(data);
  } catch (err) {
    console.error('school-master read error:', err);
    res.status(500).json({ message: '读取失败' });
  }
});

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
  const p = getSchoolMasterPath();
  if (p) console.log('[school-master] 搜索数据已就绪:', path.basename(p));
  else console.warn('[school-master] 搜索数据未就绪，/api/school-master 将返回 404');
});
