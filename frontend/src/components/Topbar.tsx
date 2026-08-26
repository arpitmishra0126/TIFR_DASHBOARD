import { IconMoon, IconRefresh, IconSun } from "./icons";
import { useRefresh } from "../context/RefreshContext";
import { useTheme } from "../context/ThemeContext";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

export default function Topbar() {
  const { refresh, refreshing, lastUpdated, error } = useRefresh();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app-topbar">
      <div className="app-topbar-status">
        {lastUpdated && <span className="last-updated">Last updated: {formatTime(lastUpdated)}</span>}
        {error && <span className="refresh-error">Refresh failed: {error}</span>}
      </div>

      <div className="app-topbar-actions">
        <button
          type="button"
          className="refresh-button"
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          <span className={`refresh-icon${refreshing ? " spinning" : ""}`}>
            <IconRefresh width={15} height={15} />
          </span>
          {refreshing ? "Refreshing…" : "Refresh data"}
        </button>

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          {theme === "light" ? <IconMoon width={15} height={15} /> : <IconSun width={15} height={15} />}
        </button>
      </div>
    </div>
  );
}
