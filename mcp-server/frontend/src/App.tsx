import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";

const HomePage = lazy(() => import("@/pages/HomePage").then((m) => ({ default: m.HomePage })));
const ChatPage = lazy(() => import("@/pages/ChatPage").then((m) => ({ default: m.ChatPage })));
const ToolsPage = lazy(() => import("@/pages/ToolsPage").then((m) => ({ default: m.ToolsPage })));
const PluginsPage = lazy(() => import("@/pages/PluginsPage").then((m) => ({ default: m.PluginsPage })));
const AuditPage = lazy(() => import("@/pages/AuditPage").then((m) => ({ default: m.AuditPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const ObservabilityPage = lazy(() => import("@/pages/ObservabilityPage").then((m) => ({ default: m.ObservabilityPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const UsagePage = lazy(() => import("@/pages/UsagePage").then((m) => ({ default: m.UsagePage })));
const RunsPage = lazy(() => import("@/pages/RunsPage").then((m) => ({ default: m.RunsPage })));
const BrainPage = lazy(() => import("@/pages/BrainPage").then((m) => ({ default: m.BrainPage })));

function PageLoader() {
  return (
    <div className="flex h-40 items-center justify-center text-muted-foreground">
      Yükleniyor…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            index
            element={
              <Suspense fallback={<PageLoader />}>
                <HomePage />
              </Suspense>
            }
          />
          <Route
            path="chat"
            element={
              <Suspense fallback={<PageLoader />}>
                <ChatPage />
              </Suspense>
            }
          />
          <Route
            path="tools"
            element={
              <Suspense fallback={<PageLoader />}>
                <ToolsPage />
              </Suspense>
            }
          />
          <Route
            path="plugins"
            element={
              <Suspense fallback={<PageLoader />}>
                <PluginsPage />
              </Suspense>
            }
          />
          <Route
            path="audit"
            element={
              <Suspense fallback={<PageLoader />}>
                <AuditPage />
              </Suspense>
            }
          />
          <Route
            path="admin"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminPage />
              </Suspense>
            }
          />
          <Route
            path="observability"
            element={
              <Suspense fallback={<PageLoader />}>
                <ObservabilityPage />
              </Suspense>
            }
          />
          <Route
            path="usage"
            element={
              <Suspense fallback={<PageLoader />}>
                <UsagePage />
              </Suspense>
            }
          />
          <Route
            path="runs"
            element={
              <Suspense fallback={<PageLoader />}>
                <RunsPage />
              </Suspense>
            }
          />
          <Route
            path="brain"
            element={
              <Suspense fallback={<PageLoader />}>
                <BrainPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="ui" element={<Navigate to="/chat" replace />} />
        <Route path="ui/*" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
