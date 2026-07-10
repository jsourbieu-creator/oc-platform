const API_BASE = "api";

export async function api(file, action, params = {}, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/${file}?action=${action}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}
