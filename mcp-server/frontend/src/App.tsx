import { lazy } from "react";
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="plugins" element={<PluginsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="approvals" element={<AdminPage defaultTab="approvals" />} />
          <Route path="observability" element={<ObservabilityPage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="brain" element={<BrainPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="ui" element={<Navigate to="/chat" replace />} />
        <Route path="ui/*" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
