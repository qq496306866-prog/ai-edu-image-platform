"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiUser, apiUrl } from "../lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
  }, []);

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
      </section>
    </main>
  );
}
