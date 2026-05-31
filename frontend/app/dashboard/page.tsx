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
  const [providerFormProvider, setProviderFormProvider] = useState("mock");
  const [providerFormBaseUrl, setProviderFormBaseUrl] = useState("");
  const [providerFormApiKey, setProviderFormApiKey] = useState("");
  const [providerFormModel, setProviderFormModel] = useState("");
  const [providerFormTimeout, setProviderFormTimeout] = useState("60");
  const [providerFormRetryCount, setProviderFormRetryCount] = useState("2");
  const [providerFormMockDelay, setProviderFormMockDelay] = useState("0");
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
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isTestingProvider, setIsTestingProvider] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch(`${apiUrl}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("登录已失效，请重新登录");
        return response.json() as Promise<ApiUser>;
      })
      .then(setUser)
      .catch((err) => setError(err instanceof Error ? err.message : "无法加载用户信息"))
      .finally(() => setIsLoading(false));

    loadTransactions();
  }, []);

  useEffect(() => {
    if (localStorage.getItem("access_token")) loadJobs();
  }, [jobStatusFilter, jobsOffset]);

  useEffect(() => {
    if (user?.role === "admin") loadProviderStatus();
  }, [user?.role]);

  async function loadJobs() {
    setJobsError("");
    setIsJobsLoading(true);
    try {
      const searchParams = new URLSearchParams({ limit: String(JOB_PAGE_SIZE), offset: String(jobsOffset) });
      if (jobStatusFilter !== "all") searchParams.set("status", jobStatusFilter);
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
      setTransactions(await authenticatedApiRequest<CreditTransaction[]>("/api/credits/transactions"));
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
      const status = await authenticatedApiRequest<ImageProviderStatus>("/api/admin/image-provider");
      setProviderStatus(status);
      setProviderFormProvider(status.provider);
      setProviderFormBaseUrl(status.image_api_base_url);
      setProviderFormModel(status.image_model);
      setProviderFormTimeout(String(status.timeout_seconds));
      setProviderFormRetryCount(String(status.retry_count));
      setProviderFormMockDelay(String(status.mock_delay_seconds));
      setProviderFormApiKey("");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: grantEmail, amount: Number(grantAmount), description: grantDescription || undefined }),
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

  async function saveImageProviderConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProviderError("");
    setProviderMessage("");
    setIsSavingProvider(true);
    try {
      const status = await authenticatedApiRequest<ImageProviderStatus>("/api/admin/image-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerFormProvider,
          image_api_base_url: providerFormBaseUrl,
          image_api_key: providerFormApiKey || undefined,
          image_model: providerFormModel,
          timeout_seconds: Number(providerFormTimeout),
          retry_count: Number(providerFormRetryCount),
          mock_delay_seconds: Number(providerFormMockDelay),
        }),
      });
      setProviderStatus(status);
      setProviderFormApiKey("");
      setProviderMessage("Provider 配置已保存。后续测试生成和批量任务会使用这份网页配置。");
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "无法保存图片 Provider 配置");
    } finally {
      setIsSavingProvider(false);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: providerTestTitle, prompt: providerTestPrompt }),
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
          <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold" onClick={logout} type="button">
            退出登录
          </button>
        </div>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {isLoading ? <p className="text-slate-600">正在加载账号信息...</p> : null}
          {error ? <p className="text-red-600">{error}</p> : null}
          {user ? (
            <dl className="grid gap-4 sm:grid-cols-4">
              <Info label="邮箱" value={user.email} />
              <Info label="角色" value={user.role} />
              <Info label="可用点数" value={String(user.credit_balance)} accent />
              <Info label="注册时间" value={new Date(user.created_at).toLocaleString()} />
            </dl>
          ) : null}
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Excel 上传</h2>
          <p className="mt-2 text-sm text-slate-600">上传包含标题和提示词字段的 .xlsx 文件，系统会创建批量生图任务并返回前 10 行预览。</p>
          <Link className="mt-5 inline-block rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white" href="/upload">
            上传 Excel
          </Link>
        </div>

        {user?.role === "admin" ? (
          <AdminPanels
            grantEmail={grantEmail}
            grantAmount={grantAmount}
            grantDescription={grantDescription}
            grantError={grantError}
            grantMessage={grantMessage}
            isGranting={isGranting}
            onGrantCredits={grantCredits}
            setGrantEmail={setGrantEmail}
            setGrantAmount={setGrantAmount}
            setGrantDescription={setGrantDescription}
            providerStatus={providerStatus}
            providerError={providerError}
            providerMessage={providerMessage}
            providerFormProvider={providerFormProvider}
            providerFormBaseUrl={providerFormBaseUrl}
            providerFormApiKey={providerFormApiKey}
            providerFormModel={providerFormModel}
            providerFormTimeout={providerFormTimeout}
            providerFormRetryCount={providerFormRetryCount}
            providerFormMockDelay={providerFormMockDelay}
            providerTestTitle={providerTestTitle}
            providerTestPrompt={providerTestPrompt}
            providerTestImageUrl={providerTestImageUrl}
            isProviderLoading={isProviderLoading}
            isSavingProvider={isSavingProvider}
            isTestingProvider={isTestingProvider}
            loadProviderStatus={loadProviderStatus}
            saveImageProviderConfig={saveImageProviderConfig}
            testImageProvider={testImageProvider}
            setProviderFormProvider={setProviderFormProvider}
            setProviderFormBaseUrl={setProviderFormBaseUrl}
            setProviderFormApiKey={setProviderFormApiKey}
            setProviderFormModel={setProviderFormModel}
            setProviderFormTimeout={setProviderFormTimeout}
            setProviderFormRetryCount={setProviderFormRetryCount}
            setProviderFormMockDelay={setProviderFormMockDelay}
            setProviderTestTitle={setProviderTestTitle}
            setProviderTestPrompt={setProviderTestPrompt}
          />
        ) : null}

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">任务中心</h2>
              <p className="mt-2 text-sm text-slate-600">查看 Excel 上传后创建的批量生图任务。</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600" htmlFor="job-status-filter">状态</label>
              <select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" id="job-status-filter" onChange={(event) => changeJobStatusFilter(event.target.value)} value={jobStatusFilter}>
                {JOB_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold" onClick={loadJobs} type="button">刷新</button>
            </div>
          </div>
          {isJobsLoading ? <p className="mt-5 text-slate-600">正在加载任务...</p> : null}
          {jobsError ? <p className="mt-5 text-sm text-red-600">{jobsError}</p> : null}
          {jobs.length > 0 ? <JobsTable jobs={jobs} /> : null}
          <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
            <span>第 {Math.floor(jobsOffset / JOB_PAGE_SIZE) + 1} 页</span>
            <div className="flex gap-2">
              <button className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold disabled:opacity-50" disabled={jobsOffset === 0 || isJobsLoading} onClick={() => setJobsOffset(Math.max(0, jobsOffset - JOB_PAGE_SIZE))} type="button">上一页</button>
              <button className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold disabled:opacity-50" disabled={jobs.length < JOB_PAGE_SIZE || isJobsLoading} onClick={() => setJobsOffset(jobsOffset + JOB_PAGE_SIZE)} type="button">下一页</button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">点数流水</h2>
              <p className="mt-2 text-sm text-slate-600">查看最近 50 条点数发放、扣除和退款记录。</p>
            </div>
            <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold" onClick={loadTransactions} type="button">刷新</button>
          </div>
          {isTransactionsLoading ? <p className="mt-5 text-slate-600">正在加载点数流水...</p> : null}
          {transactionsError ? <p className="mt-5 text-sm text-red-600">{transactionsError}</p> : null}
          {transactions.length > 0 ? <TransactionsTable transactions={transactions} /> : null}
        </div>
      </section>
    </main>
  );
}

function Info({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><dt className="text-sm text-slate-500">{label}</dt><dd className={`mt-1 font-semibold ${accent ? "text-emerald-700" : "text-slate-950"}`}>{value}</dd></div>;
}

function JobsTable({ jobs }: { jobs: GenerationJob[] }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3 pr-4 font-medium">ID</th><th className="py-3 pr-4 font-medium">状态</th><th className="py-3 pr-4 font-medium">数量</th><th className="py-3 pr-4 font-medium">成功</th><th className="py-3 pr-4 font-medium">失败</th><th className="py-3 pr-4 font-medium">创建时间</th><th className="py-3 pr-4 font-medium">操作</th></tr></thead><tbody>{jobs.map((job) => <tr className="border-b border-slate-100" key={job.id}><td className="py-3 pr-4 font-semibold text-slate-950">#{job.id}</td><td className="py-3 pr-4 text-slate-700">{job.status}</td><td className="py-3 pr-4 text-slate-700">{job.total_count}</td><td className="py-3 pr-4 text-slate-700">{job.success_count}</td><td className="py-3 pr-4 text-slate-700">{job.failed_count}</td><td className="py-3 pr-4 text-slate-700">{new Date(job.created_at).toLocaleString()}</td><td className="py-3 pr-4"><Link className="font-semibold text-emerald-700" href={`/jobs/${job.id}`}>查看详情</Link></td></tr>)}</tbody></table></div>;
}

function TransactionsTable({ transactions }: { transactions: CreditTransaction[] }) {
  return <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3 pr-4 font-medium">时间</th><th className="py-3 pr-4 font-medium">类型</th><th className="py-3 pr-4 font-medium">数量</th><th className="py-3 pr-4 font-medium">说明</th><th className="py-3 pr-4 font-medium">任务</th><th className="py-3 pr-4 font-medium">条目</th></tr></thead><tbody>{transactions.map((transaction) => <tr className="border-b border-slate-100" key={transaction.id}><td className="py-3 pr-4 text-slate-700">{new Date(transaction.created_at).toLocaleString()}</td><td className="py-3 pr-4 text-slate-700">{transaction.type}</td><td className={`py-3 pr-4 font-semibold ${transaction.amount > 0 ? "text-emerald-700" : "text-slate-950"}`}>{transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}</td><td className="py-3 pr-4 text-slate-700">{transaction.description}</td><td className="py-3 pr-4 text-slate-700">{transaction.job_id ? `#${transaction.job_id}` : "-"}</td><td className="py-3 pr-4 text-slate-700">{transaction.item_id ? `#${transaction.item_id}` : "-"}</td></tr>)}</tbody></table></div>;
}

type AdminPanelsProps = {
  grantEmail: string; grantAmount: string; grantDescription: string; grantError: string; grantMessage: string; isGranting: boolean;
  onGrantCredits: (event: FormEvent<HTMLFormElement>) => void; setGrantEmail: (value: string) => void; setGrantAmount: (value: string) => void; setGrantDescription: (value: string) => void;
  providerStatus: ImageProviderStatus | null; providerError: string; providerMessage: string; providerFormProvider: string; providerFormBaseUrl: string; providerFormApiKey: string; providerFormModel: string; providerFormTimeout: string; providerFormRetryCount: string; providerFormMockDelay: string; providerTestTitle: string; providerTestPrompt: string; providerTestImageUrl: string; isProviderLoading: boolean; isSavingProvider: boolean; isTestingProvider: boolean;
  loadProviderStatus: () => void; saveImageProviderConfig: (event: FormEvent<HTMLFormElement>) => void; testImageProvider: (event: FormEvent<HTMLFormElement>) => void;
  setProviderFormProvider: (value: string) => void; setProviderFormBaseUrl: (value: string) => void; setProviderFormApiKey: (value: string) => void; setProviderFormModel: (value: string) => void; setProviderFormTimeout: (value: string) => void; setProviderFormRetryCount: (value: string) => void; setProviderFormMockDelay: (value: string) => void; setProviderTestTitle: (value: string) => void; setProviderTestPrompt: (value: string) => void;
};

function AdminPanels(props: AdminPanelsProps) {
  return <>
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-950">点数充值</h2><form className="mt-5 grid gap-4 md:grid-cols-[1.5fr_120px_1.5fr_auto]" onSubmit={props.onGrantCredits}><label className="block"><span className="text-sm text-slate-600">用户邮箱</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => props.setGrantEmail(event.target.value)} placeholder="user@example.com" required type="email" value={props.grantEmail} /></label><label className="block"><span className="text-sm text-slate-600">点数</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" max="10000" min="1" onChange={(event) => props.setGrantAmount(event.target.value)} required type="number" value={props.grantAmount} /></label><label className="block"><span className="text-sm text-slate-600">说明</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => props.setGrantDescription(event.target.value)} placeholder="测试充值" type="text" value={props.grantDescription} /></label><button className="self-end rounded-md bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-400" disabled={props.isGranting} type="submit">{props.isGranting ? "充值中..." : "充值"}</button></form>{props.grantError ? <p className="mt-4 text-sm text-red-600">{props.grantError}</p> : null}{props.grantMessage ? <p className="mt-4 text-sm text-emerald-700">{props.grantMessage}</p> : null}</div>
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-950">图片 Provider</h2><p className="mt-2 text-sm text-slate-600">查看、保存并测试当前生图配置。</p></div><button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold" disabled={props.isProviderLoading} onClick={props.loadProviderStatus} type="button">刷新配置</button></div>{props.providerStatus ? <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3"><Info label="Provider" value={props.providerStatus.provider} /><Info label="模型" value={props.providerStatus.image_model || "-"} /><Info label="API Key" value={props.providerStatus.has_api_key ? "已配置" : "未配置"} /><div className="md:col-span-3"><dt className="text-sm text-slate-500">API Base URL</dt><dd className="mt-1 break-all font-semibold text-slate-950">{props.providerStatus.image_api_base_url || "-"}</dd></div><Info label="超时" value={`${props.providerStatus.timeout_seconds}s`} /><Info label="重试次数" value={String(props.providerStatus.retry_count)} /><Info label="Mock 延迟" value={`${props.providerStatus.mock_delay_seconds}s`} /><Info label="配置来源" value={props.providerStatus.source === "web" ? "网页配置" : ".env"} /></dl> : null}{props.providerStatus?.provider === "mock" ? <p className="mt-4 text-sm text-slate-600">当前使用 mock provider，测试生成不会调用外部 API。</p> : null}{props.providerStatus && !props.providerStatus.is_ready ? <p className="mt-4 text-sm text-red-600">当前配置未就绪，缺少 {props.providerStatus.missing_settings.join(", ")}。</p> : null}<ProviderConfigForm {...props} /><ProviderTestForm {...props} /></div>
  </>;
}

function ProviderConfigForm(props: AdminPanelsProps) {
  return <form className="mt-6 border-t border-slate-100 pt-6" onSubmit={props.saveImageProviderConfig}><h3 className="text-base font-bold text-slate-950">网页配置</h3><div className="mt-4 grid gap-4 md:grid-cols-3"><label><span className="text-sm text-slate-600">Provider</span><select className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" onChange={(event) => props.setProviderFormProvider(event.target.value)} value={props.providerFormProvider}><option value="mock">mock</option><option value="real">real</option></select></label><label className="md:col-span-2"><span className="text-sm text-slate-600">API Base URL</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => props.setProviderFormBaseUrl(event.target.value)} placeholder="https://your-image-api.example.com/v1" type="url" value={props.providerFormBaseUrl} /></label><label><span className="text-sm text-slate-600">模型</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => props.setProviderFormModel(event.target.value)} placeholder="gpt-image-1" type="text" value={props.providerFormModel} /></label><label className="md:col-span-2"><span className="text-sm text-slate-600">API Key</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" onChange={(event) => props.setProviderFormApiKey(event.target.value)} placeholder={props.providerStatus?.has_api_key ? "已保存，留空表示不修改" : "填入 API Key"} type="password" value={props.providerFormApiKey} /></label><label><span className="text-sm text-slate-600">超时秒数</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" max="300" min="1" onChange={(event) => props.setProviderFormTimeout(event.target.value)} type="number" value={props.providerFormTimeout} /></label><label><span className="text-sm text-slate-600">重试次数</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" max="10" min="0" onChange={(event) => props.setProviderFormRetryCount(event.target.value)} type="number" value={props.providerFormRetryCount} /></label><label><span className="text-sm text-slate-600">Mock 延迟秒数</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" max="60" min="0" onChange={(event) => props.setProviderFormMockDelay(event.target.value)} type="number" value={props.providerFormMockDelay} /></label></div><button className="mt-4 rounded-md bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-400" disabled={props.isSavingProvider} type="submit">{props.isSavingProvider ? "保存中..." : "保存配置"}</button></form>;
}

function ProviderTestForm(props: AdminPanelsProps) {
  return <form className="mt-6 grid gap-4 md:grid-cols-[1fr_2fr_auto]" onSubmit={props.testImageProvider}><label><span className="text-sm text-slate-600">标题</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" maxLength={200} onChange={(event) => props.setProviderTestTitle(event.target.value)} required type="text" value={props.providerTestTitle} /></label><label><span className="text-sm text-slate-600">提示词</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" maxLength={2000} onChange={(event) => props.setProviderTestPrompt(event.target.value)} required type="text" value={props.providerTestPrompt} /></label><button className="self-end rounded-md bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:bg-slate-400" disabled={props.isTestingProvider} type="submit">{props.isTestingProvider ? "生成中..." : "测试生成"}</button>{props.providerError ? <p className="md:col-span-3 text-sm text-red-600">{props.providerError}</p> : null}{props.providerMessage ? <p className="md:col-span-3 text-sm text-emerald-700">{props.providerMessage}</p> : null}{props.providerTestImageUrl ? <img alt="Provider test result" className="h-40 w-40 rounded-md border border-slate-200 object-cover" src={props.providerTestImageUrl} /> : null}</form>;
}
