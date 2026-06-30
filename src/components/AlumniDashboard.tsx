import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Inbox, Briefcase, CheckCircle2, Video, FileText, Download, MessageSquare } from "lucide-react";
import { Forum } from "@/components/Forum";

export function AlumniDashboard({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState("");

  const { data: requests } = useQuery({
    queryKey: ["alumni-requests", profile.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*, student:profiles!requests_student_id_fkey(name, resume_url)")
        .eq("alumni_id", profile.id).eq("domain", profile.domain)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const updateRequest = useMutation({
    mutationFn: async (vars: { id: string; status: "accepted" | "completed" | "rejected"; meeting_link?: string; review_text?: string }) => {
      const payload: any = { status: vars.status };
      if (vars.meeting_link !== undefined) payload.meeting_link = vars.meeting_link;
      if (vars.review_text !== undefined) payload.review_text = vars.review_text;
      const { error } = await supabase.from("requests").update(payload).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alumni-requests"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const acceptWithLink = async (id: string, type: string) => {
    if (type === "mock_interview") {
      setAcceptingId(id);
      setMeetingLink("");
    } else {
      await updateRequest.mutateAsync({ id, status: "accepted" });
      toast.success("Request accepted");
    }
  };

  const confirmAccept = async () => {
    if (!meetingLink.trim() || !meetingLink.startsWith("http")) {
      toast.error("Please paste a valid Google Meet link");
      return;
    }
    await updateRequest.mutateAsync({ id: acceptingId!, status: "accepted", meeting_link: meetingLink.trim() });
    toast.success("Accepted — student notified with meeting link");
    setAcceptingId(null);
  };

  const submitReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const reviewText = String(fd.get("review_text")).trim();
    if (!reviewText) { toast.error("Review cannot be empty"); return; }
    await updateRequest.mutateAsync({ id: reviewingId!, status: "completed", review_text: reviewText });
    toast.success("Review submitted and request marked as completed");
    setReviewingId(null);
  };

  const postInternship = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("internships").insert({
      title: String(fd.get("title")),
      company: String(fd.get("company")),
      domain: String(fd.get("domain") || profile.domain),
      description: String(fd.get("description") || ""),
      apply_link: String(fd.get("apply_link") || ""),
      posted_by: profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Internship posted");
      (e.target as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["internships"] });
    }
  };

  if (!profile.verified) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-6">
        <h3 className="font-semibold">Verification pending</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your alumni account is awaiting moderator approval. You'll get full access once verified.
        </p>
      </div>
    );
  }

  const renderRequestCard = (r: any) => (
    <div key={r.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium capitalize">{r.request_type.replace("_", " ")}</div>
          <div className="text-xs text-muted-foreground">From {r.student?.name || "Student"}</div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.request_type === "resume_review" && r.student?.resume_url && (
          <Button size="sm" variant="outline" onClick={async () => {
            const { data } = await supabase.storage.from("resumes").createSignedUrl(r.student.resume_url, 300);
            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
          }}>
            <FileText className="mr-1.5 h-4 w-4" />View resume
          </Button>
        )}
        {r.status === "pending" && (
          <>
            <Button size="sm" onClick={() => acceptWithLink(r.id, r.request_type)}>Accept</Button>
            <Button size="sm" variant="outline" onClick={() => updateRequest.mutate({ id: r.id, status: "rejected" })}>Reject</Button>
          </>
        )}
        {r.status === "accepted" && (
          <>
            {r.request_type === "mock_interview" && r.meeting_link && (
              <a href={r.meeting_link} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline"><Video className="mr-1.5 h-4 w-4" />Open Meet</Button>
              </a>
            )}
            {r.request_type === "mock_interview" ? (
              <Button size="sm" onClick={() => updateRequest.mutate({ id: r.id, status: "completed" })}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />Mark completed (+10 karma)
              </Button>
            ) : (
              <Button size="sm" onClick={() => setReviewingId(r.id)}>
                <FileText className="mr-1.5 h-4 w-4" />Write Review to Complete
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Tabs defaultValue="inbox" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox"><Inbox className="mr-1.5 h-4 w-4" />Incoming requests</TabsTrigger>
          <TabsTrigger value="post"><Briefcase className="mr-1.5 h-4 w-4" />Post internship</TabsTrigger>
          <TabsTrigger value="forum"><MessageSquare className="mr-1.5 h-4 w-4" />Forum</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Incoming Requests</h3>
            <p className="text-sm text-muted-foreground">Filtered to your domain: <Badge variant="secondary">{profile.domain}</Badge></p>
          </div>
          
          <div className="space-y-3">
            {requests?.filter(r => r.status === "pending" || (r.status === "accepted" && r.request_type === "resume_review")).length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                No incoming requests.
              </div>
            )}
            {requests?.filter(r => r.status === "pending" || (r.status === "accepted" && r.request_type === "resume_review")).map(renderRequestCard)}
          </div>
        </TabsContent>

        <TabsContent value="post">
          <form onSubmit={postInternship} className="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-card md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label htmlFor="title">Job title</Label><Input id="title" name="title" required maxLength={120} /></div>
            <div className="space-y-2"><Label htmlFor="company">Company</Label><Input id="company" name="company" required maxLength={120} /></div>
            <div className="space-y-2"><Label htmlFor="domain">Domain</Label><Input id="domain" name="domain" defaultValue={profile.domain} required maxLength={80} /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="apply_link">Apply link</Label><Input id="apply_link" name="apply_link" type="url" /></div>
            <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" rows={4} maxLength={2000} /></div>
            <div className="md:col-span-2"><Button type="submit"><Briefcase className="mr-1.5 h-4 w-4" />Post internship</Button></div>
          </form>
        </TabsContent>

        <TabsContent value="forum">
          <Forum profile={profile} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!acceptingId} onOpenChange={(o) => !o && setAcceptingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Paste Google Meet link</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="meet">Meeting URL</Label>
            <Input id="meet" placeholder="https://meet.google.com/abc-defg-hij" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
            <p className="text-xs text-muted-foreground">The student will see a "Join Google Meet" button on their request.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptingId(null)}>Cancel</Button>
            <Button onClick={confirmAccept}>Accept & send link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewingId} onOpenChange={(o) => !o && setReviewingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Write Resume Review</DialogTitle></DialogHeader>
          <form onSubmit={submitReview} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review_text">Feedback</Label>
              <Textarea id="review_text" name="review_text" rows={5} placeholder="Provide constructive feedback..." required />
              <p className="text-xs text-muted-foreground">This review will be shared with the student and the request will be marked as completed (+10 karma).</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReviewingId(null)}>Cancel</Button>
              <Button type="submit">Submit Review & Complete</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
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

void Download;
