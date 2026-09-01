-- Keep the migration-defined canonical index and remove the duplicate.
DROP INDEX IF EXISTS public.idx_chat_rooms_activity;
