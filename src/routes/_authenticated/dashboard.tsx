import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { StudentDashboard } from "@/components/StudentDashboard";
import { AlumniDashboard } from "@/components/AlumniDashboard";
import { ModeratorDashboard } from "@/components/ModeratorDashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AlumniConnect" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  if (!profile) return <div className="text-muted-foreground">Loading profile…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {profile.name || "there"}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="capitalize">{profile.role}</span> · {profile.domain || "No domain set"} ·{" "}
          <span className="text-foreground">{profile.karma_points} karma</span>
        </p>
      </div>
      {profile.role === "student" && <StudentDashboard profile={profile} />}
      {profile.role === "alumni" && <AlumniDashboard profile={profile} />}
      {profile.role === "moderator" && <ModeratorDashboard />}
    </div>
  );
}
