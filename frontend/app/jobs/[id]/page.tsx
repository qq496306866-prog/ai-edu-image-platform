"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  GenerationItem,
  GenerationJob,
  apiUrl,
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [retryingItemIds, setRetryingItemIds] = useState<number[]>([]);

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

  async function startJob() {
    setError("");
    setIsStarting(true);
    try {
      await authenticatedApiRequest<GenerationJob>(`/api/jobs/${params.id}/start`, {
        method: "POST",
      });
      await loadJob();
      window.setTimeout(loadJob, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法开始生成");
    } finally {
      setIsStarting(false);
    }
  }

  async function cancelJob() {
    setError("");
    setIsCancelling(true);
    try {
      await authenticatedApiRequest<GenerationJob>(`/api/jobs/${params.id}/cancel`, {
        method: "POST",
      });
      await loadJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法取消任务");
    } finally {
      setIsCancelling(false);
    }
  }

  async function downloadZip() {
    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setError("");
    setIsDownloading(true);
    try {
      const response = await fetch(`${apiUrl}/api/jobs/${params.id}/download-zip`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail ?? "下载失败");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `job-${params.id}-images.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "下载失败");
    } finally {
      setIsDownloading(false);
    }
  }

  async function retryItem(itemId: number) {
    setError("");
    setRetryingItemIds((currentIds) => [...currentIds, itemId]);
    try {
      await authenticatedApiRequest<GenerationItem>(`/api/jobs/${params.id}/items/${itemId}/retry`, {
        method: "POST",
      });
      await loadJob();
      window.setTimeout(loadJob, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法重新生成条目");
    } finally {
      setRetryingItemIds((currentIds) => currentIds.filter((currentId) => currentId !== itemId));
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
          <div className="flex flex-wrap gap-3">
            {job && ["pending", "failed"].includes(job.status) ? (
              <button
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isStarting}
                onClick={startJob}
                type="button"
              >
                {isStarting ? "提交中..." : "开始生成"}
              </button>
            ) : null}
            {job && ["pending", "running"].includes(job.status) ? (
              <button
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-500 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={isCancelling}
                onClick={cancelJob}
                type="button"
              >
                {isCancelling ? "取消中..." : "取消任务"}
              </button>
            ) : null}
            {job && job.success_count > 0 ? (
              <button
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isDownloading}
                onClick={downloadZip}
                type="button"
              >
                {isDownloading ? "下载中..." : "下载 ZIP"}
              </button>
            ) : null}
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
            <dl className="grid gap-4 sm:grid-cols-5">
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
                <dt className="text-sm text-slate-500">成功/失败</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {job.success_count} / {job.failed_count}
                </dd>
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
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 font-medium">ID</th>
                    <th className="py-3 pr-4 font-medium">状态</th>
                    <th className="py-3 pr-4 font-medium">标题</th>
                    <th className="py-3 pr-4 font-medium">提示词</th>
                    <th className="py-3 pr-4 font-medium">参考图</th>
                    <th className="py-3 pr-4 font-medium">结果图</th>
                    <th className="py-3 pr-4 font-medium">错误</th>
                    <th className="py-3 pr-4 font-medium">操作</th>
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
                      <td className="py-3 pr-4 text-slate-600">
                        {item.result_image_url ? (
                          <button
                            className="block overflow-hidden rounded-md border border-slate-200"
                            onClick={() => setPreviewUrl(`${apiUrl}${item.result_image_url}`)}
                            type="button"
                          >
                            <img
                              alt={item.title}
                              className="h-20 w-28 object-cover"
                              src={`${apiUrl}${item.result_image_url}`}
                            />
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 pr-4 text-red-600">{item.error_message ?? "-"}</td>
                      <td className="py-3 pr-4">
                        {["failed", "cancelled", "completed"].includes(item.status) ? (
                          <button
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600 disabled:cursor-not-allowed disabled:text-slate-400"
                            disabled={retryingItemIds.includes(item.id) || job?.status === "running"}
                            onClick={() => retryItem(item.id)}
                            type="button"
                          >
                            {retryingItemIds.includes(item.id) ? "提交中..." : "重新生成"}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {previewUrl ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <div className="max-h-[90vh] max-w-5xl overflow-hidden rounded-lg bg-white p-3 shadow-xl">
              <img alt="生成图片预览" className="max-h-[82vh] w-full object-contain" src={previewUrl} />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
