import { useState } from "react";
import "./index.css";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { NoClubScreen } from "@/pages/NoClubScreen";
import { DashboardHome } from "@/pages/DashboardHome";
import { PlusPage } from "@/pages/PlusPage";
import { TeamsPage } from "@/pages/TeamsPage";
import { MembersPage } from "@/pages/MembersPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AdminPage } from "@/pages/AdminPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { EventsPage } from "@/pages/EventsPage";
import { AvailabilityPage } from "@/pages/AvailabilityPage";
import { ConvocationsPage } from "@/pages/ConvocationsPage";
import { VestiairePage } from "@/pages/VestiairePage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DashboardShell } from "@/components/layout/DashboardShell";

function Root() {
  const [publicView, setPublicView] = useState("login"); // login | signup
  const [dashView, setDashView] = useState("home");
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset"));
  const { loading, token, user, memberships } = useAuth();

  if (resetToken) {
    return (
      <ResetPasswordPage
        token={resetToken}
        done={() => {
          window.history.replaceState({}, "", window.location.pathname);
          setResetToken(null);
          setPublicView("login");
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="auth-screen"><div className="spinner" /></div>
    );
  }

  if (!token || !user) {
    return publicView === "signup"
      ? <SignupPage goto={setPublicView} />
      : <LoginPage goto={setPublicView} />;
  }

  if (memberships.length === 0) {
    return <NoClubScreen />;
  }

  return (
    <DashboardShell view={dashView} goto={setDashView}>
      {dashView === "home" && <DashboardHome />}
      {dashView === "plus" && <PlusPage goto={setDashView} />}
      {dashView === "equipes" && <TeamsPage />}
      {dashView === "membres" && <MembersPage />}
      {dashView === "profil" && <ProfilePage />}
      {dashView === "parametres" && <SettingsPage />}
      {dashView === "administration" && <AdminPage />}
      {dashView === "calendrier" && <CalendarPage />}
      {dashView === "evenements" && <EventsPage goto={setDashView} />}
      {dashView === "disponibilites" && <AvailabilityPage />}
      {dashView === "convocations" && <ConvocationsPage goto={setDashView} />}
      {dashView === "vestiaire" && <VestiairePage />}
      {dashView === "notifications" && <NotificationsPage goto={setDashView} />}
      {dashView === "messages" && <MessagesPage />}
    </DashboardShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
