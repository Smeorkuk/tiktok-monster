-- Public playback, authenticated server-only uploads. Existing object policies stay unchanged.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('quiz-media','quiz-media',true,10485760,ARRAY['video/mp4','audio/mp4','audio/mpeg','audio/wav'])
ON CONFLICT (id) DO NOTHING;
