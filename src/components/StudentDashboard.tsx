import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Video, FileText, Briefcase, Users, ExternalLink, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Forum } from "@/components/Forum";

export function StudentDashboard({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const { refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [reviewToRead, setReviewToRead] = useState<string | null>(null);

  const { data: alumni } = useQuery({
    queryKey: ["alumni-by-domain", profile.domain],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id, name, domain, karma_points, verified")
        .eq("role", "alumni").eq("verified", true).eq("domain", profile.domain)
        .order("karma_points", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile.domain,
  });

  const { data: internships } = useQuery({
    queryKey: ["internships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internships").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myRequests } = useQuery({
    queryKey: ["my-requests-student", profile.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests").select("*, alumni:profiles!requests_alumni_id_fkey(name)")
        .eq("student_id", profile.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createRequest = useMutation({
    mutationFn: async ({ alumniId, type }: { alumniId: string; type: "mock_interview" | "resume_review" }) => {
      const { error } = await supabase.from("requests").insert({
        student_id: profile.id, alumni_id: alumniId, request_type: type, domain: profile.domain,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request sent!");
      qc.invalidateQueries({ queryKey: ["my-requests-student"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadResume = async (file: File) => {
    setUploading(true);
    const path = `${profile.id}/resume-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, { upsert: true });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error: updErr } = await supabase.from("profiles").update({ resume_url: path }).eq("id", profile.id);
    if (updErr) toast.error(updErr.message);
    else { toast.success("Resume uploaded"); await refreshProfile(); }
    setUploading(false);
  };

  return (
    <Tabs defaultValue="mentors" className="space-y-6">
      <TabsList>
        <TabsTrigger value="mentors"><Users className="mr-1.5 h-4 w-4" />Recommended alumni</TabsTrigger>
        <TabsTrigger value="requests">My requests</TabsTrigger>
        <TabsTrigger value="internships"><Briefcase className="mr-1.5 h-4 w-4" />Internships</TabsTrigger>
        <TabsTrigger value="resume"><FileText className="mr-1.5 h-4 w-4" />Resume</TabsTrigger>
        <TabsTrigger value="forum"><MessageSquare className="mr-1.5 h-4 w-4" />Forum</TabsTrigger>
      </TabsList>

      <TabsContent value="mentors" className="space-y-3">
        <p className="text-sm text-muted-foreground">Alumni in your domain: <Badge variant="secondary">{profile.domain || "set your domain"}</Badge></p>
        {alumni?.length === 0 && <Card>No matching alumni yet — check back soon.</Card>}
        {alumni?.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <div>
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.domain} · {a.karma_points} karma</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => createRequest.mutate({ alumniId: a.id, type: "resume_review" })}>
                Request review
              </Button>
              <Button size="sm" onClick={() => createRequest.mutate({ alumniId: a.id, type: "mock_interview" })}>
                <Video className="mr-1.5 h-4 w-4" />10-min interview
              </Button>
            </div>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="requests" className="space-y-3">
        {myRequests?.length === 0 && <Card>No requests yet.</Card>}
        {myRequests?.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium capitalize">{r.request_type.replace("_", " ")}</div>
                <div className="text-xs text-muted-foreground">With {r.alumni?.name} · <span className="capitalize">{r.status}</span></div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            {r.status === "accepted" && r.meeting_link && (
              <a href={r.meeting_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex">
                <Button size="sm" className="bg-gradient-hero shadow-elegant">
                  <Video className="mr-1.5 h-4 w-4" />Join Google Meet
                </Button>
              </a>
            )}
            {r.status === "completed" && r.review_text && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setReviewToRead(r.review_text)}>
                <FileText className="mr-1.5 h-4 w-4" />Read Review
              </Button>
            )}
          </div>
        ))}
      </TabsContent>

      <TabsContent value="internships" className="grid gap-3 md:grid-cols-2">
        {internships?.length === 0 && <Card>No internships posted yet.</Card>}
        {internships?.map((i) => (
          <div key={i.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <Badge variant="secondary" className="mb-2">{i.domain}</Badge>
            <div className="text-lg font-semibold">{i.title}</div>
            <div className="text-sm text-muted-foreground">{i.company}</div>
            {i.description && <p className="mt-2 text-sm">{i.description}</p>}
            {i.apply_link && (
              <a href={i.apply_link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline">
                Apply <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            )}
          </div>
        ))}
      </TabsContent>

      <TabsContent value="resume">
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-semibold">Upload resume</h3>
          <p className="mt-1 text-sm text-muted-foreground">PDF preferred. Alumni reviewing your requests can access it.</p>
          <div className="mt-4 flex items-center gap-3">
            <Label htmlFor="resume" className="cursor-pointer">
              <div className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />{uploading ? "Uploading…" : "Choose file"}
              </div>
              <Input id="resume" type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadResume(e.target.files[0])} disabled={uploading} />
            </Label>
            {profile.resume_url && <span className="text-xs text-success">✓ Resume on file</span>}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="forum">
        <Forum profile={profile} />
      </TabsContent>

      <Dialog open={!!reviewToRead} onOpenChange={(o) => !o && setReviewToRead(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resume Review Feedback</DialogTitle></DialogHeader>
          <div className="whitespace-pre-wrap text-sm text-foreground">{reviewToRead}</div>
        </DialogContent>
      </Dialog>
    </Tabs>
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

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

// satisfy unused import warning when Select isn't used here
void Select; void SelectContent; void SelectItem; void SelectTrigger; void SelectValue;
