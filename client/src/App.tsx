import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { Video, Library, Settings, LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import RecordPage from "./pages/RecordPage";
import LibraryPage from "./pages/LibraryPage";
import EditorPage from "./pages/EditorPage";
import ViewerPage from "./pages/ViewerPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import { Loader2 } from "lucide-react";

// ── Protected route guard ─────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ── Sidebar + layout ──────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
      {initials}
    </div>
  );
}

function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <nav className="w-16 flex flex-col items-center py-5 gap-4 border-r border-border bg-card shrink-0">
      {/* Logo */}
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <Video className="w-4 h-4 text-white" />
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-1.5 mt-3 flex-1">
        <NavLink
          to="/record"
          title="Record"
          className={({ isActive }) =>
            `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`
          }
        >
          <Video className="w-5 h-5" />
        </NavLink>
        <NavLink
          to="/library"
          title="Library"
          className={({ isActive }) =>
            `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`
          }
        >
          <Library className="w-5 h-5" />
        </NavLink>
        <NavLink
          to="/settings"
          title="Settings"
          className={({ isActive }) =>
            `w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`
          }
        >
          <Settings className="w-5 h-5" />
        </NavLink>
      </div>

      {/* Bottom: user + logout */}
      <div className="flex flex-col items-center gap-2">
        {user && (
          <div title={`${user.name}\n${user.email}`}>
            <UserAvatar name={user.name} />
          </div>
        )}
        <button
          onClick={logout}
          title="Sign out"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public — no auth required */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/v/:token" element={<ViewerPage />} />

          {/* Protected app shell */}
          <Route
            path="/*"
            element={
              <RequireAuth>
                <Layout>
                  <Routes>
                    <Route index element={<Navigate to="/record" replace />} />
                    <Route path="record" element={<RecordPage />} />
                    <Route path="library" element={<LibraryPage />} />
                    <Route path="editor/:id" element={<EditorPage />} />
                    <Route
                      path="settings"
                      element={<div className="p-8 text-muted-foreground">Settings coming soon</div>}
                    />
                  </Routes>
                </Layout>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
