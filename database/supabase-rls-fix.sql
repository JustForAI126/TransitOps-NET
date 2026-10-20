-- TransitOps API database hardening.
-- The browser must not connect to PostgreSQL directly. Tenant authorization is
-- enforced by the ASP.NET API; do not add USING (true) policies to these tables.
-- With RLS enabled and no public policies, Supabase client roles cannot read or
-- write these tables. The trusted backend database principal must own the
-- tables or otherwise have the required server-side RLS bypass privileges.

DO $$
DECLARE
    table_name text;
    transitops_tables text[] := ARRAY[
        'Vehicles', 'VehicleDocuments', 'Drivers', 'Trips',
        'MaintenanceRecords', 'Expenses', 'AspNetUsers', 'AspNetRoles',
        'AspNetUserRoles', 'AspNetUserClaims', 'AspNetUserLogins',
        'AspNetUserTokens', 'AspNetRoleClaims'
    ];
BEGIN
    FOREACH table_name IN ARRAY transitops_tables LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            EXECUTE format('DROP POLICY IF EXISTS "transitops_all_access" ON public.%I', table_name);
            EXECUTE format('DROP POLICY IF EXISTS "transitops_tenant_policy" ON public.%I', table_name);
            EXECUTE format('DROP POLICY IF EXISTS "allow_tenant_ops" ON public.%I', table_name);
            EXECUTE format('DROP POLICY IF EXISTS "transitops_service_role_policy" ON public.%I', table_name);
        END IF;
    END LOOP;
END $$;

ALTER TABLE IF EXISTS public."Vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VehicleDocuments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Drivers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Trips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."MaintenanceRecords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."Expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AspNetUsers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AspNetRoles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AspNetUserRoles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AspNetUserClaims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AspNetUserLogins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AspNetUserTokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."AspNetRoleClaims" ENABLE ROW LEVEL SECURITY;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'Vehicles', 'VehicleDocuments', 'Drivers', 'Trips',
    'MaintenanceRecords', 'Expenses', 'AspNetUsers', 'AspNetRoles',
    'AspNetUserRoles', 'AspNetUserClaims', 'AspNetUserLogins',
    'AspNetUserTokens', 'AspNetRoleClaims'
  )
ORDER BY tablename;
