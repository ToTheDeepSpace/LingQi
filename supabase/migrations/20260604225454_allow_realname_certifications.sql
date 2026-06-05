ALTER TABLE public.lc_certifications
  DROP CONSTRAINT IF EXISTS lc_certifications_type_check;

ALTER TABLE public.lc_certifications
  ADD CONSTRAINT lc_certifications_type_check
  CHECK (type IN ('realname', 'dm', 'shop'));
