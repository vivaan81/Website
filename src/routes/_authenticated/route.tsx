import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { GraduationCap, Trophy, LayoutDashboard, LogOut } from "lucide-react";
import { PastRequestsModal } from "@/components/PastRequestsModal";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border/40 bg-background/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-hero text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </div>
            AlumniConnect
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm"><LayoutDashboard className="mr-1.5 h-4 w-4" />Dashboard</Button>
            </Link>
            {profile?.role === "alumni" && <PastRequestsModal profile={profile} />}
            <Link to="/leaderboard">
              <Button variant="ghost" size="sm"><Trophy className="mr-1.5 h-4 w-4" />Leaderboard</Button>
            </Link>
            <div className="mx-2 hidden text-xs text-muted-foreground sm:block">
              {profile?.name || user.email} · <span className="capitalize">{profile?.role}</span>
            </div>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="mr-1.5 h-4 w-4" />Sign out
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
