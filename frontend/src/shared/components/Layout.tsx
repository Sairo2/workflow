import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ClipboardList, GitBranch, History, Inbox, Users } from "lucide-react";

type LayoutProps = {
  children: ReactNode;
};

const navItems = [
  { to: "/items", label: "Items", icon: Inbox },
  { to: "/approvals", label: "Approvals", icon: ClipboardList },
  { to: "/workflows", label: "Workflows", icon: GitBranch },
  { to: "/audit", label: "Audit", icon: History }
];

export function Layout({ children }: LayoutProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Users size={20} aria-hidden="true" />
          <span>Flowdesk</span>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink key={item.to} to={item.to} className="nav-link">
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
