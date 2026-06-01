-- Fix Security Definer View issue on friends_pairs
-- Change from SECURITY DEFINER to SECURITY INVOKER so RLS policies are evaluated
-- in the context of the querying user, not the view creator

ALTER VIEW public.friends_pairs SET (security_invoker = true);