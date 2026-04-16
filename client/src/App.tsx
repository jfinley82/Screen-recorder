import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { Video, Library, Settings } from "lucide-react";
import RecordPage from "./pages/RecordPage";
import LibraryPage from "./pages/LibraryPage";
import EditorPage from "./pages/EditorPage";
import ViewerPage from "./pages/ViewerPage";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <nav className="w-16 flex flex-col items-center py-6 gap-6 border-r border-border bg-card shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Video className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col gap-2 mt-4">
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
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public share viewer — no sidebar */}
        <Route path="/v/:token" element={<ViewerPage />} />

        {/* App shell with sidebar */}
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route index element={<Navigate to="/record" replace />} />
                <Route path="record" element={<RecordPage />} />
                <Route path="library" element={<LibraryPage />} />
                <Route path="editor/:id" element={<EditorPage />} />
                <Route path="settings" element={<div className="p-8 text-muted-foreground">Settings coming soon</div>} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
