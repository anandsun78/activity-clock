import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import ActivityClock from "./components/ActivityClock";
import HabitTracker from "./components/HabitTracker";
import { NAV_ITEMS, ROUTES } from "./constants/routes";

function NavBar() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="brand">
          <div className="brand-title">activity-clock</div>
          <div className="brand-subtitle">your day, mapped with intent</div>
        </div>
        <nav className="site-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link${isActive ? " is-active" : ""}`
              }
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
          <Route path={ROUTES.home} element={<ActivityClock />} />
          <Route path={ROUTES.habits} element={<HabitTracker />} />
          <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
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
