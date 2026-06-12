import { create } from "zustand";
import { persist } from "zustand/middleware";

type TenantState = {
  currentTenantId: string | null;
  setCurrentTenantId: (tenantId: string) => void;
  clearTenant: () => void;
};

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      currentTenantId: null,
      setCurrentTenantId: (tenantId) => set({ currentTenantId: tenantId }),
      clearTenant: () => set({ currentTenantId: null })
    }),
    { name: "workflow-tenant" }
  )
);
