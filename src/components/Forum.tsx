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
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  const { data: posts } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, author:profiles!posts_author_id_fkey(name, role, domain), my_vote:post_votes(vote_value, user_id)")
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
    onMutate: async ({ postId, value }) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const previousPosts = qc.getQueryData(["posts"]);

      qc.setQueryData(["posts"], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map((post) => {
          if (post.id === postId) {
            const currentVote = post.userVote || 0;
            const diff = value - currentVote;
            return {
              ...post,
              score: post.score + diff,
              userVote: value,
            };
          }
          return post;
        });
      });

      return { previousPosts };
    },
    onError: (err, newVote, context: any) => {
      if (context?.previousPosts) {
        qc.setQueryData(["posts"], context.previousPosts);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
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
          <div key={post.id} className="rounded-xl border border-border bg-card p-4 shadow-card space-y-4">
            <div className="flex gap-4">
              {/* Voting Sidebar */}
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 transition-colors ${post.userVote === 1 ? 'text-orange-500 hover:text-orange-600' : 'text-muted-foreground hover:text-orange-500'}`}
                  onClick={() => votePost.mutate({ postId: post.id, value: post.userVote === 1 ? 0 : 1 })}
                >
                  <ArrowBigUp className={`h-6 w-6 transition-all ${post.userVote === 1 ? 'fill-orange-500 text-orange-500' : ''}`} />
                </Button>
                <span className="text-sm font-bold">{post.score}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 transition-colors ${post.userVote === -1 ? 'text-indigo-500 hover:text-indigo-600' : 'text-muted-foreground hover:text-indigo-500'}`}
                  onClick={() => votePost.mutate({ postId: post.id, value: post.userVote === -1 ? 0 : -1 })}
                >
                  <ArrowBigDown className={`h-6 w-6 transition-all ${post.userVote === -1 ? 'fill-indigo-500 text-indigo-500' : ''}`} />
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
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 gap-2 text-xs" 
                    onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                  >
                    <MessageSquare className="h-4 w-4" /> Discuss
                  </Button>
                </div>
              </div>
            </div>

            {/* Collapsible inline comment section */}
            {expandedPostId === post.id && (
              <div className="border-t pt-4 pl-4 md:pl-12">
                <PostCommentsSection postId={post.id} profile={profile} />
              </div>
            )}
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
    </div>
  );
}

function PostCommentsSection({ postId, profile }: { postId: string; profile: Profile }) {
  const qc = useQueryClient();

  const { data: comments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles!comments_author_id_fkey(name, role, domain), my_vote:comment_votes(vote_value, user_id)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data?.map(c => ({
        ...c,
        userVote: c.my_vote?.find((v: any) => v.user_id === profile.id)?.vote_value || 0
      })) || [];
    },
  });

  const createComment = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: profile.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const voteComment = useMutation({
    mutationFn: async ({ commentId, value }: { commentId: string; value: number }) => {
      if (value === 0) {
        const { error } = await supabase.from("comment_votes").delete().eq("comment_id", commentId).eq("user_id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comment_votes").upsert({
          comment_id: commentId,
          user_id: profile.id,
          vote_value: value,
        }, { onConflict: "comment_id,user_id" });
        if (error) throw error;
      }
    },
    onMutate: async ({ commentId, value }) => {
      await qc.cancelQueries({ queryKey: ["comments", postId] });
      const previousComments = qc.getQueryData(["comments", postId]);

      qc.setQueryData(["comments", postId], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map((c) => {
          if (c.id === commentId) {
            const currentVote = c.userVote || 0;
            const diff = value - currentVote;
            return {
              ...c,
              score: (c.score || 0) + diff,
              userVote: value,
            };
          }
          return c;
        });
      });

      return { previousComments };
    },
    onError: (err, newVote, context: any) => {
      if (context?.previousComments) {
        qc.setQueryData(["comments", postId], context.previousComments);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
    },
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
    <div className="space-y-4">
      <h4 className="font-semibold text-sm">Comments</h4>
      {comments?.length === 0 && <div className="text-sm text-muted-foreground">No comments yet.</div>}
      <div className="space-y-3">
        {comments?.map(c => (
          <div key={c.id} className="flex gap-3 rounded-lg bg-muted/40 p-3 text-sm">
            {/* Comment Vote buttons */}
            <div className="flex flex-col items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 transition-colors ${c.userVote === 1 ? 'text-orange-500 hover:text-orange-600' : 'text-muted-foreground hover:text-orange-500'}`}
                onClick={() => voteComment.mutate({ commentId: c.id, value: c.userVote === 1 ? 0 : 1 })}
              >
                <ArrowBigUp className={`h-4 w-4 transition-all ${c.userVote === 1 ? 'fill-orange-500 text-orange-500' : ''}`} />
              </Button>
              <span className="text-xs font-bold">{c.score || 0}</span>
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 transition-colors ${c.userVote === -1 ? 'text-indigo-500 hover:text-indigo-600' : 'text-muted-foreground hover:text-indigo-500'}`}
                onClick={() => voteComment.mutate({ commentId: c.id, value: c.userVote === -1 ? 0 : -1 })}
              >
                <ArrowBigDown className={`h-4 w-4 transition-all ${c.userVote === -1 ? 'fill-indigo-500 text-indigo-500' : ''}`} />
              </Button>
            </div>

            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground font-medium">{c.author?.name}</strong> 
                  {c.author?.role === 'alumni' && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Alumnus</span>}
                </span>
                <span>{formatDistanceToNow(new Date(c.created_at))} ago</span>
              </div>
              <div className="whitespace-pre-wrap">{c.content}</div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
        <Textarea name="content" placeholder="Write a comment..." className="min-h-[80px]" required />
        <Button type="submit" disabled={createComment.isPending} className="self-end">Submit</Button>
      </form>
    </div>
  );
}
