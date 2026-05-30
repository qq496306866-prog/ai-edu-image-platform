# AI Edu Image Platform

AI 教辅批量生图平台第一版 MVP。

当前版本支持：

- 用户注册、登录和 JWT 鉴权
- Excel 上传和字段解析
- 批量生图任务创建和任务详情
- Celery worker 使用 Mock provider 生成占位图片
- 结果图片在线预览
- 生成图片 ZIP 下载
- 基础点数系统：新用户 20 点，每张图消耗 1 点，失败自动返还
- 可通过 `IMAGE_PROVIDER=real` 切换到真实生图 API
- 支持取消 pending/running 任务，并返还未开始生成条目的点数

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL
- Queue: Redis, Celery
- Excel: openpyxl
- Image processing: Pillow
- Deployment: Docker Compose

## Project Structure

```text
.
|-- backend/
|   |-- app/
|   |   |-- core/
|   |   |-- db/
|   |   |-- providers/
|   |   |-- routers/
|   |   |-- services/
|   |   |-- main.py
|   |   `-- worker.py
|   |-- Dockerfile
|   `-- requirements.txt
|-- frontend/
|   |-- app/
|   |-- Dockerfile
|   `-- package.json
|-- storage/
|-- docker-compose.yml
`-- .env.example
```

## Quick Start

Copy the sample environment file if you want to customize values:

```bash
cp .env.example .env
```

Start all services:

```bash
docker compose -p ai_edu_image_platform up --build
```

The explicit project name keeps Docker Compose stable even when the local folder name contains non-ASCII characters.

Visit:

- Frontend: http://localhost:3000
- Backend health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

## Basic Flow

1. Open http://localhost:3000.
2. Register or log in.
3. Go to the dashboard and upload `sample_upload.xlsx`.
4. Open the created job.
5. Click `开始生成`.
6. The system deducts 1 credit for each pending image.
7. Refresh until the job is completed.
8. Click a result thumbnail to preview the image.
9. Click `下载 ZIP` to download generated images.

Generated images are stored under:

```text
storage/generated/{job_id}/{item_id}.jpg
```

## Image Provider

The default provider is mock and does not call any external API:

```env
IMAGE_PROVIDER=mock
```

To use a real OpenAI-compatible image generation endpoint, configure:

```env
IMAGE_PROVIDER=real
IMAGE_API_BASE_URL=https://your-image-api.example.com/v1
IMAGE_API_KEY=your-api-key
IMAGE_MODEL=your-image-model
IMAGE_API_TIMEOUT_SECONDS=60
IMAGE_API_RETRY_COUNT=2
```

The real provider posts to `{IMAGE_API_BASE_URL}/images/generations` and accepts responses containing either `data[0].b64_json` or `data[0].url`.

For cancellation testing with the mock provider, slow each mock image down:

```env
MOCK_IMAGE_DELAY_SECONDS=3
```

## Basic Checks

After startup, verify the backend can reach PostgreSQL and Redis:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok"
}
```
