import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import ActivityClock from "./components/ActivityClock";
import HabitTracker from "./components/HabitTracker";

const navItems = [
  { label: "Activity Clock", to: "/" },
  { label: "Habit Tracker", to: "/habits" },
];

function NavBar() {
  return (
    <header
      className="card"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        margin: "0 auto",
        marginTop: 24,
        padding: 14,
        maxWidth: 1200,
        width: "calc(100% - 24px)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, letterSpacing: 0.4, fontSize: 18 }}>
          activity-clock
        </div>
        <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: "8px 12px",
                borderRadius: 12,
                border: `1px solid ${isActive ? "var(--primary-soft)" : "var(--border)"}`,
                background: isActive ? "rgba(124, 58, 237, 0.18)" : "rgba(255,255,255,0.03)",
                color: "#e2e8f0",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: isActive ? "0 10px 30px rgba(124, 58, 237, 0.25)" : "none",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

function AppShell() {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="page">
        <Routes>
          <Route path="/" element={<ActivityClock />} />
          <Route path="/habits" element={<HabitTracker />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
