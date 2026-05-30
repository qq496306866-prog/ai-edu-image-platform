"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  GenerationItem,
  GenerationJob,
  authenticatedApiRequest,
  getAccessToken,
} from "../../lib/api";

type JobDetailPageProps = {
  params: {
    id: string;
  };
};

export default function JobDetailPage({ params }: JobDetailPageProps) {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [items, setItems] = useState<GenerationItem[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      window.location.href = "/login";
      return;
    }

    loadJob();
  }, []);

  async function loadJob() {
    setError("");
    setIsLoading(true);
    try {
      const [jobResponse, itemsResponse] = await Promise.all([
        authenticatedApiRequest<GenerationJob>(`/api/jobs/${params.id}`),
        authenticatedApiRequest<GenerationItem[]>(`/api/jobs/${params.id}/items`),
      ]);
      setJob(jobResponse);
      setItems(itemsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载任务详情");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Job Detail</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">任务详情</h1>
          </div>
          <div className="flex gap-3">
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
              onClick={loadJob}
              type="button"
            >
              刷新
            </button>
            <Link
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
              href="/dashboard"
            >
              返回控制台
            </Link>
          </div>
        </div>

        {isLoading ? <p className="mt-8 text-slate-600">正在加载任务详情...</p> : null}
        {error ? <p className="mt-8 text-sm text-red-600">{error}</p> : null}

        {job ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <dl className="grid gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-sm text-slate-500">任务 ID</dt>
                <dd className="mt-1 font-semibold text-slate-950">#{job.id}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">状态</dt>
                <dd className="mt-1 font-semibold text-slate-950">{job.status}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">总数</dt>
                <dd className="mt-1 font-semibold text-slate-950">{job.total_count}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">创建时间</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {new Date(job.created_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">任务条目</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 font-medium">ID</th>
                    <th className="py-3 pr-4 font-medium">状态</th>
                    <th className="py-3 pr-4 font-medium">标题</th>
                    <th className="py-3 pr-4 font-medium">提示词</th>
                    <th className="py-3 pr-4 font-medium">参考图</th>
                    <th className="py-3 pr-4 font-medium">错误</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr className="border-b border-slate-100" key={item.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-950">#{item.id}</td>
                      <td className="py-3 pr-4 text-slate-700">{item.status}</td>
                      <td className="py-3 pr-4 font-medium text-slate-950">{item.title}</td>
                      <td className="max-w-lg py-3 pr-4 text-slate-700">{item.prompt}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.reference_image_path ?? "-"}</td>
                      <td className="py-3 pr-4 text-red-600">{item.error_message ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
