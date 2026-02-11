# 本地运行与注册/登录测试说明

## 为什么注册/登录会失败？

常见原因：

1. **没有通过 Node 服务器访问页面**  
   若直接双击打开 `register.html` 或 `login.html`（`file://` 协议），浏览器无法把请求发到你的后端，会报“无法连接服务器”或“登录失败”。  
   **正确做法**：先启动本机服务器，再用浏览器打开 `http://localhost:3000/register.html` 和 `http://localhost:3000/login.html`。

2. **没有配置数据库**  
   注册和登录依赖 PostgreSQL。若未设置 `DATABASE_URL` 或未建表，接口会报错（如 500 或连接失败）。  
   **正确做法**：按下面步骤配置 `.env` 并执行一次 `init-db`。

---

## 本地测试步骤

### 1. 安装依赖

```bash
cd /Users/jessiecat/Documents/projects/ichikawaryuugaku
npm install
```

### 2. 准备 PostgreSQL 数据库

- **方式 A：本机已安装 PostgreSQL**  
  创建数据库（例如名称为 `ichikawaryuugaku`），记下连接信息。

- **方式 B：使用云数据库**  
  使用 Render / Supabase / Neon 等提供的 PostgreSQL，复制其连接 URL。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少填写：

```env
# 必填：PostgreSQL 连接串（本地示例）
DATABASE_URL=postgres://用户名:密码@localhost:5432/数据库名

# 可选，用于 JWT 签名（不填会使用默认值，仅开发可接受）
JWT_SECRET=your-secret-change-in-production

# 可选
PORT=3000
```

### 4. 初始化数据库表

只需执行一次（若之前已执行过，代码新增了「出愿计划」表时可再执行一次，不会覆盖已有数据）：

```bash
node scripts/init-db.js
```

成功会输出：`Database tables initialized.`

### 5. 启动服务

```bash
npm start
```

终端应显示：`Server running on port 3000`（或你设置的 PORT）。

### 6. 在浏览器中测试

- 打开：**http://localhost:3000/register.html**  
  填写用户名（3 字以上）、邮箱、密码（6 字以上）并确认密码，点击注册。  
  成功后会提示“登録が完了しました”，并跳转到登录页。

- 再打开：**http://localhost:3000/login.html**  
  用刚注册的用户名和密码登录，成功后会跳转到首页。

**注意**：不要用 `file://` 直接打开 HTML；一定要通过 `http://localhost:3000/...` 访问。

---

## 文件与接口对应关系（便于排查）

| 页面/功能     | 调用的接口      | 后端文件           |
|--------------|-----------------|--------------------|
| 注册         | POST /api/register | routes/auth.js   |
| 登录         | POST /api/login    | routes/auth.js   |
| 首页学校列表 | GET /api/schools   | routes/schools.js |
| 添加学校     | POST /api/schools  | routes/schools.js |
| 删除学校     | DELETE /api/schools/:id | routes/schools.js |

- 前端统一通过 `js/auth.js` 的 `Auth.getApiBase()` 得到 API 根地址（本地用 `http://localhost:3000`，部署到 Render 时同源则为空）。
- 后端入口：`server.js`；数据库连接：`db.js`（依赖 `DATABASE_URL`）。

---

## 部署到 Render 后

在 Render 上为服务设置环境变量：

- `DATABASE_URL`：Render 提供的 PostgreSQL 或你购买的数据库连接串。
- `JWT_SECRET`：生产环境请设成随机长字符串。

这样用户注册/登录与学校数据会持久化在数据库中，不会因刷新或关闭页面而丢失。
