import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Karma Leaderboard — AlumniConnect" }] }),
  component: Leaderboard,
});

function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, domain, karma_points")
        .eq("role", "alumni")
        .order("karma_points", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Trophy className="h-7 w-7 text-warning" /> Karma Leaderboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Top alumni mentors by karma points earned.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {data?.length === 0 && <div className="p-6 text-sm text-muted-foreground">No alumni yet.</div>}
        {data?.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between border-b border-border px-6 py-4 last:border-b-0">
            <div className="flex items-center gap-4">
              <div className={`grid h-9 w-9 place-items-center rounded-full font-semibold ${i < 3 ? "bg-gradient-hero text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < 3 ? <Medal className="h-4 w-4" /> : i + 1}
              </div>
              <div>
                <div className="font-medium">{p.name || "Anonymous"}</div>
                <div className="text-xs text-muted-foreground">{p.domain}</div>
              </div>
            </div>
            <div className="text-lg font-semibold tabular-nums">{p.karma_points}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
