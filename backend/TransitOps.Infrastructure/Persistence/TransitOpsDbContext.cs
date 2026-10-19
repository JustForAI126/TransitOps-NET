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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // APPLICATION USER
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.Role).HasConversion<string>();
        });

        // VEHICLE
        modelBuilder.Entity<Vehicle>(entity =>
        {
            entity.HasKey(v => v.Id);
            entity.HasIndex(v => v.RegistrationNumber).IsUnique();
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
            entity.HasIndex(d => d.Email).IsUnique();
            entity.HasIndex(d => d.LicenseNumber).IsUnique();
            entity.Property(d => d.Status).HasConversion<string>();
        });

        // TRIP
        modelBuilder.Entity<Trip>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasIndex(t => t.TripCode).IsUnique();
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
