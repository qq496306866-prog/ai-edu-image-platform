"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ApiUser,
  GenerationJob,
  apiUrl,
  authenticatedApiRequest,
} from "../lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [error, setError] = useState("");
  const [jobsError, setJobsError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJobsLoading, setIsJobsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch(`${apiUrl}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("登录已失效，请重新登录");
        }
        return response.json() as Promise<ApiUser>;
      })
      .then(setUser)
      .catch((err) => setError(err instanceof Error ? err.message : "无法加载用户信息"))
      .finally(() => setIsLoading(false));

    loadJobs();
  }, []);

  async function loadJobs() {
    setJobsError("");
    setIsJobsLoading(true);
    try {
      setJobs(await authenticatedApiRequest<GenerationJob[]>("/api/jobs"));
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : "无法加载任务列表");
    } finally {
      setIsJobsLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">控制台</h1>
          </div>
          <button
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
            onClick={logout}
            type="button"
          >
            退出登录
          </button>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {isLoading ? <p className="text-slate-600">正在加载账号信息...</p> : null}
          {error ? (
            <div>
              <p className="text-red-600">{error}</p>
              <Link className="mt-4 inline-block font-semibold text-emerald-700" href="/login">
                重新登录
              </Link>
            </div>
          ) : null}
          {user ? (
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-slate-500">邮箱</dt>
                <dd className="mt-1 font-semibold text-slate-950">{user.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">角色</dt>
                <dd className="mt-1 font-semibold text-slate-950">{user.role}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">注册时间</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {new Date(user.created_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Excel 上传</h2>
          <p className="mt-2 text-sm text-slate-600">
            上传包含标题和提示词字段的 .xlsx 文件，系统会创建批量生图任务并返回前 10 行预览。
          </p>
          <Link
            className="mt-5 inline-block rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            href="/upload"
          >
            上传 Excel
          </Link>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">任务中心</h2>
              <p className="mt-2 text-sm text-slate-600">查看 Excel 上传后创建的批量生图任务。</p>
            </div>
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
              onClick={loadJobs}
              type="button"
            >
              刷新
            </button>
          </div>

          {isJobsLoading ? <p className="mt-5 text-slate-600">正在加载任务...</p> : null}
          {jobsError ? <p className="mt-5 text-sm text-red-600">{jobsError}</p> : null}
          {!isJobsLoading && !jobsError && jobs.length === 0 ? (
            <p className="mt-5 text-sm text-slate-600">暂无任务，先上传一个 Excel。</p>
          ) : null}

          {jobs.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 font-medium">ID</th>
                    <th className="py-3 pr-4 font-medium">状态</th>
                    <th className="py-3 pr-4 font-medium">数量</th>
                    <th className="py-3 pr-4 font-medium">创建时间</th>
                    <th className="py-3 pr-4 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr className="border-b border-slate-100" key={job.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-950">#{job.id}</td>
                      <td className="py-3 pr-4 text-slate-700">{job.status}</td>
                      <td className="py-3 pr-4 text-slate-700">{job.total_count}</td>
                      <td className="py-3 pr-4 text-slate-700">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <Link className="font-semibold text-emerald-700" href={`/jobs/${job.id}`}>
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
