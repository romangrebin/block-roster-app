-- Pin search_path on the SECURITY DEFINER helper functions the RLS policies call.
--
-- A SECURITY DEFINER function with no explicit search_path resolves unqualified names against
-- the *caller's* search_path. A malicious caller can prepend a schema they control and shadow
-- a referenced table/function, so the definer-privileged body operates on attacker objects.
-- Setting search_path to '' forces every reference to be schema-qualified (done below) and
-- removes that vector. This is Supabase's own linter recommendation ("Function Search Path
-- Mutable").
--
-- Bodies are otherwise identical to 20260806000000_initial_schema.sql. CREATE OR REPLACE keeps
-- each function's OID, so the existing policies that reference them keep working untouched.

CREATE OR REPLACE FUNCTION public.is_active_steward_of(target_block_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stewards
    WHERE block_id = target_block_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.verified_resident_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT resident_id FROM public.contact_methods WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.verified_resident_block_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT residences.block_id
  FROM public.residents
  JOIN public.residences ON residences.id = residents.residence_id
  WHERE residents.id = public.verified_resident_id();
$$;
