import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowBigUp, ArrowBigDown, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export function Forum({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [expandedPost, setExpandedPost] = useState<any | null>(null);

  const { data: posts } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, author:profiles!posts_author_id_fkey(name, role, domain), my_vote:post_votes(vote_value)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data?.map(post => ({
        ...post,
        userVote: post.my_vote?.find((v: any) => v.user_id === profile.id)?.vote_value || 0
      })) || [];
    },
  });

  const createPost = useMutation({
    mutationFn: async (vars: { title: string; content: string }) => {
      const { error } = await supabase.from("posts").insert({
        author_id: profile.id,
        title: vars.title,
        content: vars.content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post created");
      qc.invalidateQueries({ queryKey: ["posts"] });
      setCreating(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const votePost = useMutation({
    mutationFn: async ({ postId, value }: { postId: string; value: number }) => {
      if (value === 0) {
        const { error } = await supabase.from("post_votes").delete().eq("post_id", postId).eq("user_id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_votes").upsert({
          post_id: postId,
          user_id: profile.id,
          vote_value: value,
        }, { onConflict: "post_id,user_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCreatePost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createPost.mutate({
      title: String(fd.get("title")),
      content: String(fd.get("content")),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Q&A Forum</h2>
          <p className="text-sm text-muted-foreground">Ask questions and discuss with alumni and students.</p>
        </div>
        {profile.role === "student" && (
          <Button onClick={() => setCreating(true)}>Create Post</Button>
        )}
      </div>

      <div className="space-y-4">
        {posts?.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            No posts yet. Be the first to start a discussion!
          </div>
        )}
        {posts?.map((post) => (
          <div key={post.id} className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
            {/* Voting Sidebar */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${post.userVote === 1 ? 'text-orange-500' : 'text-muted-foreground'}`}
                onClick={() => votePost.mutate({ postId: post.id, value: post.userVote === 1 ? 0 : 1 })}
              >
                <ArrowBigUp className="h-6 w-6" />
              </Button>
              <span className="text-sm font-bold">{post.score}</span>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${post.userVote === -1 ? 'text-indigo-500' : 'text-muted-foreground'}`}
                onClick={() => votePost.mutate({ postId: post.id, value: post.userVote === -1 ? 0 : -1 })}
              >
                <ArrowBigDown className="h-6 w-6" />
              </Button>
            </div>
            
            {/* Post Content */}
            <div className="flex-1 space-y-2">
              <div className="text-xs text-muted-foreground">
                Posted by {post.author?.name} · {post.author?.role} {post.author?.domain ? `(${post.author.domain})` : ""} · {formatDistanceToNow(new Date(post.created_at))} ago
              </div>
              <h3 className="text-lg font-semibold">{post.title}</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{post.content}</p>
              
              <div className="pt-2">
                <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs" onClick={() => setExpandedPost(post)}>
                  <MessageSquare className="h-4 w-4" /> Discuss
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create a Post</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePost} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">Title</label>
              <Input id="title" name="title" required maxLength={150} />
            </div>
            <div className="space-y-2">
              <label htmlFor="content" className="text-sm font-medium">Content</label>
              <Textarea id="content" name="content" required rows={5} maxLength={2000} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" disabled={createPost.isPending}>Post</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {expandedPost && (
        <PostCommentsDialog post={expandedPost} profile={profile} onClose={() => setExpandedPost(null)} />
      )}
    </div>
  );
}

function PostCommentsDialog({ post, profile, onClose }: { post: any; profile: Profile; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: comments } = useQuery({
    queryKey: ["comments", post.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles!comments_author_id_fkey(name, role, domain)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createComment = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("comments").insert({
        post_id: post.id,
        author_id: profile.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", post.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAddComment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const content = String(fd.get("content")).trim();
    if (!content) return;
    createComment.mutate(content);
    (e.target as HTMLFormElement).reset();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="text-xs text-muted-foreground">
            Posted by {post.author?.name}
          </div>
          <DialogTitle className="text-xl">{post.title}</DialogTitle>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm text-foreground mb-4">
          {post.content}
        </div>
        
        <div className="space-y-4 border-t pt-4">
          <h4 className="font-semibold text-sm">Comments</h4>
          {comments?.length === 0 && <div className="text-sm text-muted-foreground">No comments yet.</div>}
          <div className="space-y-4">
            {comments?.map(c => (
              <div key={c.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground font-medium">{c.author?.name}</strong> 
                    {c.author?.role === 'alumni' && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Alumnus</span>}
                  </span>
                  <span>{formatDistanceToNow(new Date(c.created_at))} ago</span>
                </div>
                <div className="whitespace-pre-wrap">{c.content}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
            <Textarea name="content" placeholder="Write a comment..." className="min-h-[80px]" required />
            <Button type="submit" disabled={createComment.isPending} className="self-end">Submit</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
