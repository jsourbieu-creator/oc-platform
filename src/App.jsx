import { useState } from "react";
import "./index.css";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { NoClubScreen } from "@/pages/NoClubScreen";
import { HomePage } from "@/pages/HomePage";
import { TeamsPage } from "@/pages/TeamsPage";
import { MembersPage } from "@/pages/MembersPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AdminPage } from "@/pages/AdminPage";
import { DesignSystemPage } from "@/pages/DesignSystemPage";
import { VotePage } from "@/pages/VotePage";
import { ClassementsPage } from "@/pages/ClassementsPage";
import { TropheesPage } from "@/pages/TropheesPage";
import { StatistiquesPage } from "@/pages/StatistiquesPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { MediasPage } from "@/pages/MediasPage";
import { VestiairePage } from "@/pages/VestiairePage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DashboardShell } from "@/components/layout/DashboardShell";

function Root() {
  const [publicView, setPublicView] = useState("login"); // login | signup
  const [dashView, setDashView] = useState("home");
  const [pendingConversation, setPendingConversation] = useState(null);
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
      {dashView === "home" && <HomePage gotoConversation={(conv) => { setPendingConversation(conv); setDashView("messages"); }} />}
      {dashView === "equipes" && <TeamsPage />}
      {dashView === "membres" && <MembersPage />}
      {dashView === "profil" && <ProfilePage />}
      {dashView === "parametres" && <SettingsPage goto={setDashView} />}
      {dashView === "administration" && <AdminPage />}
      {dashView === "design-system" && <DesignSystemPage />}
      {dashView === "votes" && <VotePage />}
      {dashView === "classements" && <ClassementsPage />}
      {dashView === "trophees" && <TropheesPage />}
      {dashView === "statistiques" && <StatistiquesPage />}
      {dashView === "documents" && <DocumentsPage />}
      {dashView === "medias" && <MediasPage />}
      {dashView === "vestiaire" && <VestiairePage />}
      {dashView === "notifications" && <NotificationsPage goto={setDashView} />}
      {dashView === "messages" && <MessagesPage pendingConversation={pendingConversation} onConsumePending={() => setPendingConversation(null)} />}
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
