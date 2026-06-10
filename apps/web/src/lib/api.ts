const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Erreur réseau" }));
    throw new Error(error.message ?? `Erreur ${res.status}`);
  }

  return res.json();
}

export async function apiUpload(path: string, formData: FormData): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Erreur upload" }));
    throw new Error(error.message ?? `Erreur ${res.status}`);
  }

  return res.json();
}
