using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;

namespace TransitOps.Infrastructure.Persistence;

public class TransitOpsDbContext : IdentityDbContext<ApplicationUser>
{
    public TransitOpsDbContext(DbContextOptions<TransitOpsDbContext> options) : base(options) { }

    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<VehicleDocument> VehicleDocuments => Set<VehicleDocument>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<Trip> Trips => Set<Trip>();
    public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();
    public DbSet<ExpenseRecord> Expenses => Set<ExpenseRecord>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationSubscription> OrganizationSubscriptions => Set<OrganizationSubscription>();
    public DbSet<SaasPurchase> SaasPurchases => Set<SaasPurchase>();
    public DbSet<RazorpayWebhookReceipt> RazorpayWebhookReceipts => Set<RazorpayWebhookReceipt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // APPLICATION USER
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.Role).HasConversion<string>();
        });

        modelBuilder.Entity<Organization>(entity =>
        {
            entity.HasKey(organization => organization.TenantId);
            entity.Property(organization => organization.TenantId).HasMaxLength(64);
            entity.Property(organization => organization.Name).HasMaxLength(200).IsRequired();
            entity.Property(organization => organization.BillingEmail).HasMaxLength(256).IsRequired();
            entity.Property(organization => organization.NormalizedBillingEmail).HasMaxLength(256).IsRequired();
            entity.HasIndex(organization => organization.NormalizedBillingEmail)
                .IsUnique()
                .HasDatabaseName("UX_Organizations_NormalizedBillingEmail");
        });

        modelBuilder.Entity<OrganizationSubscription>(entity =>
        {
            entity.HasKey(subscription => subscription.Id);
            entity.Property(subscription => subscription.PlanId).HasMaxLength(64).IsRequired();
            entity.Property(subscription => subscription.PlanName).HasMaxLength(120).IsRequired();
            entity.Property(subscription => subscription.Currency).HasMaxLength(3).IsRequired();
            entity.Property(subscription => subscription.Status).HasMaxLength(32).IsRequired();
            entity.Property(subscription => subscription.RazorpayOrderId).HasMaxLength(64).IsRequired();
            entity.Property(subscription => subscription.RazorpayPaymentId).HasMaxLength(64).IsRequired();
            entity.HasIndex(subscription => subscription.RazorpayOrderId)
                .IsUnique()
                .HasDatabaseName("UX_OrganizationSubscriptions_RazorpayOrderId");
            entity.HasIndex(subscription => subscription.RazorpayPaymentId)
                .IsUnique()
                .HasDatabaseName("UX_OrganizationSubscriptions_RazorpayPaymentId");
            entity.HasOne<Organization>()
                .WithMany()
                .HasForeignKey(subscription => subscription.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SaasPurchase>(entity =>
        {
            entity.HasKey(purchase => purchase.Id);
            entity.Property(purchase => purchase.OrganizationName).HasMaxLength(200).IsRequired();
            entity.Property(purchase => purchase.FullName).HasMaxLength(200).IsRequired();
            entity.Property(purchase => purchase.Email).HasMaxLength(256).IsRequired();
            entity.Property(purchase => purchase.NormalizedEmail).HasMaxLength(256).IsRequired();
            entity.Property(purchase => purchase.CapabilityTokenHash).HasMaxLength(64).IsRequired();
            entity.Property(purchase => purchase.PaymentStatus).HasMaxLength(40).IsRequired();
            entity.Property(purchase => purchase.RazorpayOrderId).HasMaxLength(64);
            entity.Property(purchase => purchase.RazorpayPaymentId).HasMaxLength(64);
            entity.Property(purchase => purchase.SetupTokenHash).HasMaxLength(64);
            entity.HasIndex(purchase => purchase.RazorpayOrderId)
                .IsUnique()
                .HasDatabaseName("UX_SaasPurchases_RazorpayOrderId");
            entity.HasIndex(purchase => purchase.RazorpayPaymentId)
                .IsUnique()
                .HasDatabaseName("UX_SaasPurchases_RazorpayPaymentId");
            entity.HasIndex(purchase => purchase.SetupTokenHash)
                .IsUnique()
                .HasDatabaseName("UX_SaasPurchases_SetupTokenHash");
        });

        modelBuilder.Entity<RazorpayWebhookReceipt>(entity =>
        {
            entity.HasKey(receipt => receipt.Id);
            entity.Property(receipt => receipt.EventId).HasMaxLength(128).IsRequired();
            entity.HasIndex(receipt => receipt.EventId)
                .IsUnique()
                .HasDatabaseName("UX_RazorpayWebhookReceipts_EventId");
        });

        // VEHICLE
        modelBuilder.Entity<Vehicle>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => v.RegistrationNumber).IsUnique()
                .HasDatabaseName("IX_Vehicles_RegistrationNumber");
            entity.Property(v => v.RegistrationNumber).HasMaxLength(32).IsRequired();
            entity.Property(v => v.AcquisitionCost).HasPrecision(18, 2);
            entity.Property(v => v.RevenueGenerated).HasPrecision(18, 2);
            entity.Property(v => v.FuelEfficiencyKmPerLiter).HasPrecision(5, 2);
            entity.Property(v => v.Status).HasConversion<string>();
            entity.Property(v => v.Type).HasConversion<string>();

            entity.HasMany(v => v.Documents)
                  .WithOne(d => d.Vehicle)
                  .HasForeignKey(d => d.VehicleId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // DRIVER
        modelBuilder.Entity<Driver>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.HasIndex(d => d.Email).IsUnique()
                .HasDatabaseName("IX_Drivers_Email");
            entity.HasIndex(d => d.LicenseNumber).IsUnique()
                .HasDatabaseName("IX_Drivers_LicenseNumber");
            entity.HasIndex(d => d.IdentityUserId).IsUnique()
                .HasDatabaseName("IX_Drivers_IdentityUserId");
            entity.Property(d => d.IdentityUserId).HasMaxLength(450);
            entity.Property(d => d.Status).HasConversion<string>();
            entity.ToTable(table =>
            {
                table.HasCheckConstraint("CK_Drivers_SafetyScore", "\"SafetyScore\" >= 0 AND \"SafetyScore\" <= 100");
            });
        });

        // TRIP
        modelBuilder.Entity<Trip>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasIndex(t => t.TripCode).IsUnique();
            entity.HasIndex(t => t.VehicleId)
                .IsUnique()
                .HasFilter("\"Status\" = 'Dispatched'")
                .HasDatabaseName("UX_Trips_OneDispatchedVehicle");
            entity.HasIndex(t => t.DriverId)
                .IsUnique()
                .HasFilter("\"Status\" = 'Dispatched'")
                .HasDatabaseName("UX_Trips_OneDispatchedDriver");
            entity.Property(t => t.Revenue).HasPrecision(18, 2);
            entity.Property(t => t.FuelConsumedLiters).HasPrecision(8, 2);
            entity.Property(t => t.Status).HasConversion<string>();

            entity.HasOne(t => t.Vehicle)
                  .WithMany(v => v.Trips)
                  .HasForeignKey(t => t.VehicleId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.Driver)
                  .WithMany(d => d.Trips)
                  .HasForeignKey(t => t.DriverId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // MAINTENANCE
        modelBuilder.Entity<MaintenanceRecord>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.Cost).HasPrecision(18, 2);
            entity.Property(m => m.Status).HasConversion<string>();

            entity.HasOne(m => m.Vehicle)
                  .WithMany(v => v.MaintenanceRecords)
                  .HasForeignKey(m => m.VehicleId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // EXPENSES
        modelBuilder.Entity<ExpenseRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Amount).HasPrecision(18, 2);
            entity.Property(e => e.Liters).HasPrecision(8, 2);
            entity.Property(e => e.Type).HasConversion<string>();

            entity.HasOne(e => e.Vehicle)
                  .WithMany(v => v.Expenses)
                  .HasForeignKey(e => e.VehicleId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Trip)
                  .WithMany(t => t.Expenses)
                  .HasForeignKey(e => e.TripId)
                  .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
