# 管理员后台 - 首次设置步骤

按下面顺序做一次即可。

---

## 步骤 1：执行数据库迁移

在项目根目录打开终端，执行：

```bash
npm run migrate-admin
```

看到输出 `Admin migration completed.` 即表示成功。  
（若你从未跑过 `init-db`，请先执行 `npm run init-db`，再执行 `npm run migrate-admin`。）

---

## 步骤 2：指定管理员账号

**方式 A：用脚本（推荐）**

先确保要当管理员的账号已经在前台注册过（用 `register.html` 或现有注册方式），记下**用户名**，然后在终端执行：

```bash
node scripts/set-admin.js 你的用户名
```

例如用户名为 `admin` 则执行：

```bash
node scripts/set-admin.js admin
```

看到 `已设置为管理员: admin (id: 1)` 即表示成功。

**方式 B：自己写 SQL**

若你习惯用数据库客户端（如 pgAdmin、DBeaver、psql），在连接项目使用的 PostgreSQL 后执行：

```sql
UPDATE users SET role = 'admin', status = 'active' WHERE username = '你的用户名';
```

把 `你的用户名` 换成已注册的用户名。

---

## 步骤 3：启动服务并打开后台

1. 启动服务：
   ```bash
   npm start
   ```
2. 在浏览器打开（本地）：
   ```
   http://localhost:3000/admin/login.html
   ```
   若已部署到 Render 等，则打开：`https://你的域名/admin/login.html`
3. 用**步骤 2 里设为管理员的那个账号**登录（用户名 + 密码），即可进入后台。

---

## 小结

| 顺序 | 做什么           | 命令或位置 |
|------|------------------|------------|
| 1    | 数据库迁移       | `npm run migrate-admin` |
| 2    | 指定管理员       | `node scripts/set-admin.js 你的用户名` |
| 3    | 启动并登录后台   | `npm start` → 打开 `/admin/login.html` 用该账号登录 |

之后无需重复步骤 1 和 2，只需 `npm start` 并从 `/admin/login.html` 登录即可。
