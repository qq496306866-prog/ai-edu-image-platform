import Link from "next/link";

import { apiUrl } from "./lib/api";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">MVP Auth Ready</p>
          <h1 className="mt-4 text-4xl font-bold text-slate-950 sm:text-5xl">
            AI 教辅批量生图平台
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-700">
            当前版本已包含项目骨架、后端健康检查和基础账号体系，可以注册、登录并进入 dashboard。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
              href="/register"
            >
              注册账号
            </Link>
            <Link
              className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
              href="/login"
            >
              登录
            </Link>
          </div>
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
            <span className="text-sm font-medium text-slate-500">Auth</span>
            <strong className="mt-2 block text-xl text-slate-950">JWT 登录态</strong>
            <span className="mt-3 block text-sm text-slate-600">
              注册和登录接口已经接入 FastAPI。
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
