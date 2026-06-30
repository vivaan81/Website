import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShieldCheck, GraduationCap, Briefcase, MessageSquare, Trash2 } from "lucide-react";

export function ModeratorDashboard() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["mod-stats"],
    queryFn: async () => {
      const [students, alumni, requests, internships] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "alumni"),
        supabase.from("requests").select("id", { count: "exact", head: true }),
        supabase.from("internships").select("id", { count: "exact", head: true }),
      ]);
      return {
        students: students.count ?? 0,
        alumni: alumni.count ?? 0,
        requests: requests.count ?? 0,
        internships: internships.count ?? 0,
      };
    },
  });

  const { data: pending } = useQuery({
    queryKey: ["pending-alumni"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles").select("id, name, domain, created_at")
        .eq("role", "alumni").eq("verified", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const verify = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      if (approve) {
        const { error } = await supabase.from("profiles").update({ verified: true }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profiles").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.approve ? "Alumni approved" : "Alumni rejected");
      qc.invalidateQueries({ queryKey: ["pending-alumni"] });
      qc.invalidateQueries({ queryKey: ["mod-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: modPosts } = useQuery({
    queryKey: ["mod-posts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*, author:profiles!posts_author_id_fkey(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: modComments } = useQuery({
    queryKey: ["mod-comments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comments").select("*, post:posts(title), author:profiles!comments_author_id_fkey(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      qc.invalidateQueries({ queryKey: ["mod-posts"] });
      qc.invalidateQueries({ queryKey: ["mod-comments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment deleted");
      qc.invalidateQueries({ queryKey: ["mod-comments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cards = [
    { label: "Students", value: stats?.students ?? 0, icon: GraduationCap },
    { label: "Alumni", value: stats?.alumni ?? 0, icon: Users },
    { label: "Total requests", value: stats?.requests ?? 0, icon: ShieldCheck },
    { label: "Internships", value: stats?.internships ?? 0, icon: Briefcase },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="verification">
        <TabsList>
          <TabsTrigger value="verification"><ShieldCheck className="mr-1.5 h-4 w-4" />Verification</TabsTrigger>
          <TabsTrigger value="forum"><MessageSquare className="mr-1.5 h-4 w-4" />Forum</TabsTrigger>
        </TabsList>

        <TabsContent value="verification" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-semibold">Alumni verification queue</h2>
              <p className="text-xs text-muted-foreground">{pending?.length ?? 0} pending</p>
            </div>
            {pending?.length === 0 && <div className="p-6 text-sm text-muted-foreground">All caught up.</div>}
            {pending?.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-border px-6 py-4 last:border-b-0">
                <div>
                  <div className="font-medium">{a.name || "Unnamed alumnus"}</div>
                  <div className="text-xs text-muted-foreground">{a.domain} · joined {new Date(a.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => verify.mutate({ id: a.id, approve: false })}>Reject</Button>
                  <Button size="sm" onClick={() => verify.mutate({ id: a.id, approve: true })}>Approve</Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="forum" className="mt-4 space-y-6">
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-6 py-4"><h2 className="font-semibold">Recent Posts</h2></div>
            {modPosts?.length === 0 && <div className="p-6 text-sm text-muted-foreground">No posts found.</div>}
            {modPosts?.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-border px-6 py-4 last:border-b-0">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">By {p.author?.name} · Score: {p.score}</div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deletePost.mutate(p.id)}><Trash2 className="h-4 w-4 mr-1.5" />Delete</Button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-6 py-4"><h2 className="font-semibold">Recent Comments</h2></div>
            {modComments?.length === 0 && <div className="p-6 text-sm text-muted-foreground">No comments found.</div>}
            {modComments?.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-border px-6 py-4 last:border-b-0">
                <div className="max-w-[70%]">
                  <div className="font-medium truncate">{c.content}</div>
                  <div className="text-xs text-muted-foreground">By {c.author?.name} on "{c.post?.title}"</div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deleteComment.mutate(c.id)}><Trash2 className="h-4 w-4 mr-1.5" />Delete</Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
