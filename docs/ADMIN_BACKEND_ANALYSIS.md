# 管理员后台系统 - 现有结构分析与适配方案

## 一、现有代码结构与运行逻辑

### 1.1 技术栈

- **后端**: Node.js + Express，PostgreSQL（`db.js` + `pool`）
- **认证**: JWT（`middleware/auth.js`），密钥 `JWT_SECRET`，7 天有效期
- **前端**: 静态 HTML + Tailwind，`js/auth.js` 统一管理 token/user、`requireAuth()`、`authHeaders()`
- **入口**: `server.js` 挂载 `/api`（auth）、`/api/schools`、`/api/plan`，静态资源根目录为项目根

### 1.2 数据库现状（`scripts/init-db.js`）

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| **users** | 用户账号 | id, username, email, password, created_at（无角色、无状态） |
| **schools** | 用户「自己添加」的学校列表 | user_id, school_name, location, notes, added_at |
| **plan_items** | 用户出愿计划（筛选/成绩加入的学部） | user_id, payload (JSONB), created_at |

- 普通用户只能访问自己的 `schools` 和 `plan_items`（通过 `req.user.id` 过滤）。
- **没有**「管理员」角色，**没有**「账号状态」（正常/停用）。

### 1.3 两类「学校」数据（重要区分）

| 类型 | 存储位置 | 用途 | 谁维护 |
|------|----------|------|--------|
| **学校总览（主库）** | 静态文件 `学校总览.json` / `学校总览.csv` | 筛选、搜索、出愿时间轴、申请表单等 | 目前：本地用 `export_school_data.py` 从 `学部学校一览表.xlsx` 导出 |
| **用户添加的学校** | 表 `schools` | 每个用户自己的「我的学校」列表 | 用户在前端添加/删除 |

- 前端通过 `fetch('学校总览.json')` / `fetch('学校总览.csv')` 直接读静态文件，**未经过后端 API**。
- 需求中的「数据库更新」指的是更新**学校总览**（年度招生数据），不是 `schools` 表。

### 1.4 现有 API 与权限

- **POST /api/register**、**POST /api/login**：无角色校验，任意注册用户都可登录。
- **GET/POST/DELETE /api/schools**：需登录，仅操作当前用户的学校。
- **GET/POST/DELETE /api/plan**：需登录，仅操作当前用户的 plan_items。
- 无「管理员专用」路由，无操作日志表。

### 1.5 前端页面与入口

- 入口：`index.html`（首页）、`login.html`、`register.html`
- 业务页：`compass_index.html`、`compass_filter.html`、`compass_search.html`、`compass_score.html`、`compass_application.html`、`compass_analytics.html`、`onboarding.html`
- 需要登录的页面通过 `Auth.requireAuth()` 检查，未登录跳转 `login.html`。

---

## 二、与需求文档的对应关系

- **用户角色**：需在 `users` 增加 `role`（如 `user` / `admin`）和 `status`（如 `active` / `disabled` / `deleted`）。
- **管理员登录**：独立入口（如 `admin/login.html`），独立接口（如 `POST /api/admin/login`），只允许 `role=admin` 且 `status=active` 的账号。
- **数据概览 / 用户管理 / 学校管理**：需新增管理员专用 API（统计、用户列表/编辑/停用、全部学校列表/删除等）。
- **数据库更新**：核心是「学校总览」的更新方式：  
  - 保持前端仍通过静态文件访问（最小改动）：管理员上传 Excel → 后端解析 → 写回 `学校总览.json` + `学校总览.csv`，并做版本备份。  
  - 可选后续：将学校总览迁入 PostgreSQL 并增加版本表，前端改为请求 API（需改所有 fetch 学校总览的页面）。
- **操作日志**：可新增 `operation_logs` 表，在关键操作（登录、改用户、改学校、更新总览）时写入。

---

## 三、推荐的后台架构（适配现有结构）

### 3.1 原则

- 与现有「普通用户」流程隔离：管理员用独立登录页 + 独立 token 校验（或同一 JWT 带 `role` 声明）。
- 学校总览仍以静态文件为主，管理员后台只负责「更新这些文件」+ 备份与可选版本记录。
- 后台前端与现有业务页风格可统一（如继续用 Tailwind + 粉蓝玻璃风），但布局独立（左侧菜单 + 顶栏 + 内容区）。

### 3.2 目录与路由规划

```
项目根/
├── admin/                      # 后台前端（仅管理员可访问）
│   ├── login.html              # 管理员登录页
│   ├── index.html              # 后台主框架（左侧菜单 + 内容区，默认数据概览）
│   └── js/
│       └── admin-auth.js       # 后台 token 存储、requireAdmin、authHeaders(admin)
├── routes/
│   ├── auth.js                 # 保持不变（普通用户注册/登录）
│   ├── admin.js                # 管理员路由（挂载在 /api/admin）
│   │   # 登录、数据概览、用户管理、学校管理、数据更新、操作日志等
│   └── ...
├── middleware/
│   ├── auth.js                 # 现有 authMiddleware
│   └── adminAuth.js            # requireAdmin：校验 JWT 且 role=admin、status=active
├── scripts/
│   ├── init-db.js              # 扩展：users 增加 role/status/...，可选 operation_logs
│   └── ...
└── uploads/                    # 可选：Excel 临时目录，或仅内存处理
```

- **管理员 API 前缀**：`/api/admin/*`，全部用 `requireAdmin`。
- **后台入口**：仅两个 HTML 需在服务端做「未授权重定向」或由前端 `admin-auth.js` 在未登录时跳转 `admin/login.html`；后端不暴露「后台首页」给未带 admin token 的请求即可。

### 3.3 数据库扩展建议

**users 表增加：**

- `role`：`'user' | 'admin'`，默认 `'user'`
- `status`：`'active' | 'disabled' | 'deleted'`，默认 `'active'`
- `last_login_at`、`login_count`：便于统计与展示
- （可选）`locked_until`、`login_fail_count`：用于登录失败锁定

**可选表：**

- `operation_logs`：时间、操作者、类型、目标、IP、结果、详情（JSON 或文本），便于「操作日志」页与安全审计。

**学校总览：**

- 方案 A（推荐先做）：仍为静态文件；更新时由后端覆写 `学校总览.json` / `学校总览.csv`，并在 `backups/` 或带时间戳的文件名留备份。
- 方案 B（后续）：建表 `school_master` 或 `school_master_versions`，前端改为通过 API 拉取；Excel 上传写入 DB 并可按版本回退。

### 3.4 管理员登录与鉴权流程

1. 管理员打开 `admin/login.html`，输入账号密码。
2. 前端请求 `POST /api/admin/login`（与 `/api/login` 分离），后端：
   - 校验用户名密码；
   - 查 `users` 的 `role` 和 `status`；
   - 仅当 `role = 'admin'` 且 `status = 'active'` 时签发 JWT（payload 中可带 `role: 'admin'`），并更新 `last_login_at`、`login_count`。
3. 后台所有页面加载时用 `admin-auth.js` 的 `requireAdmin()`：无 token 或 token 无效 → 跳转 `admin/login.html`；有 token 但非 admin → 可 403 或跳转普通首页。
4. 所有 `/api/admin/*` 请求在 `requireAdmin` 中校验 JWT 并检查 `role === 'admin'` 和 `status === 'active'`。

### 3.5 「数据库更新」与现有脚本的配合

- 现有：`学部学校一览表.xlsx` → `export_school_data.py` → `学校总览.json` + `学校总览.csv`。
- 后台「数据库更新」可：
  - **方式一（推荐）**：管理员上传 Excel（与现有表结构一致或兼容），后端用 Node（如 `xlsx`）解析，按 `export_school_data.py` 的列映射生成 `{ data: [...] }` 和 CSV，写回项目根下 `学校总览.json`、`学校总览.csv`，并复制一份到 `backups/学校总览_YYYYMMDD_HHmmss.json`（及同名 .csv）。
  - 提供「下载 Excel 模板」链接（或静态模板文件），模板列名与 `export_school_data.py` 的 `COLUMN_MAP` 一致。
- 这样前端无需改任何 `fetch('学校总览.json')` 的调用，仅后台多一个「上传 → 解析 → 写文件 + 备份」的流程。

### 3.6 实施优先级（与需求文档阶段对应）

- **第一阶段**  
  - 管理员登录（独立入口 + `/api/admin/login` + `requireAdmin`）  
  - 数据概览（总用户数、总学校数、总 plan 数、今日新增等，来自现有表）  
  - 用户管理：列表（分页/搜索）、查看详情、编辑、停用/激活  
  - 学校管理：全部用户的 schools 列表、按用户筛选、删除（可选软删或真删）  
  - 数据库更新：Excel 上传 → 解析 → 写 `学校总览.json` + `学校总览.csv` + 备份  

- **第二阶段**  
  - 操作日志表 + 关键操作写日志，操作日志页面  
  - 简单图表（注册趋势、学校添加趋势等）  
  - 数据版本列表（基于备份文件或 DB 版本表）、回退  

- **第三阶段**  
  - 统计分析、系统设置、通知等  

---

## 四、首次设置管理员

1. **已有数据库**：运行 `node scripts/migrate-admin.js` 为 `users` 表增加 `role`、`status`、`last_login_at`、`login_count` 等字段。
2. **指定管理员**：在 PostgreSQL 中执行  
   `UPDATE users SET role = 'admin' WHERE username = '你的用户名';`  
   或将某用户 ID 设为 admin：`UPDATE users SET role = 'admin' WHERE id = 1;`
3. **新项目**：先 `node scripts/init-db.js`（已包含上述字段），再执行上面的 UPDATE 指定一个管理员账号。
4. **后台入口**：打开 `http://localhost:3000/admin/login.html`（或部署后的 `/admin/login.html`），使用管理员账号登录后进入 `admin/index.html`。

---

## 五、小结

- 当前系统是「单角色用户 + 每人自己的 schools/plan + 静态学校总览」；管理员后台需要**角色与状态字段**、**独立登录与鉴权**、**只读/管理全部用户与 schools**，以及**更新静态学校总览文件**的能力。
- 推荐先在不改动前端学校总览使用方式的前提下，通过「管理员上传 Excel → 后端写回 JSON/CSV + 备份」完成「数据库更新」；后续再考虑学校总览进 DB 与版本管理。
- 以上方案与现有 `server.js`、`routes`、`middleware`、静态资源结构兼容，只需扩展 DB、新增 `routes/admin.js` 与 `middleware/adminAuth.js`、以及 `admin/*` 前端即可。
