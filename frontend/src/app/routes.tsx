import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { HackathonListPage } from "../pages/HackathonListPage";
import { TeamPage } from "../pages/TeamPage";
import { HackathonDetailPage } from "../pages/HackathonDetailPage";
import { ResultsPage } from "../pages/ResultsPage";
import { OrganizerPage } from "../pages/OrganizerPage";
import { OrganizerTeamsPage } from "../pages/OrganizerTeamsPage";
import { JuryPage } from "../pages/JuryPage";
import { getToken } from "../lib/api";
import { ReactNode } from "react";

const isAuthenticated = () => Boolean(getToken());

const ProtectedRoute = ({ children, role }: { children: ReactNode; role?: string[] }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (role) {
    const userRaw = localStorage.getItem("user_session");
    if (userRaw) {
      try {
        const u = JSON.parse(userRaw) as { role?: string };
        if (u.role && !role.includes(u.role)) {
          return <Navigate to="/" replace />;
        }
      } catch {
        return <Navigate to="/login" replace />;
      }
    }
  }
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: DashboardPage },
      { path: "hackathons", Component: HackathonListPage },
      { path: "hackathons/:id", Component: HackathonDetailPage },
      {
        path: "teams",
        element: (
          <ProtectedRoute role={["participant"]}>
            <TeamPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "results",
        element: (
          <ProtectedRoute role={["participant"]}>
            <ResultsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "organizer",
        element: (
          <ProtectedRoute role={["organizer"]}>
            <OrganizerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "manage-teams",
        element: (
          <ProtectedRoute role={["organizer"]}>
            <OrganizerTeamsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "jury",
        element: (
          <ProtectedRoute role={["jury", "organizer"]}>
            <JuryPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
