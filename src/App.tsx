import type { ComponentType } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AuthProvider } from "./lib/auth";
import { PublicLayout } from "./components/PublicLayout";
import { RouteError } from "./components/RouteError";
import { PageLoading } from "./components/PageLoading";
import { HomePage } from "./pages/public/Home";

/**
 * Only the home page is in the first download. Every other page is fetched when someone opens it,
 * so phones load the site faster. (The installed app keeps them all for offline use.)
 */
const page =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) =>
  async () => ({ Component: (await load())[name] as ComponentType });

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoading />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/churches", lazy: page(() => import("./pages/public/Churches"), "ChurchesPage") },
      { path: "/policies", lazy: page(() => import("./pages/public/Policies"), "PoliciesPage") },
      { path: "/past-leaders", lazy: page(() => import("./pages/public/PastLeaders"), "PastLeadersPage") },
      { path: "/policies/:slug", lazy: page(() => import("./pages/public/Policies"), "PolicyPage") },
      { path: "/login", lazy: page(() => import("./pages/public/AuthPages"), "LoginPage") },
      { path: "/register", lazy: page(() => import("./pages/public/Register"), "RegisterPage") },
      { path: "/forgot-password", lazy: page(() => import("./pages/public/AuthPages"), "ForgotPasswordPage") },
      { path: "/reset-password", lazy: page(() => import("./pages/public/AuthPages"), "ResetPasswordPage") },
      { path: "*", lazy: page(() => import("./pages/public/NotFound"), "NotFoundPage") },
    ],
  },
  {
    path: "/app",
    lazy: page(() => import("./components/PortalLayout"), "PortalLayout"),
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoading />,
    children: [
      { index: true, lazy: page(() => import("./pages/portal/Overview"), "OverviewPage") },
      { path: "announcements", lazy: page(() => import("./pages/portal/AnnouncementsPage"), "AnnouncementsPage") },
      { path: "churches", lazy: page(() => import("./pages/portal/ChurchesPortal"), "ChurchesPortalPage") },
      { path: "documents", lazy: page(() => import("./pages/portal/Documents"), "DocumentsPage") },
      { path: "profile", lazy: page(() => import("./pages/portal/Profile"), "ProfilePage") },
      { path: "leadership", lazy: page(() => import("./pages/portal/MyLeadership"), "MyLeadershipPage") },
      { path: "past-leadership", lazy: page(() => import("./pages/portal/MyLeadership"), "MyPastLeadershipPage") },
      { path: "settings", lazy: page(() => import("./pages/portal/Settings"), "SettingsPage") },
      { path: "feedback", lazy: page(() => import("./pages/portal/Feedback"), "FeedbackPage") },
      { path: "leaders", lazy: page(() => import("./pages/portal/Leaders"), "LeadersPage") },
      { path: "members", lazy: page(() => import("./pages/portal/Members"), "MembersPage") },
      { path: "admin", lazy: page(() => import("./pages/portal/Admin"), "AdminPage") },
      { path: "admin/directory", lazy: page(() => import("./pages/portal/AdminDirectory"), "AdminDirectoryPage") },
      { path: "admin/activity", lazy: page(() => import("./pages/portal/AdminLogs"), "ActivityLogPage") },
      { path: "admin/errors", lazy: page(() => import("./pages/portal/AdminLogs"), "ErrorLogPage") },
      // old address: /app/admin/logs?tab=errors
      { path: "admin/logs", lazy: page(() => import("./pages/portal/AdminLogs"), "OldLogsRedirect") },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
