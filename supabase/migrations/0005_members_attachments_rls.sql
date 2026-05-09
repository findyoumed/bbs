ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'members'
      AND policyname = 'service_role_members_all'
  ) THEN
    EXECUTE 'DROP POLICY "service_role_members_all" ON public.members';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND policyname = 'service_role_attachments_all'
  ) THEN
    EXECUTE 'DROP POLICY "service_role_attachments_all" ON public.attachments';
  END IF;
END
$$;
