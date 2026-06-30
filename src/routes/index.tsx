import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Briefcase, Trophy, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AlumniConnect — Mentorship between students & alumni" },
      { name: "description", content: "Connect with alumni for mock interviews, resume reviews, and internship opportunities." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border/40 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-hero text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </div>
            AlumniConnect
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm">Get started</Button></Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-card">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Trusted by students & alumni
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Where students meet <span className="bg-gradient-hero bg-clip-text text-transparent">alumni mentors.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Request 10-minute mock interviews, get your resume reviewed, and discover internships posted
          directly by alumni in your domain.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-hero shadow-elegant">
              Join AlumniConnect <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/auth"><Button size="lg" variant="outline">I'm an alumnus</Button></Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          { icon: Users, title: "1:1 Mentorship", body: "Match with alumni in your exact tech stack or domain." },
          { icon: Briefcase, title: "Internship board", body: "Hand-picked opportunities posted by verified alumni." },
          { icon: Trophy, title: "Karma rewards", body: "Alumni earn karma for every completed session — see the top mentors." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} AlumniConnect
      </footer>
    </div>
  );
}
