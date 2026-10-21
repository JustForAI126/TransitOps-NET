using Microsoft.AspNetCore.Identity;
using TransitOps.Application.Services;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.Persistence;

namespace TransitOps.Api.Startup;

/// <summary>
/// Idempotent demo organization ("demo_tenant"): sample fleet, the five demo logins and calculated
/// safety scores. Runs in Development, or when DemoData:Enabled is true.
/// </summary>
internal static class DemoDataSeeder
{
    public static void Seed(IServiceProvider services, TransitOpsDbContext db, string demoPassword, decimal dieselPricePerLitre)
    {
        SeedBaselineRecords(db);
        SeedSampleFleet(db, dieselPricePerLitre);
        SyncDemoAccounts(services, db, demoPassword);
    }

    private static void SeedBaselineRecords(TransitOpsDbContext db)
    {
        if (!db.Vehicles.Any(vehicle => vehicle.TenantId == "demo_tenant"))
        {
            var v1 = new Vehicle
            {
                Id = Guid.NewGuid(),
                TenantId = "demo_tenant",
                RegistrationNumber = "MH-12-DE-5005",
                Name = "Van-05 Cityline",
                Model = "Tata Winger Cargo 3400",
                Type = VehicleType.Van,
                MaxCapacityKg = 1650,
                CurrentOdometerKm = 32450,
                AcquisitionCost = 1450000,
                Status = VehicleStatus.Available,
                Region = "West",
                FuelEfficiencyKmPerLiter = 11.5m
            };
            var v2 = new Vehicle
            {
                Id = Guid.NewGuid(),
                TenantId = "demo_tenant",
                RegistrationNumber = "KA-01-MJ-9912",
                Name = "Titan-01 Heavy Hauler",
                Model = "BharatBenz 2823R Heavy Truck",
                Type = VehicleType.HeavyTruck,
                MaxCapacityKg = 24000,
                CurrentOdometerKm = 64200,
                AcquisitionCost = 3850000,
                Status = VehicleStatus.OnTrip,
                Region = "South",
                FuelEfficiencyKmPerLiter = 4.2m
            };
            db.Vehicles.AddRange(v1, v2);

            var d1 = new Driver
            {
                Id = Guid.NewGuid(),
                TenantId = "demo_tenant",
                Name = "Rajesh Sharma",
                LicenseNumber = "MH1420180045921",
                LicenseCategory = "HGMV",
                LicenseExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(2)),
                ContactNumber = "+91 98234 11203",
                Email = "rajesh.sharma@transitops.com",
                SafetyScore = 98,
                Status = DriverStatus.Available
            };
            var d2 = new Driver
            {
                Id = Guid.NewGuid(),
                TenantId = "demo_tenant",
                Name = "Sarah Chen",
                LicenseNumber = "KA0320190012845",
                LicenseCategory = "LMV-TR",
                LicenseExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(8)),
                ContactNumber = "+91 94481 22910",
                Email = "driver@transitops.com",
                SafetyScore = 96,
                Status = DriverStatus.OnTrip
            };
            db.Drivers.AddRange(d1, d2);

            db.Trips.Add(new Trip
            {
                TenantId = "demo_tenant",
                TripCode = $"TRIP-{Guid.NewGuid():N}".ToUpperInvariant(),
                Source = "Bengaluru",
                Destination = "Chennai",
                Vehicle = v2,
                Driver = d2,
                CargoWeightKg = 8000,
                PlannedDistanceKm = 350,
                Revenue = 0,
                Status = TripStatus.Dispatched,
                DispatchedAtUtc = DateTime.UtcNow
            });
            db.SaveChanges();
        }
    }

    private static void SyncDemoAccounts(IServiceProvider services, TransitOpsDbContext db, string demoPassword)
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var demoAccounts = new[]
        {
            (Email: "admin@transitops.com", Name: "TransitOps Demo Admin", Role: UserRole.OrganizationAdmin),
            (Email: "manager@transitops.com", Name: "Alex Morgan", Role: UserRole.FleetManager),
            (Email: "driver@transitops.com", Name: "Sarah Chen", Role: UserRole.Driver),
            (Email: "safety@transitops.com", Name: "Marcus Vance", Role: UserRole.SafetyOfficer),
            (Email: "analyst@transitops.com", Name: "David Miller", Role: UserRole.FinancialAnalyst)
        };

        foreach (var demoAccount in demoAccounts)
        {
            var demoUser = userManager.FindByEmailAsync(demoAccount.Email).GetAwaiter().GetResult();
            if (demoUser is null)
            {
                demoUser = new ApplicationUser
                {
                    UserName = demoAccount.Email,
                    Email = demoAccount.Email,
                    FullName = demoAccount.Name,
                    Role = demoAccount.Role,
                    TenantId = "demo_tenant",
                    IsDemoAccount = true,
                    EmailConfirmed = true,
                    LockoutEnabled = true
                };
                var createResult = userManager.CreateAsync(demoUser, demoPassword).GetAwaiter().GetResult();
                if (!createResult.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Development demo account {demoAccount.Email} could not be created: " +
                        string.Join("; ", createResult.Errors.Select(error => error.Description)));
                }
            }
            else if (demoUser.IsDemoAccount)
            {
                demoUser.Role = demoAccount.Role;
                demoUser.TenantId = "demo_tenant";
                demoUser.FullName = demoAccount.Name;
                var passwordToken = userManager.GeneratePasswordResetTokenAsync(demoUser).GetAwaiter().GetResult();
                var resetResult = userManager.ResetPasswordAsync(demoUser, passwordToken, demoPassword).GetAwaiter().GetResult();
                if (!resetResult.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Development demo account {demoAccount.Email} password could not be synchronized: " +
                        string.Join("; ", resetResult.Errors.Select(error => error.Description)));
                }
                var updateResult = userManager.UpdateAsync(demoUser).GetAwaiter().GetResult();
                if (!updateResult.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Development demo account {demoAccount.Email} could not be synchronized: " +
                        string.Join("; ", updateResult.Errors.Select(error => error.Description)));
                }
            }
            else
            {
                throw new InvalidOperationException(
                    $"Development demo email {demoAccount.Email} is already owned by a non-demo account.");
            }
        }

        var demoDriver = db.Drivers.FirstOrDefault(driver =>
            driver.TenantId == "demo_tenant" && driver.Email == "driver@transitops.com");
        var driverUser = userManager.FindByEmailAsync("driver@transitops.com").GetAwaiter().GetResult();
        if (demoDriver is not null && driverUser is not null && demoDriver.IdentityUserId != driverUser.Id)
        {
            demoDriver.IdentityUserId = driverUser.Id;
            db.SaveChanges();
        }

        SyncDemoDriverSafetyProfiles(db);
        services.GetRequiredService<ISafetyScoreService>()
            .RecalculateAllAsync("demo_tenant").GetAwaiter().GetResult();
    }

    // Demo drivers get official licence classes and a recorded incident history so the
    // calculated safety scores show a realistic spread. Incident counts only ever increase,
    // so incidents recorded while demonstrating the app are kept.
    private static void SyncDemoDriverSafetyProfiles(TransitOpsDbContext db)
    {
        var legacyClasses = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Heavy Commercial"] = "HGMV",
            ["Commercial"] = "LMV-TR"
        };
        var seededIncidents = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["arjun.patel@transitops.com"] = 1,
            ["vikram.reddy@transitops.com"] = 1,
            ["rohit.verma@transitops.com"] = 2,
            ["imran.shaikh@transitops.com"] = 3,
            ["sandeep.yadav@transitops.com"] = 2
        };

        foreach (var driver in db.Drivers.Where(d => d.TenantId == "demo_tenant").ToList())
        {
            if (legacyClasses.TryGetValue(driver.LicenseCategory, out var licenceClass))
                driver.LicenseCategory = licenceClass;
            if (seededIncidents.TryGetValue(driver.Email, out var incidents) && driver.IncidentHistoryCount < incidents)
                driver.IncidentHistoryCount = incidents;
        }
        db.SaveChanges();
    }

    private static void SeedSampleFleet(TransitOpsDbContext db, decimal dieselPricePerLitre)
    {
        const string tenantId = "demo_tenant";
        var now = DateTime.UtcNow;
        var vehicleSeed = new[]
        {
            (Registration: "MH-14-KT-2816", Name: "Pune Express 16T", Model: "Tata LPT 1618", Type: VehicleType.Truck, Capacity: 10500, Odometer: 118430, Cost: 2850000m, Status: VehicleStatus.Available, Region: "West", Efficiency: 6.4m),
            (Registration: "GJ-01-RM-7742", Name: "Ahmedabad Linehaul 25T", Model: "Ashok Leyland 2518", Type: VehicleType.HeavyTruck, Capacity: 18000, Odometer: 203180, Cost: 4250000m, Status: VehicleStatus.InShop, Region: "West", Efficiency: 4.1m),
            (Registration: "TN-09-CV-6308", Name: "Chennai City Cargo", Model: "Eicher Pro 2095", Type: VehicleType.Truck, Capacity: 6500, Odometer: 87650, Cost: 2180000m, Status: VehicleStatus.Available, Region: "South", Efficiency: 7.2m),
            (Registration: "TS-08-UR-4159", Name: "Hyderabad Fleet Van", Model: "Tata Intra V50", Type: VehicleType.Van, Capacity: 1500, Odometer: 55210, Cost: 1120000m, Status: VehicleStatus.Available, Region: "South", Efficiency: 12.3m),
            (Registration: "DL-1L-AB-9081", Name: "Delhi NCR Box 12T", Model: "BharatBenz 1217C", Type: VehicleType.BoxTruck, Capacity: 7800, Odometer: 146800, Cost: 3120000m, Status: VehicleStatus.Available, Region: "North", Efficiency: 6.1m),
            (Registration: "RJ-14-GH-2306", Name: "Jaipur Regional Hauler", Model: "Eicher Pro 3015", Type: VehicleType.HeavyTruck, Capacity: 14000, Odometer: 132090, Cost: 3650000m, Status: VehicleStatus.Available, Region: "North", Efficiency: 5.3m),
            (Registration: "KA-03-PL-5174", Name: "Bengaluru Parcel Van", Model: "Mahindra Bolero Maxx", Type: VehicleType.Pickup, Capacity: 1000, Odometer: 49320, Cost: 980000m, Status: VehicleStatus.Available, Region: "South", Efficiency: 13.1m),
            (Registration: "MH-46-BF-1182", Name: "Mumbai Intercity 20T", Model: "Tata LPT 1918", Type: VehicleType.Truck, Capacity: 12500, Odometer: 178440, Cost: 3380000m, Status: VehicleStatus.InShop, Region: "West", Efficiency: 5.6m),
            (Registration: "UP-32-MN-6720", Name: "Lucknow North Cargo", Model: "Ashok Leyland 1920", Type: VehicleType.HeavyTruck, Capacity: 13000, Odometer: 109780, Cost: 3480000m, Status: VehicleStatus.Available, Region: "North", Efficiency: 5.1m),
            (Registration: "KL-07-XY-8451", Name: "Kochi Coastal Pickup", Model: "Tata Yodha 2.0", Type: VehicleType.Pickup, Capacity: 1200, Odometer: 62840, Cost: 1240000m, Status: VehicleStatus.Retired, Region: "South", Efficiency: 10.8m)
        };

        var existingRegistrations = db.Vehicles
            .Where(vehicle => vehicle.TenantId == tenantId)
            .Select(vehicle => vehicle.RegistrationNumber)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var spec in vehicleSeed)
        {
            if (!existingRegistrations.Add(spec.Registration))
                continue;

            db.Vehicles.Add(new Vehicle
            {
                TenantId = tenantId,
                RegistrationNumber = spec.Registration,
                Name = spec.Name,
                Model = spec.Model,
                Type = spec.Type,
                MaxCapacityKg = spec.Capacity,
                CurrentOdometerKm = spec.Odometer,
                AcquisitionCost = spec.Cost,
                Status = spec.Status,
                Region = spec.Region,
                FuelEfficiencyKmPerLiter = spec.Efficiency
            });
        }

        var driverSeed = new[]
        {
            (Name: "Priya Nair", License: "MH1420200087631", Category: "HGMV", Contact: "+91 98220 34117", Email: "priya.nair@transitops.com", Expiry: now.AddYears(3), Score: 97, Status: DriverStatus.Available),
            (Name: "Arjun Patel", License: "GJ0120180064219", Category: "HGMV", Contact: "+91 98790 21568", Email: "arjun.patel@transitops.com", Expiry: now.AddMonths(14), Score: 91, Status: DriverStatus.OnDuty),
            (Name: "Meera Iyer", License: "TN0920210031884", Category: "LMV-TR", Contact: "+91 98403 61245", Email: "meera.iyer@transitops.com", Expiry: now.AddYears(2), Score: 99, Status: DriverStatus.Available),
            (Name: "Vikram Reddy", License: "TS0820190019726", Category: "HGMV", Contact: "+91 98490 48321", Email: "vikram.reddy@transitops.com", Expiry: now.AddMonths(20), Score: 88, Status: DriverStatus.OffDuty),
            (Name: "Ananya Singh", License: "DL1L20220087114", Category: "LMV-TR", Contact: "+91 98110 73926", Email: "ananya.singh@transitops.com", Expiry: now.AddYears(4), Score: 96, Status: DriverStatus.Available),
            (Name: "Rohit Verma", License: "RJ1420170043892", Category: "HGMV", Contact: "+91 98290 63815", Email: "rohit.verma@transitops.com", Expiry: now.AddMonths(9), Score: 84, Status: DriverStatus.Available),
            (Name: "Kavya Rao", License: "KA0320200056310", Category: "LMV-TR", Contact: "+91 99008 52471", Email: "kavya.rao@transitops.com", Expiry: now.AddYears(2), Score: 98, Status: DriverStatus.Available),
            (Name: "Imran Shaikh", License: "MH4620160092754", Category: "HGMV", Contact: "+91 98211 76420", Email: "imran.shaikh@transitops.com", Expiry: now.AddMonths(17), Score: 79, Status: DriverStatus.Suspended),
            (Name: "Sandeep Yadav", License: "UP3220180028147", Category: "HGMV", Contact: "+91 98390 52718", Email: "sandeep.yadav@transitops.com", Expiry: now.AddMonths(-2), Score: 73, Status: DriverStatus.Suspended),
            (Name: "Nisha Menon", License: "KL0720210065402", Category: "LMV-TR", Contact: "+91 98470 19362", Email: "nisha.menon@transitops.com", Expiry: now.AddMonths(11), Score: 95, Status: DriverStatus.Available)
        };

        var existingLicenses = db.Drivers
            .Where(driver => driver.TenantId == tenantId)
            .Select(driver => driver.LicenseNumber)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existingDriverEmails = db.Drivers
            .Where(driver => driver.TenantId == tenantId)
            .Select(driver => driver.Email)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var spec in driverSeed)
        {
            if (existingLicenses.Contains(spec.License) || !existingDriverEmails.Add(spec.Email))
                continue;

            db.Drivers.Add(new Driver
            {
                TenantId = tenantId,
                Name = spec.Name,
                LicenseNumber = spec.License,
                LicenseCategory = spec.Category,
                ContactNumber = spec.Contact,
                Email = spec.Email,
                LicenseExpiryDate = DateOnly.FromDateTime(spec.Expiry),
                SafetyScore = spec.Score,
                Status = spec.Status
            });
            existingLicenses.Add(spec.License);
        }

        db.SaveChanges();

        var seedRegistrations = vehicleSeed.Select(spec => spec.Registration).ToArray();
        var seedDriverEmails = driverSeed.Select(spec => spec.Email).ToArray();
        var vehicles = db.Vehicles
            .Where(vehicle => vehicle.TenantId == tenantId && seedRegistrations.Contains(vehicle.RegistrationNumber))
            .OrderBy(vehicle => vehicle.RegistrationNumber)
            .ToList();
        var drivers = db.Drivers
            .Where(driver => driver.TenantId == tenantId && seedDriverEmails.Contains(driver.Email))
            .OrderBy(driver => driver.LicenseNumber)
            .ToList();
        var existingTripCodes = db.Trips.Where(trip => trip.TenantId == tenantId)
            .Select(trip => trip.TripCode).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var routePairs = new[]
        {
            ("Mumbai", "Pune"), ("Pune", "Nashik"), ("Ahmedabad", "Vadodara"),
            ("Bengaluru", "Chennai"), ("Chennai", "Coimbatore"), ("Hyderabad", "Vijayawada"),
            ("Delhi", "Jaipur"), ("Jaipur", "Udaipur"), ("Lucknow", "Kanpur"),
            ("Kochi", "Thiruvananthapuram"), ("Nagpur", "Indore"), ("Surat", "Mumbai")
        };
        var random = new Random(20261019);
        for (var index = 1; index <= 120; index++)
        {
            var tripCode = $"DEMO-HIST-{index:000}";
            if (!existingTripCodes.Add(tripCode))
                continue;

            var seedOrdinal = index - 1;
            var vehicle = vehicles[(seedOrdinal + seedOrdinal / vehicles.Count) % vehicles.Count];
            var driver = drivers[index % drivers.Count];
            var route = routePairs[index % routePairs.Length];
            var distanceKm = random.Next(110, 1450);
            var cargoWeightKg = random.Next(Math.Max(500, vehicle.MaxCapacityKg / 4), vehicle.MaxCapacityKg + 1);
            var createdAt = now.AddDays(-random.Next(1, 181)).AddHours(-random.Next(0, 24));
            var status = (index % 10) switch
            {
                7 => TripStatus.Cancelled,
                8 => TripStatus.Draft,
                _ => TripStatus.Completed
            };
            var completedAt = status == TripStatus.Completed
                ? createdAt.AddHours(random.Next(2, 28))
                : (DateTime?)null;
            if (completedAt > now)
                completedAt = now.AddMinutes(-random.Next(1, 30));
            var trip = new Trip
            {
                TenantId = tenantId,
                TripCode = tripCode,
                Source = route.Item1,
                Destination = route.Item2,
                Vehicle = vehicle,
                Driver = driver,
                CargoWeightKg = cargoWeightKg,
                PlannedDistanceKm = distanceKm,
                FinalOdometerKm = status == TripStatus.Completed ? vehicle.CurrentOdometerKm + random.Next(1, 3000) : null,
                FuelConsumedLiters = status == TripStatus.Completed
                    ? decimal.Round(distanceKm / vehicle.FuelEfficiencyKmPerLiter * (decimal)(1.02 + random.NextDouble() * 0.12), 2)
                    : null,
                Revenue = decimal.Round(distanceKm * 38m * cargoWeightKg / 1000m, 2),
                Status = status,
                CreatedAtUtc = createdAt,
                DispatchedAtUtc = status == TripStatus.Draft ? null : createdAt.AddMinutes(30),
                CompletedAtUtc = completedAt
            };
            db.Trips.Add(trip);
        }
        db.SaveChanges();

        var demoSeedTrips = db.Trips
            .Where(trip => trip.TenantId == tenantId && trip.TripCode.StartsWith("DEMO-HIST-"))
            .ToList();
        var demoTripVehicleIds = new Dictionary<Guid, Guid>();
        foreach (var trip in demoSeedTrips)
        {
            var seedOrdinal = int.Parse(trip.TripCode.Substring("DEMO-HIST-".Length)) - 1;
            var vehicle = vehicles[(seedOrdinal + seedOrdinal / vehicles.Count) % vehicles.Count];
            trip.VehicleId = vehicle.Id;
            trip.Revenue = decimal.Round(trip.PlannedDistanceKm * 38m * trip.CargoWeightKg / 1000m, 2);
            demoTripVehicleIds.Add(trip.Id, vehicle.Id);
        }
        var demoTripIds = demoTripVehicleIds.Keys.ToArray();
        var linkedDemoExpenses = db.Expenses
            .Where(expense => expense.TenantId == tenantId &&
                              expense.TripId.HasValue &&
                              demoTripIds.Contains(expense.TripId.Value))
            .ToList();
        foreach (var expense in linkedDemoExpenses)
            expense.VehicleId = demoTripVehicleIds[expense.TripId!.Value];
        db.SaveChanges();

        var demoTrips = demoSeedTrips.Where(trip => trip.Status == TripStatus.Completed).ToList();
        var existingExpenseNotes = db.Expenses.Where(expense => expense.TenantId == tenantId && expense.Notes != null)
            .Select(expense => expense.Notes!)
            .ToHashSet(StringComparer.Ordinal);
        foreach (var trip in demoTrips)
        {
            if (trip.FuelConsumedLiters is decimal liters)
            {
                var fuelNote = $"Demo seed {trip.TripCode} fuel";
                if (existingExpenseNotes.Add(fuelNote))
                {
                    db.Expenses.Add(new ExpenseRecord
                    {
                        TenantId = tenantId,
                        VehicleId = trip.VehicleId,
                        TripId = trip.Id,
                        Type = ExpenseType.Fuel,
                        Amount = decimal.Round(liters * dieselPricePerLitre, 2),
                        Liters = liters,
                        OdometerReading = trip.FinalOdometerKm,
                        ExpenseDate = trip.CompletedAtUtc!.Value,
                        Notes = fuelNote
                    });
                }
            }

            var tollNote = $"Demo seed {trip.TripCode} toll";
            if (existingExpenseNotes.Add(tollNote))
            {
                db.Expenses.Add(new ExpenseRecord
                {
                    TenantId = tenantId,
                    VehicleId = trip.VehicleId,
                    TripId = trip.Id,
                    Type = ExpenseType.Toll,
                    Amount = random.Next(450, 4201),
                    ExpenseDate = trip.CompletedAtUtc!.Value,
                    Notes = tollNote
                });
            }
        }

        var maintenanceDescriptions = db.MaintenanceRecords
            .Where(record => record.TenantId == tenantId)
            .Select(record => record.Description)
            .ToHashSet(StringComparer.Ordinal);
        var serviceTypes = new[] { "Scheduled service", "Brake inspection", "Tyre replacement", "Engine diagnostics", "Electrical repair", "Refrigeration service" };
        var inShopVehicles = vehicles.Where(vehicle => vehicle.Status == VehicleStatus.InShop).ToList();
        for (var index = 1; index <= 24; index++)
        {
            var description = $"Demo seed maintenance {index:000}: {serviceTypes[index % serviceTypes.Length]}";
            if (!maintenanceDescriptions.Add(description))
                continue;

            var active = index <= inShopVehicles.Count;
            var vehicle = active ? inShopVehicles[index - 1] : vehicles[(index * 3) % vehicles.Count];
            var startDate = now.AddDays(-random.Next(30, 240));
            db.MaintenanceRecords.Add(new MaintenanceRecord
            {
                TenantId = tenantId,
                Vehicle = vehicle,
                ServiceType = serviceTypes[index % serviceTypes.Length],
                Description = description,
                Cost = random.Next(6500, 95001),
                Status = active ? MaintenanceStatus.Active : MaintenanceStatus.Completed,
                TechnicianNotes = active ? "Awaiting replacement parts; inspection in progress." : "Service completed and road-tested.",
                StartDate = startDate,
                CompletedDate = active ? null : startDate.AddDays(random.Next(1, 21))
            });
        }

        for (var index = 1; index <= 18; index++)
        {
            var note = $"Demo seed overhead {index:000}: {(index % 2 == 0 ? "insurance" : "permit")} renewal";
            if (!existingExpenseNotes.Add(note))
                continue;

            db.Expenses.Add(new ExpenseRecord
            {
                TenantId = tenantId,
                VehicleId = vehicles[index % vehicles.Count].Id,
                Type = index % 2 == 0 ? ExpenseType.Insurance : ExpenseType.Permit,
                Amount = random.Next(3500, 32001),
                ExpenseDate = now.AddDays(-random.Next(1, 365)),
                Notes = note
            });
        }
        db.SaveChanges();

        var revenueByVehicle = db.Trips
            .Where(trip => trip.TenantId == tenantId && trip.Status == TripStatus.Completed)
            .GroupBy(trip => trip.VehicleId)
            .Select(group => new { VehicleId = group.Key, Revenue = group.Sum(trip => trip.Revenue) })
            .ToDictionary(result => result.VehicleId, result => result.Revenue);
        var completedTripsByDriver = db.Trips
            .Where(trip => trip.TenantId == tenantId && trip.Status == TripStatus.Completed)
            .GroupBy(trip => trip.DriverId)
            .Select(group => new { DriverId = group.Key, Count = group.Count() })
            .ToDictionary(result => result.DriverId, result => result.Count);
        foreach (var vehicle in vehicles)
            vehicle.RevenueGenerated = revenueByVehicle.GetValueOrDefault(vehicle.Id);
        foreach (var driver in drivers)
            driver.TotalTripsCompleted = completedTripsByDriver.GetValueOrDefault(driver.Id);
        db.SaveChanges();
    }
}
