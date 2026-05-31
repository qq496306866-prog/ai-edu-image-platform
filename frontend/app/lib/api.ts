export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

export type ApiUser = {
  id: number;
  email: string;
  role: string;
  credit_balance: number;
  created_at: string;
};

export type CreditTransaction = {
  id: number;
  user_id: number;
  job_id: number | null;
  item_id: number | null;
  amount: number;
  type: string;
  description: string;
  created_at: string;
};

export type ImageProviderStatus = {
  provider: string;
  image_api_base_url: string;
  image_model: string;
  has_api_key: boolean;
  source: string;
  is_ready: boolean;
  missing_settings: string[];
  timeout_seconds: number;
  retry_count: number;
  mock_delay_seconds: number;
};

export type ImageProviderTestResponse = {
  provider: string;
  image_path: string;
  image_url: string;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export async function authenticatedApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("请先登录");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export type GenerationJob = {
  id: number;
  status: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  source_excel_path: string;
  created_at: string;
  updated_at: string;
};

export type GenerationItem = {
  id: number;
  job_id: number;
  title: string;
  prompt: string;
  reference_image_path: string | null;
  status: string;
  result_image_path: string | null;
  result_image_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};
