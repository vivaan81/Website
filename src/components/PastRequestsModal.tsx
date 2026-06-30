import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Video, FileText, Clock, FileClock } from "lucide-react";
import { toast } from "sonner";

export function PastRequestsModal({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: requests } = useQuery({
    queryKey: ["past-alumni-requests", profile.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, student:profiles!requests_student_id_fkey(name)")
        .eq("alumni_id", profile.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const updateRequest = useMutation({
    mutationFn: async (vars: { id: string; status: "completed" }) => {
      const { error } = await supabase.from("requests").update({ status: vars.status }).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["past-alumni-requests"] });
      qc.invalidateQueries({ queryKey: ["alumni-requests"] }); // invalidate dashboard too
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Filter for past requests:
  // - Completed
  // - Rejected
  // - Accepted (only if it's a mock_interview)
  const pastRequests = requests?.filter(
    (r) =>
      r.status === "completed" ||
      r.status === "rejected" ||
      (r.status === "accepted" && r.request_type === "mock_interview")
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FileClock className="mr-1.5 h-4 w-4" />
          Past Requests
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Past Requests</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {pastRequests?.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">No past requests.</div>
          )}
          {pastRequests?.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium capitalize">{r.request_type.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">From {r.student?.name || "Student"}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              
              {r.status === "accepted" && r.request_type === "mock_interview" && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                  {r.meeting_link && (
                    <a href={r.meeting_link} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline"><Video className="mr-1.5 h-4 w-4" />Open Meet</Button>
                    </a>
                  )}
                  <Button size="sm" onClick={() => updateRequest.mutate({ id: r.id, status: "completed" })}>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />Mark completed (+10 karma)
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning-foreground border-warning/30",
    accepted: "bg-success/15 text-success border-success/30",
    completed: "bg-muted text-muted-foreground border-border",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${map[status]}`}>{status}</span>;
}
