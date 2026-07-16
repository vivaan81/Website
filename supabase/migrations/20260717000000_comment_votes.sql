-- Add score to comments
ALTER TABLE public.comments ADD COLUMN score INT NOT NULL DEFAULT 0;

-- Create comment votes table
CREATE TABLE public.comment_votes (
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote_value INT NOT NULL CHECK (vote_value = 1 OR vote_value = -1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_votes TO authenticated;
GRANT ALL ON public.comment_votes TO service_role;
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment votes viewable by authenticated" ON public.comment_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can vote on comments" ON public.comment_votes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update their comment vote" ON public.comment_votes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete their comment vote" ON public.comment_votes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger to update comment score and author karma when votes are added/changed/deleted
CREATE OR REPLACE FUNCTION public.handle_comment_vote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  comment_author_id UUID;
  vote_diff INT;
BEGIN
  -- Get the author of the comment
  IF TG_OP = 'DELETE' THEN
    SELECT author_id INTO comment_author_id FROM public.comments WHERE id = OLD.comment_id;
  ELSE
    SELECT author_id INTO comment_author_id FROM public.comments WHERE id = NEW.comment_id;
  END IF;

  -- Calculate vote difference
  IF TG_OP = 'INSERT' THEN
    vote_diff = NEW.vote_value;
  ELSIF TG_OP = 'UPDATE' THEN
    vote_diff = NEW.vote_value - OLD.vote_value;
  ELSIF TG_OP = 'DELETE' THEN
    vote_diff = -OLD.vote_value;
  END IF;

  -- Update comment score
  IF TG_OP = 'DELETE' THEN
    UPDATE public.comments SET score = score + vote_diff WHERE id = OLD.comment_id;
  ELSE
    UPDATE public.comments SET score = score + vote_diff WHERE id = NEW.comment_id;
  END IF;

  -- Update author karma points
  IF comment_author_id IS NOT NULL THEN
    UPDATE public.profiles SET karma_points = karma_points + vote_diff WHERE id = comment_author_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_comment_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_vote();
