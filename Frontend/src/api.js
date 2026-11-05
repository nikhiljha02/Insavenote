const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

const defaultApiUrl = import.meta.env.DEV ? "http://localhost:8080" : "";
console.log(defaultApiUrl);
export const API_BASE = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, "");

export function apiUrl(path) {
  // return `${API_BASE}/${String(path).replace(/^\/+/, "")}`;
  return `/${String(path).replace(/^\/+/, "")}`;
}
