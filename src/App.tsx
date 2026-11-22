import { createBrowserRouter, RouterProvider } from "react-router";
import { AuthProvider } from "./lib/auth";
import { PublicLayout } from "./components/PublicLayout";
import { PortalLayout } from "./components/PortalLayout";
import { HomePage } from "./pages/public/Home";
import { ChurchesPage } from "./pages/public/Churches";
import { PoliciesPage, PolicyPage } from "./pages/public/Policies";
import { LoginPage, ForgotPasswordPage, ResetPasswordPage } from "./pages/public/AuthPages";
import { RegisterPage } from "./pages/public/Register";
import { NotFoundPage } from "./pages/public/NotFound";
import { OverviewPage } from "./pages/portal/Overview";
import { AnnouncementsPage } from "./pages/portal/AnnouncementsPage";
import { ChurchesPortalPage } from "./pages/portal/ChurchesPortal";
import { DocumentsPage } from "./pages/portal/Documents";
import { ProfilePage } from "./pages/portal/Profile";
import { FeedbackPage } from "./pages/portal/Feedback";
import { LeadersPage } from "./pages/portal/Leaders";
import { MembersPage } from "./pages/portal/Members";
import { AdminPage } from "./pages/portal/Admin";

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/churches", element: <ChurchesPage /> },
      { path: "/policies", element: <PoliciesPage /> },
      { path: "/policies/:slug", element: <PolicyPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "/app",
    element: <PortalLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "announcements", element: <AnnouncementsPage /> },
      { path: "churches", element: <ChurchesPortalPage /> },
      { path: "documents", element: <DocumentsPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "feedback", element: <FeedbackPage /> },
      { path: "leaders", element: <LeadersPage /> },
      { path: "members", element: <MembersPage /> },
      { path: "admin", element: <AdminPage /> },
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
