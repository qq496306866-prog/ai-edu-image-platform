# AI 教辅批量生图平台

## 产品定位

这是一个面向教辅工作室、培训机构、电商商家的 AI 批量生图 SaaS。

用户上传 Excel，系统读取标题、提示词、参考图字段，批量生成图片，并支持在线预览和 ZIP 下载。

## 第一阶段目标 MVP

只做以下功能：

1. 用户注册登录
2. 上传 Excel
3. 解析 Excel 中的商品标题、提示词、参考图字段
4. 创建批量生图任务
5. 后台 Worker 批量生成图片
6. 任务进度展示
7. 图片预览
8. ZIP 打包下载
9. 基础点数系统

## 第一阶段不做

暂时不做：

- 支付系统
- 卡密系统
- 代理系统
- Word/PPT/PDF 转图片
- 模板市场
- 企业私有部署
- 电商平台分发
- 复杂管理员后台

## 技术栈

- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- Queue: Redis + Celery
- Excel: openpyxl
- Image processing: Pillow
- Deployment: Docker Compose

## 核心流程

1. 用户注册/登录
2. 用户上传 Excel
3. 后端解析 Excel
4. 创建 generation_job
5. 创建 generation_items
6. 用户点击开始生成
7. 后端提交 Celery 任务
8. Worker 批量处理 items
9. 保存生成图片
10. 前端轮询任务状态
11. 用户预览图片
12. 用户下载 ZIP

## 数据库表

### users

- id
- email
- password_hash
- role
- created_at

### generation_jobs

- id
- user_id
- status
- total_count
- success_count
- failed_count
- source_excel_path
- created_at
- updated_at

### generation_items

- id
- job_id
- title
- prompt
- reference_image_path
- status
- result_image_path
- error_message
- created_at
- updated_at

### user_credits

- user_id
- balance
- updated_at

### credit_transactions

- id
- user_id
- job_id
- item_id
- amount
- type
- description
- created_at

## 状态枚举

generation_jobs.status:

- pending
- running
- completed
- failed
- cancelled

generation_items.status:

- pending
- generating
- completed
- failed
- cancelled

## Excel 字段识别规则

标题字段可识别：

- 商品标题
- 标题
- title
- name

提示词字段可识别：

- 提示词
- prompt

参考图字段可识别：

- 参考图片路径
- 参考图
- image_path
- reference_image

## 生图 Provider

必须实现 Provider 抽象层。

第一阶段先实现 MockImageGenerationProvider：

- 不调用真实 AI API
- 使用 Pillow 生成占位图
- 图片上写入 title 和 prompt 摘要
- 保存到 storage/generated/{job_id}/{item_id}.jpg

之后再实现 RealImageGenerationProvider。

Provider 通过环境变量切换：

- IMAGE_PROVIDER=mock
- IMAGE_PROVIDER=real

## 安全要求

- 不允许硬编码 API key
- 所有密钥从环境变量读取
- 上传文件限制大小
- 上传文件限制类型
- 文件路径必须按用户和任务隔离
- ZIP 文件名需要清理非法字符
- Worker 单条失败不能导致整个任务失败
- 每个 item 都必须记录独立状态和错误信息

## 第一阶段验收标准

运行：

docker compose up --build

应能完成以下流程：

1. 打开 frontend: http://localhost:3000
2. 打开 backend: http://localhost:8000/health
3. 注册用户
4. 登录用户
5. 上传 xlsx
6. 后端成功解析 Excel
7. 创建任务
8. 点击开始生成
9. Worker 使用 mock provider 生成图片
10. 前端显示任务进度
11. 前端显示图片结果
12. 用户可以下载 ZIP
