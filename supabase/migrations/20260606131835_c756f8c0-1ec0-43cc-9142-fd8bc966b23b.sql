
CREATE POLICY "Users can upload their own resume" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update their own resume" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Authenticated can read resumes" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes');
