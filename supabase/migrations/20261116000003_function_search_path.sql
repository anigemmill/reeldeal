-- Supabase security advisor (0011, function_search_path_mutable): pin the search path of the
-- two helper functions, so they can never resolve objects from a caller-controlled schema.
alter function private.set_updated_at() set search_path = '';
alter function private.tags_text(text[]) set search_path = '';
