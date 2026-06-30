
-- Role enum
CREATE TYPE public.app_role AS ENUM ('student', 'alumni', 'moderator');
CREATE TYPE public.request_type AS ENUM ('mock_interview', 'resume_review');
CREATE TYPE public.request_status AS ENUM ('pending', 'accepted', 'completed', 'rejected');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'student',
  name TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  karma_points INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  resume_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role)
$$;

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Moderators can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'moderator'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, role, name, domain, verified)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'domain', ''),
    CASE WHEN COALESCE(NEW.raw_user_meta_data->>'role','student') = 'alumni' THEN false ELSE true END
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Requests
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alumni_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type request_type NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  domain TEXT NOT NULL DEFAULT '',
  meeting_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their requests" ON public.requests
  FOR SELECT TO authenticated USING (auth.uid() = student_id OR auth.uid() = alumni_id);
CREATE POLICY "Students can create requests" ON public.requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Participants can update their requests" ON public.requests
  FOR UPDATE TO authenticated USING (auth.uid() = student_id OR auth.uid() = alumni_id);

-- Karma trigger: increment when status moves to completed
CREATE OR REPLACE FUNCTION public.handle_request_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    UPDATE public.profiles SET karma_points = karma_points + 10 WHERE id = NEW.alumni_id;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER on_request_update
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_request_completion();

-- Internships
CREATE TABLE public.internships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT,
  apply_link TEXT,
  posted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internships TO authenticated;
GRANT ALL ON public.internships TO service_role;
ALTER TABLE public.internships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internships viewable by authenticated" ON public.internships
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Alumni can post internships" ON public.internships
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = posted_by AND public.has_role(auth.uid(), 'alumni'));
CREATE POLICY "Poster can update their internship" ON public.internships
  FOR UPDATE TO authenticated USING (auth.uid() = posted_by);
CREATE POLICY "Poster can delete their internship" ON public.internships
  FOR DELETE TO authenticated USING (auth.uid() = posted_by);
