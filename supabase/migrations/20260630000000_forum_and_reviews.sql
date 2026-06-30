-- Add review text to requests
ALTER TABLE public.requests ADD COLUMN review_text TEXT;

-- Posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts viewable by authenticated" ON public.posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Students can insert posts" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND public.has_role(auth.uid(), 'student'));
CREATE POLICY "Authors can update their posts" ON public.posts
  FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Moderators and Authors can delete posts" ON public.posts
  FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'moderator'));

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated" ON public.comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert comments" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their comments" ON public.comments
  FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Moderators and Authors can delete comments" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'moderator'));

-- Post Votes table
CREATE TABLE public.post_votes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_value INT NOT NULL CHECK (vote_value = 1 OR vote_value = -1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_votes TO authenticated;
GRANT ALL ON public.post_votes TO service_role;
ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes viewable by authenticated" ON public.post_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can vote" ON public.post_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update their vote" ON public.post_votes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete their vote" ON public.post_votes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger to update post score and author karma when votes are added/changed/deleted
CREATE OR REPLACE FUNCTION public.handle_post_vote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  post_author_id UUID;
  vote_diff INT;
BEGIN
  -- Get the author of the post
  IF TG_OP = 'DELETE' THEN
    SELECT author_id INTO post_author_id FROM public.posts WHERE id = OLD.post_id;
  ELSE
    SELECT author_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
  END IF;

  -- Calculate vote difference
  IF TG_OP = 'INSERT' THEN
    vote_diff = NEW.vote_value;
  ELSIF TG_OP = 'UPDATE' THEN
    vote_diff = NEW.vote_value - OLD.vote_value;
  ELSIF TG_OP = 'DELETE' THEN
    vote_diff = -OLD.vote_value;
  END IF;

  -- Update post score
  IF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET score = score + vote_diff WHERE id = OLD.post_id;
  ELSE
    UPDATE public.posts SET score = score + vote_diff WHERE id = NEW.post_id;
  END IF;

  -- Update author karma points
  IF post_author_id IS NOT NULL THEN
    UPDATE public.profiles SET karma_points = karma_points + vote_diff WHERE id = post_author_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_post_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON public.post_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_vote();
