using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TransitOps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TenantScopedRegistrationAndLicenceUniqueness : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: databases initialized by EnsureCreated() already have the new indexes.
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_Vehicles_RegistrationNumber";
                DROP INDEX IF EXISTS "UX_Vehicles_NormalizedRegistrationNumber";
                DROP INDEX IF EXISTS "IX_Drivers_LicenseNumber";
                DROP INDEX IF EXISTS "UX_Drivers_NormalizedLicenseNumber";

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Vehicles_TenantId_RegistrationNumber"
                    ON "Vehicles" ("TenantId", "RegistrationNumber");
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Vehicles_Tenant_NormalizedRegistrationNumber"
                    ON "Vehicles" ("TenantId", upper(btrim("RegistrationNumber")));
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Drivers_TenantId_LicenseNumber"
                    ON "Drivers" ("TenantId", "LicenseNumber");
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Drivers_Tenant_NormalizedLicenseNumber"
                    ON "Drivers" ("TenantId", upper(btrim("LicenseNumber")));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restoring global uniqueness fails if two organizations now share a number.
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "IX_Vehicles_TenantId_RegistrationNumber";
                DROP INDEX IF EXISTS "UX_Vehicles_Tenant_NormalizedRegistrationNumber";
                DROP INDEX IF EXISTS "IX_Drivers_TenantId_LicenseNumber";
                DROP INDEX IF EXISTS "UX_Drivers_Tenant_NormalizedLicenseNumber";

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Vehicles_RegistrationNumber" ON "Vehicles" ("RegistrationNumber");
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Vehicles_NormalizedRegistrationNumber"
                    ON "Vehicles" (upper(btrim("RegistrationNumber")));
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Drivers_LicenseNumber" ON "Drivers" ("LicenseNumber");
                CREATE UNIQUE INDEX IF NOT EXISTS "UX_Drivers_NormalizedLicenseNumber"
                    ON "Drivers" (upper(btrim("LicenseNumber")));
                """);
        }
    }
}
