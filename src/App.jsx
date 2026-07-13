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
import { DashboardShell } from "@/components/layout/DashboardShell";

function Root() {
  const [publicView, setPublicView] = useState("login"); // login | signup
  const [dashView, setDashView] = useState("home");
  const { loading, token, user, memberships } = useAuth();

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
