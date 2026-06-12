import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../shared/components/Layout";
import { useAuthStore } from "../features/auth/store";
import { useTenantStore } from "../features/tenants/store";

function LoginPlaceholder() {
  return (
    <main className="centered-page">
      <section className="login-panel">
        <p className="eyebrow">Workflow Approval</p>
        <h1>Sign in</h1>
        <p className="muted">Auth screens land here in the next slice.</p>
      </section>
    </main>
  );
}

function TenantPlaceholder() {
  return (
    <main className="centered-page">
      <section className="login-panel">
        <p className="eyebrow">Tenant</p>
        <h1>Choose an organization</h1>
        <p className="muted">Tenant selection will use your memberships from the API.</p>
      </section>
    </main>
  );
}

function ItemsPlaceholder() {
  return (
    <Layout>
      <section className="page-header">
        <div>
          <p className="eyebrow">Items</p>
          <h1>Work queue</h1>
        </div>
      </section>
      <div className="empty-panel">
        <h2>No items loaded yet</h2>
        <p>API integration comes after the backend workflow endpoints are in place.</p>
      </div>
    </Layout>
  );
}

export function AppRouter() {
  const token = useAuthStore((state) => state.token);
  const tenantId = useTenantStore((state) => state.currentTenantId);

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPlaceholder />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!tenantId) {
    return (
      <Routes>
        <Route path="/tenants" element={<TenantPlaceholder />} />
        <Route path="*" element={<Navigate to="/tenants" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/items" element={<ItemsPlaceholder />} />
      <Route path="*" element={<Navigate to="/items" replace />} />
    </Routes>
  );
}
