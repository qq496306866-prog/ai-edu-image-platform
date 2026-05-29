const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Project Skeleton
          </p>
          <h1 className="mt-4 text-4xl font-bold text-slate-950 sm:text-5xl">
            AI 教辅批量生图平台
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-700">
            第一版 monorepo 骨架已包含 Next.js 前端、FastAPI 后端、PostgreSQL、Redis、Celery worker 和 Docker Compose。
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <a
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-500"
            href={`${apiUrl}/health`}
          >
            <span className="text-sm font-medium text-slate-500">Backend</span>
            <strong className="mt-2 block text-xl text-slate-950">GET /health</strong>
            <span className="mt-3 block text-sm text-slate-600">{apiUrl}/health</span>
          </a>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-sm font-medium text-slate-500">Next Step</span>
            <strong className="mt-2 block text-xl text-slate-950">Phase 2 Auth</strong>
            <span className="mt-3 block text-sm text-slate-600">
              业务功能将在后续阶段逐步实现。
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
