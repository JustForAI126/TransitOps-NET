using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TransitOps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOnboardingVerificationResends : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "SaasPurchases"
                ADD COLUMN IF NOT EXISTS "EmailVerificationResends" integer NOT NULL DEFAULT 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Preserve onboarding history if an operator rolls the migration back.
        }
    }
}
