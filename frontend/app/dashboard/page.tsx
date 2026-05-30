"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
  ApiUser,
  CreditTransaction,
  GenerationJob,
  ImageProviderStatus,
  ImageProviderTestResponse,
  apiUrl,
  authenticatedApiRequest,
} from "../lib/api";

const JOB_PAGE_SIZE = 10;
const JOB_STATUS_OPTIONS = [
  { label: "全部", value: "all" },
  { label: "待开始", value: "pending" },
  { label: "生成中", value: "running" },
  { label: "已完成", value: "completed" },
  { label: "失败", value: "failed" },
  { label: "已取消", value: "cancelled" },
];

export default function DashboardPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [jobsOffset, setJobsOffset] = useState(0);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAmount, setGrantAmount] = useState("10");
  const [grantDescription, setGrantDescription] = useState("");
  const [providerStatus, setProviderStatus] = useState<ImageProviderStatus | null>(null);
  const [providerTestTitle, setProviderTestTitle] = useState("Provider 测试图");
  const [providerTestPrompt, setProviderTestPrompt] = useState("Create a clean educational image provider test card.");
  const [providerTestImageUrl, setProviderTestImageUrl] = useState("");
  const [error, setError] = useState("");
  const [jobsError, setJobsError] = useState("");
  const [transactionsError, setTransactionsError] = useState("");
  const [grantError, setGrantError] = useState("");
  const [grantMessage, setGrantMessage] = useState("");
  const [providerError, setProviderError] = useState("");
  const [providerMessage, setProviderMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isJobsLoading, setIsJobsLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isGranting, setIsGranting] = useState(false);
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const [isTestingProvider, setIsTestingProvider] = useState(false);

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

    loadTransactions();
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      return;
    }
    loadJobs();
  }, [jobStatusFilter, jobsOffset]);

  useEffect(() => {
    if (user?.role !== "admin") {
      return;
    }
    loadProviderStatus();
  }, [user?.role]);

  async function loadJobs() {
    setJobsError("");
    setIsJobsLoading(true);
    try {
      const searchParams = new URLSearchParams({
        limit: String(JOB_PAGE_SIZE),
        offset: String(jobsOffset),
      });
      if (jobStatusFilter !== "all") {
        searchParams.set("status", jobStatusFilter);
      }
      setJobs(await authenticatedApiRequest<GenerationJob[]>(`/api/jobs?${searchParams.toString()}`));
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : "无法加载任务列表");
    } finally {
      setIsJobsLoading(false);
    }
  }

  async function loadTransactions() {
    setTransactionsError("");
    setIsTransactionsLoading(true);
    try {
      setTransactions(
        await authenticatedApiRequest<CreditTransaction[]>("/api/credits/transactions"),
      );
    } catch (err) {
      setTransactionsError(err instanceof Error ? err.message : "无法加载点数流水");
    } finally {
      setIsTransactionsLoading(false);
    }
  }

  async function loadProviderStatus() {
    setProviderError("");
    setIsProviderLoading(true);
    try {
      setProviderStatus(await authenticatedApiRequest<ImageProviderStatus>("/api/admin/image-provider"));
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "无法加载图片 Provider 配置");
    } finally {
      setIsProviderLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }

  function changeJobStatusFilter(nextStatus: string) {
    setJobStatusFilter(nextStatus);
    setJobsOffset(0);
  }

  async function grantCredits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGrantError("");
    setGrantMessage("");
    setIsGranting(true);
    try {
      const targetUser = await authenticatedApiRequest<ApiUser>("/api/admin/credits/grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: grantEmail,
          amount: Number(grantAmount),
          description: grantDescription || undefined,
        }),
      });
      setGrantMessage(`${targetUser.email} 已充值 ${grantAmount} 点，当前余额 ${targetUser.credit_balance}。`);
      if (user?.email === targetUser.email) {
        setUser(targetUser);
        loadTransactions();
      }
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "充值失败");
    } finally {
      setIsGranting(false);
    }
  }

  async function testImageProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProviderError("");
    setProviderMessage("");
    setProviderTestImageUrl("");
    setIsTestingProvider(true);
    try {
      const response = await authenticatedApiRequest<ImageProviderTestResponse>("/api/admin/image-provider/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: providerTestTitle,
          prompt: providerTestPrompt,
        }),
      });
      setProviderTestImageUrl(`${apiUrl}${response.image_url}`);
      setProviderMessage(`测试成功，使用 ${response.provider} provider 生成了一张图片。`);
      loadProviderStatus();
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "图片 Provider 测试失败");
    } finally {
      setIsTestingProvider(false);
    }
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
            <dl className="grid gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-sm text-slate-500">邮箱</dt>
                <dd className="mt-1 font-semibold text-slate-950">{user.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">角色</dt>
                <dd className="mt-1 font-semibold text-slate-950">{user.role}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">可用点数</dt>
                <dd className="mt-1 font-semibold text-emerald-700">{user.credit_balance}</dd>
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

        {user?.role === "admin" ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">点数充值</h2>
            <form className="mt-5 grid gap-4 md:grid-cols-[1.5fr_120px_1.5fr_auto]" onSubmit={grantCredits}>
              <label className="block">
                <span className="text-sm text-slate-600">用户邮箱</span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                  onChange={(event) => setGrantEmail(event.target.value)}
                  placeholder="user@example.com"
                  required
                  type="email"
                  value={grantEmail}
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-600">点数</span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                  max="10000"
                  min="1"
                  onChange={(event) => setGrantAmount(event.target.value)}
                  required
                  type="number"
                  value={grantAmount}
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-600">说明</span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                  onChange={(event) => setGrantDescription(event.target.value)}
                  placeholder="测试充值"
                  type="text"
                  value={grantDescription}
                />
              </label>
              <button
                className="self-end rounded-md bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isGranting}
                type="submit"
              >
                {isGranting ? "充值中..." : "充值"}
              </button>
            </form>
            {grantError ? <p className="mt-4 text-sm text-red-600">{grantError}</p> : null}
            {grantMessage ? <p className="mt-4 text-sm text-emerald-700">{grantMessage}</p> : null}
          </div>
        ) : null}

        {user?.role === "admin" ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">图片 Provider</h2>
                <p className="mt-2 text-sm text-slate-600">查看当前生图配置，并用当前 provider 生成一张测试图。</p>
              </div>
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
                disabled={isProviderLoading}
                onClick={loadProviderStatus}
                type="button"
              >
                刷新配置
              </button>
            </div>

            {isProviderLoading ? <p className="mt-5 text-sm text-slate-600">正在加载 Provider 配置...</p> : null}
            {providerStatus ? (
              <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Provider</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{providerStatus.provider}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">模型</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{providerStatus.image_model || "-"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">API Key</dt>
                  <dd className="mt-1 font-semibold text-slate-950">
                    {providerStatus.has_api_key ? "已配置" : "未配置"}
                  </dd>
                </div>
                <div className="md:col-span-3">
                  <dt className="text-slate-500">API Base URL</dt>
                  <dd className="mt-1 break-all font-semibold text-slate-950">
                    {providerStatus.image_api_base_url || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">超时</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{providerStatus.timeout_seconds}s</dd>
                </div>
                <div>
                  <dt className="text-slate-500">重试次数</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{providerStatus.retry_count}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mock 延迟</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{providerStatus.mock_delay_seconds}s</dd>
                </div>
              </dl>
            ) : null}

            <form className="mt-6 grid gap-4 md:grid-cols-[1fr_2fr_auto]" onSubmit={testImageProvider}>
              <label className="block">
                <span className="text-sm text-slate-600">标题</span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                  maxLength={200}
                  onChange={(event) => setProviderTestTitle(event.target.value)}
                  required
                  type="text"
                  value={providerTestTitle}
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-600">提示词</span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950"
                  maxLength={2000}
                  onChange={(event) => setProviderTestPrompt(event.target.value)}
                  required
                  type="text"
                  value={providerTestPrompt}
                />
              </label>
              <button
                className="self-end rounded-md bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isTestingProvider}
                type="submit"
              >
                {isTestingProvider ? "生成中..." : "测试生成"}
              </button>
            </form>
            {providerError ? <p className="mt-4 text-sm text-red-600">{providerError}</p> : null}
            {providerMessage ? <p className="mt-4 text-sm text-emerald-700">{providerMessage}</p> : null}
            {providerTestImageUrl ? (
              <img
                alt="Provider test result"
                className="mt-5 h-40 w-40 rounded-md border border-slate-200 object-cover"
                src={providerTestImageUrl}
              />
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">任务中心</h2>
              <p className="mt-2 text-sm text-slate-600">查看 Excel 上传后创建的批量生图任务。</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-slate-600" htmlFor="job-status-filter">
                状态
              </label>
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                id="job-status-filter"
                onChange={(event) => changeJobStatusFilter(event.target.value)}
                value={jobStatusFilter}
              >
                {JOB_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
                onClick={loadJobs}
                type="button"
              >
                刷新
              </button>
            </div>
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
                    <th className="py-3 pr-4 font-medium">成功</th>
                    <th className="py-3 pr-4 font-medium">失败</th>
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
                      <td className="py-3 pr-4 text-slate-700">{job.success_count}</td>
                      <td className="py-3 pr-4 text-slate-700">{job.failed_count}</td>
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

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
            <span>第 {Math.floor(jobsOffset / JOB_PAGE_SIZE) + 1} 页</span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 transition enabled:hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={jobsOffset === 0 || isJobsLoading}
                onClick={() => setJobsOffset(Math.max(0, jobsOffset - JOB_PAGE_SIZE))}
                type="button"
              >
                上一页
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 transition enabled:hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={jobs.length < JOB_PAGE_SIZE || isJobsLoading}
                onClick={() => setJobsOffset(jobsOffset + JOB_PAGE_SIZE)}
                type="button"
              >
                下一页
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">点数流水</h2>
              <p className="mt-2 text-sm text-slate-600">查看最近 50 条点数发放、扣除和退款记录。</p>
            </div>
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
              onClick={loadTransactions}
              type="button"
            >
              刷新
            </button>
          </div>

          {isTransactionsLoading ? <p className="mt-5 text-slate-600">正在加载点数流水...</p> : null}
          {transactionsError ? <p className="mt-5 text-sm text-red-600">{transactionsError}</p> : null}
          {!isTransactionsLoading && !transactionsError && transactions.length === 0 ? (
            <p className="mt-5 text-sm text-slate-600">暂无点数流水。</p>
          ) : null}

          {transactions.length > 0 ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 font-medium">时间</th>
                    <th className="py-3 pr-4 font-medium">类型</th>
                    <th className="py-3 pr-4 font-medium">数量</th>
                    <th className="py-3 pr-4 font-medium">说明</th>
                    <th className="py-3 pr-4 font-medium">任务</th>
                    <th className="py-3 pr-4 font-medium">条目</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr className="border-b border-slate-100" key={transaction.id}>
                      <td className="py-3 pr-4 text-slate-700">
                        {new Date(transaction.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{transaction.type}</td>
                      <td
                        className={`py-3 pr-4 font-semibold ${
                          transaction.amount > 0 ? "text-emerald-700" : "text-slate-950"
                        }`}
                      >
                        {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{transaction.description}</td>
                      <td className="py-3 pr-4 text-slate-700">
                        {transaction.job_id ? `#${transaction.job_id}` : "-"}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">
                        {transaction.item_id ? `#${transaction.item_id}` : "-"}
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
