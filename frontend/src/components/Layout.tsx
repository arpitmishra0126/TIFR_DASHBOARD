import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import {
  IconActivity,
  IconBrain,
  IconChart,
  IconChevron,
  IconClose,
  IconHeart,
  IconHome,
  IconMenu,
  IconMonitor,
  IconProgress,
  IconUsers,
} from "./icons";
import Topbar from "./Topbar";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: IconHome },
  { to: "/registry", label: "Participants", icon: IconUsers },
  { to: "/progress", label: "Assessment Progress", icon: IconProgress },
  { to: "/demographics", label: "Demographics & SES", icon: IconChart },
];

const MODULE_NAV: NavItem[] = [
  { to: "/health-screening", label: "Health & Screening", icon: IconHeart },
  { to: "/physical-activity", label: "Physical Activity", icon: IconActivity },
  { to: "/screen-time", label: "Screen Time", icon: IconMonitor },
  { to: "/neurodevelopment", label: "Neurodevelopment", icon: IconBrain },
];

const COLLAPSE_STORAGE_KEY = "icmr-sidebar-collapsed";

export default function Layout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore storage failures (private browsing, disabled storage, etc.)
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === "/"}
        className={({ isActive }) => `sidebar-nav-link${isActive ? " active" : ""}`}
        title={collapsed ? item.label : undefined}
      >
        <span className="sidebar-nav-icon">
          <Icon width={16} height={16} />
        </span>
        <span className="sidebar-nav-label">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <button
        type="button"
        className="mobile-menu-button"
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <IconClose width={20} height={20} /> : <IconMenu width={20} height={20} />}
      </button>

      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`app-sidebar${mobileOpen ? " mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark" aria-hidden={!collapsed}>
              IN
            </div>
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-title">ICMR Neurodevelopment</div>
              <div className="sidebar-brand-subtitle">Study Dashboard</div>
            </div>
          </div>
        </div>

        <div className="sidebar-toggle-row">
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <IconChevron width={14} height={14} style={{ transform: collapsed ? "none" : "rotate(180deg)" }} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {PRIMARY_NAV.map(renderNavItem)}

          <div className="sidebar-section-label">
            <span>Assessment modules</span>
          </div>
          {MODULE_NAV.map(renderNavItem)}
        </nav>

        <div className="sidebar-footer">
          <span className="live-badge">
            <span className="live-badge-dot" />
            <span className="sidebar-nav-label">Live REDCap data</span>
          </span>
        </div>
      </aside>

      <main className="app-content">
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
}
