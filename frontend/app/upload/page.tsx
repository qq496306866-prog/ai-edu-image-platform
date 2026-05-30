"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { apiUrl } from "../lib/api";

type PreviewItem = {
  row_number: number;
  title: string;
  prompt: string;
  reference_image_path: string | null;
};

type UploadResponse = {
  job_id: number;
  total_count: number;
  preview: PreviewItem[];
};

export default function UploadPage() {
  const [token, setToken] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) {
      window.location.href = "/login";
      return;
    }
    setToken(storedToken);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !token) {
      setError("请选择 .xlsx 文件");
      return;
    }

    setError("");
    setResult(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${apiUrl}/api/uploads/excel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.detail ?? "上传失败");
      }

      setResult((await response.json()) as UploadResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Excel Upload</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">上传 Excel</h1>
          </div>
          <Link
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-emerald-600"
            href="/dashboard"
          >
            返回控制台
          </Link>
        </div>

        <form className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Excel 文件</span>
            <input
              accept=".xlsx"
              className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
              type="file"
            />
          </label>

          <p className="mt-3 text-sm text-slate-600">
            支持字段：商品标题/标题/title/name，提示词/prompt，参考图片路径/参考图/image_path/reference_image。
          </p>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <button
            className="mt-6 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "解析中..." : "上传并解析"}
          </button>
        </form>

        {result ? (
          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">任务 ID</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">#{result.job_id}</h2>
              </div>
              <p className="text-sm font-semibold text-emerald-700">共解析 {result.total_count} 条</p>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 pr-4 font-medium">行号</th>
                    <th className="py-3 pr-4 font-medium">标题</th>
                    <th className="py-3 pr-4 font-medium">提示词</th>
                    <th className="py-3 pr-4 font-medium">参考图</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((item) => (
                    <tr className="border-b border-slate-100" key={item.row_number}>
                      <td className="py-3 pr-4 text-slate-600">{item.row_number}</td>
                      <td className="py-3 pr-4 font-medium text-slate-950">{item.title}</td>
                      <td className="max-w-md py-3 pr-4 text-slate-700">{item.prompt}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.reference_image_path ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
