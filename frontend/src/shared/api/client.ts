import axios from "axios";
import { useAuthStore } from "../../features/auth/store";
import { useTenantStore } from "../../features/tenants/store";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
  timeout: 15_000
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  const tenantId = useTenantStore.getState().currentTenantId;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    config.headers["X-Tenant-ID"] = tenantId;
  }

  return config;
});
