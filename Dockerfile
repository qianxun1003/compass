# 日本留学申请综合管理平台 - 生产镜像
FROM node:20-alpine

WORKDIR /app

# 依赖
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# 应用代码与静态资源（含 学校总览.json / school-master.json）
COPY . .

# 若存在中文文件名，启动时会从 学校总览.json 复制到 school-master.json
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
