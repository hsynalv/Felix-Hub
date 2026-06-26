import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const TodayPage = lazy(() => import("@/pages/TodayPage").then((m) => ({ default: m.TodayPage })));
const SystemDashboardPage = lazy(() =>
  import("@/pages/SystemDashboardPage").then((m) => ({ default: m.SystemDashboardPage }))
);
const ChatPage = lazy(() => import("@/pages/ChatPage").then((m) => ({ default: m.ChatPage })));
const ToolsPage = lazy(() => import("@/pages/ToolsPage").then((m) => ({ default: m.ToolsPage })));
const PluginsPage = lazy(() => import("@/pages/PluginsPage").then((m) => ({ default: m.PluginsPage })));
const AuditPage = lazy(() => import("@/pages/AuditPage").then((m) => ({ default: m.AuditPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const ObservabilityPage = lazy(() => import("@/pages/ObservabilityPage").then((m) => ({ default: m.ObservabilityPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const UsagePage = lazy(() => import("@/pages/UsagePage").then((m) => ({ default: m.UsagePage })));
const RunsPage = lazy(() => import("@/pages/RunsPage").then((m) => ({ default: m.RunsPage })));
const WorkflowDesignerPage = lazy(() =>
  import("@/pages/WorkflowDesignerPage").then((m) => ({ default: m.WorkflowDesignerPage }))
);
const ApprovalCenterPage = lazy(() =>
  import("@/pages/ApprovalCenterPage").then((m) => ({ default: m.ApprovalCenterPage }))
);
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const BrainPage = lazy(() => import("@/pages/BrainPage").then((m) => ({ default: m.BrainPage })));
const IntentTrainingPage = lazy(() =>
  import("@/pages/IntentTrainingPage").then((m) => ({ default: m.IntentTrainingPage }))
);
const EvalStudioPage = lazy(() =>
  import("@/pages/EvalStudioPage").then((m) => ({ default: m.EvalStudioPage }))
);
const RunbooksPage = lazy(() =>
  import("@/pages/RunbooksPage").then((m) => ({ default: m.RunbooksPage }))
);
const V6EcosystemPage = lazy(() =>
  import("@/pages/V6EcosystemPage").then((m) => ({ default: m.V6EcosystemPage }))
);
const InboxPage = lazy(() => import("@/pages/InboxPage").then((m) => ({ default: m.InboxPage })));
const LifeAgentsPage = lazy(() =>
  import("@/pages/LifeAgentsPage").then((m) => ({ default: m.LifeAgentsPage }))
);
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="life" element={<LifeAgentsPage />} />
            <Route path="system" element={<SystemDashboardPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="tools" element={<ToolsPage />} />
            <Route path="plugins" element={<PluginsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="approvals" element={<ApprovalCenterPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="observability" element={<ObservabilityPage />} />
            <Route path="usage" element={<UsagePage />} />
            <Route path="eval" element={<EvalStudioPage />} />
            <Route path="ops" element={<RunbooksPage />} />
            <Route path="v6" element={<V6EcosystemPage />} />
            <Route path="runs" element={<RunsPage />} />
            <Route path="workflows/designer" element={<WorkflowDesignerPage />} />
            <Route path="workflows/designer/:id" element={<WorkflowDesignerPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectKey" element={<ProjectsPage />} />
            <Route path="brain" element={<BrainPage />} />
            <Route path="intent-training" element={<IntentTrainingPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="ui" element={<Navigate to="/chat" replace />} />
        <Route path="ui/*" element={<Navigate to="/chat" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
