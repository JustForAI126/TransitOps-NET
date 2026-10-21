using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Startup;

/// <summary>Creates or upgrades the PostgreSQL schema on startup and seeds the demo organization.</summary>
internal static class DatabaseInitializer
{
    public static void Initialize(WebApplication app, bool seedDemoData, string? demoPassword)
    {
        using var scope = app.Services.CreateScope();
        try
        {
            var db = scope.ServiceProvider.GetRequiredService<TransitOpsDbContext>();
            // EnsureCreated() skips everything when the database already has any table, and Hangfire
            // creates its own tables first, so on a fresh database the app tables would never be made.
            // Create them explicitly when the core table is missing; existing databases are untouched.
            if (db.Database.SqlQueryRaw<bool>("""SELECT to_regclass('public."Vehicles"') IS NOT NULL AS "Value" """).Single() is false)
                db.GetService<Microsoft.EntityFrameworkCore.Storage.IRelationalDatabaseCreator>().CreateTables();
            db.Database.Migrate();

            db.Database.ExecuteSqlRaw("""
                ALTER TABLE "Drivers" ADD COLUMN IF NOT EXISTS "IdentityUserId" character varying(450);
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Drivers_IdentityUserId"
                    ON "Drivers" ("IdentityUserId");
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Vehicles_Tenant_NormalizedRegistrationNumber"
                    ON "Vehicles" ("TenantId", upper(btrim("RegistrationNumber")));
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Drivers_NormalizedEmail"
                    ON "Drivers" (upper(btrim("Email")));
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Drivers_Tenant_NormalizedLicenseNumber"
                    ON "Drivers" ("TenantId", upper(btrim("LicenseNumber")));
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Trips_OneDispatchedVehicle"
                    ON "Trips" ("VehicleId") WHERE "Status" = 'Dispatched';
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Trips_OneDispatchedDriver"
                    ON "Trips" ("DriverId") WHERE "Status" = 'Dispatched';
                """);

            if (seedDemoData)
            {
                DemoDataSeeder.Seed(
                    scope.ServiceProvider,
                    db,
                    demoPassword!,
                    app.Configuration.GetValue("Operations:DieselPricePerLitreInr", 96.5m));
            }
        }
        catch (Exception ex)
        {
            app.Logger.LogCritical(ex, "PostgreSQL initialization or Development demo seeding failed.");
            throw;
        }
    }
}
