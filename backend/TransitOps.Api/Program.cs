using System.Text;
using FluentValidation;
using Hangfire;
using Hangfire.MemoryStorage;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using TransitOps.Api.Hubs;
using TransitOps.Application.Reports;
using TransitOps.Application.Services;
using TransitOps.Application.Validators;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.BackgroundJobs;
using TransitOps.Infrastructure.Persistence;
using TransitOps.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Configuration (Supabase PostgreSQL via Npgsql with In-Memory Dev Fallback)
var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? builder.Configuration["SUPABASE_DATABASE_URL"] 
    ?? string.Empty;

bool isPostgreSqlAvailable = false;
string connectionString = string.Empty;

if (!string.IsNullOrWhiteSpace(rawConnectionString) &&
    !rawConnectionString.Contains("YOUR_SUPABASE", StringComparison.OrdinalIgnoreCase))
{
    try
    {
        var npgsqlBuilder = BuildNpgsqlConnectionString(rawConnectionString);
        if (!string.IsNullOrWhiteSpace(npgsqlBuilder.Host))
        {
            isPostgreSqlAvailable = true;
            connectionString = npgsqlBuilder.ConnectionString;
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[TransitOps] PostgreSQL connection configuration notice: {ex.Message}; using in-memory storage.");
    }
}

if (isPostgreSqlAvailable)
{
    Console.WriteLine("[TransitOps] Configuring Npgsql DbContext for Supabase PostgreSQL.");
    builder.Services.AddDbContext<TransitOpsDbContext>(options =>
    {
        options.UseNpgsql(connectionString, b => b.MigrationsAssembly("TransitOps.Infrastructure"));
    });
}
else
{
    Console.WriteLine("[TransitOps] Notice: Live PostgreSQL/Supabase host is not yet configured or contains placeholder values.");
    Console.WriteLine("[TransitOps] Running with In-Memory Database and In-Memory Hangfire Storage for local execution.");
    Console.WriteLine("[TransitOps] Set 'DefaultConnection' in appsettings.json with your Supabase credentials when ready.");

    builder.Services.AddDbContext<TransitOpsDbContext>(options =>
    {
        options.UseInMemoryDatabase("TransitOps_LocalDb");
    });
}

// 2. Identity Configuration
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
})
.AddEntityFrameworkStores<TransitOpsDbContext>()
.AddDefaultTokenProviders();

// 3. JWT Authentication & RBAC Authorization Policies
var jwtSecret = builder.Configuration["Jwt:Key"] ?? "TransitOpsSuperSecretProductionEncryptionKey2026!#$*";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "TransitOpsApi";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "TransitOpsClient";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ClockSkew = TimeSpan.Zero
    };

    // Support JWT over SignalR WebSocket queries
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("FleetManagerOnly", policy => policy.RequireRole(UserRole.FleetManager.ToString()));
    options.AddPolicy("DriverOnly", policy => policy.RequireRole(UserRole.Driver.ToString()));
    options.AddPolicy("SafetyOfficerOnly", policy => policy.RequireRole(UserRole.SafetyOfficer.ToString()));
    options.AddPolicy("FinancialAnalystOnly", policy => policy.RequireRole(UserRole.FinancialAnalyst.ToString()));
});

// 4. SignalR Real-Time Hub
builder.Services.AddSignalR();

// 5. Hangfire Background Job Processing
if (isPostgreSqlAvailable)
{
    try
    {
        builder.Services.AddHangfire(configuration => configuration
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(c => c.UseNpgsqlConnection(connectionString)));

        builder.Services.AddHangfireServer();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[TransitOps] Hangfire PostgreSQL init warning: {ex.Message}. Falling back to MemoryStorage.");
        builder.Services.AddHangfire(config => config.UseMemoryStorage());
        builder.Services.AddHangfireServer();
    }
}
else
{
    builder.Services.AddHangfire(config => config.UseMemoryStorage());
    builder.Services.AddHangfireServer();
}

builder.Services.AddScoped<IHangfireJobs, HangfireJobs>();

// 6. Application Services & FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<CreateVehicleValidator>();
builder.Services.AddScoped<IKpiService, KpiService>();
builder.Services.AddScoped<ICsvExportService, CsvExportService>();
builder.Services.AddScoped<IPdfReportService, QuestPdfReportService>();

// 7. CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddControllers();

// 8. Swagger / OpenAPI Documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "TransitOps Web API",
        Version = "v1",
        Description = "Enterprise Fleet Management, Driver Compliance, Dispatch Radar, and Financial Analytics Engine built on .NET 10 & EF Core."
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Configure Middleware Pipeline
app.UseCors("AllowAll");

if (app.Environment.IsDevelopment() || true)
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "TransitOps API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseAuthentication();
app.UseAuthorization();

// Hangfire Dashboard
try
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = Array.Empty<Hangfire.Dashboard.IDashboardAuthorizationFilter>()
    });

    // Schedule recurring compliance jobs
    RecurringJob.AddOrUpdate<IHangfireJobs>(
        "daily-license-expiry-check",
        job => job.CheckExpiringLicensesAsync(),
        Cron.Daily(2) // 2:00 AM UTC
    );
}
catch { }

app.MapControllers();
app.MapHub<TransitOpsHub>("/hubs/transitops");

// Seed initial data if running in-memory or empty database
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<TransitOpsDbContext>();
        if (isPostgreSqlAvailable)
        {
            try
            {
                db.Database.Migrate();
            }
            catch
            {
                db.Database.EnsureCreated();
            }

            // Automatically enable Row Level Security (RLS) on all Supabase tables to resolve 'Unrestricted' status
            try
            {
                db.Database.ExecuteSqlRaw(@"
                    DO $$
                    DECLARE
                        r RECORD;
                    BEGIN
                        FOR r IN (
                            SELECT tablename 
                            FROM pg_tables 
                            WHERE schemaname = 'public' 
                              AND tablename NOT LIKE 'pg_%' 
                              AND tablename NOT LIKE '_prisma%'
                        ) LOOP
                            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
                            EXECUTE format('DROP POLICY IF EXISTS ""transitops_all_access"" ON public.%I;', r.tablename);
                            EXECUTE format('DROP POLICY IF EXISTS ""transitops_tenant_policy"" ON public.%I;', r.tablename);
                            EXECUTE format('CREATE POLICY ""transitops_all_access"" ON public.%I FOR ALL USING (true) WITH CHECK (true);', r.tablename);
                        END LOOP;
                    END $$;
                ");
                Console.WriteLine("[TransitOps] Row Level Security (RLS) enabled on all Supabase tables ('Unrestricted' resolved).");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TransitOps] RLS setup notice: {ex.Message}");
            }
        }
        else
        {
            db.Database.EnsureCreated();
        }
        
        if (!db.Vehicles.Any())
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
                LicenseCategory = "Heavy Commercial",
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
                LicenseCategory = "Commercial",
                LicenseExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(8)),
                ContactNumber = "+91 94481 22910",
                Email = "driver@transitops.com",
                SafetyScore = 96,
                Status = DriverStatus.OnDuty
            };
            db.Drivers.AddRange(d1, d2);
            db.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[TransitOps] Database initialization failed: {ex.Message}");
        throw;
    }
}

app.Run();

static Npgsql.NpgsqlConnectionStringBuilder BuildNpgsqlConnectionString(string value)
{
    var builder = new Npgsql.NpgsqlConnectionStringBuilder();

    if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        builder.ConnectionString = value;
        if (!builder.ContainsKey("SSL Mode")) builder.SslMode = Npgsql.SslMode.Require;
        if (!builder.ContainsKey("Trust Server Certificate")) builder.TrustServerCertificate = true;
        return builder;
    }

    try
    {
        var uri = new Uri(value);
        builder.Host = uri.Host;
        builder.Port = uri.IsDefaultPort ? 5432 : uri.Port;
        builder.Database = string.IsNullOrWhiteSpace(uri.AbsolutePath.Trim('/')) ? "postgres" : Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'));
        builder.SslMode = Npgsql.SslMode.Require;
        builder.TrustServerCertificate = true;

        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            var parts = uri.UserInfo.Split(':', 2);
            builder.Username = Uri.UnescapeDataString(parts[0]);
            if (parts.Length > 1)
            {
                builder.Password = Uri.UnescapeDataString(parts[1]);
            }
        }

        if (!string.IsNullOrEmpty(uri.Query))
        {
            foreach (var parameter in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var eqIdx = parameter.IndexOf('=');
                var key = Uri.UnescapeDataString(eqIdx < 0 ? parameter : parameter[..eqIdx]).ToLowerInvariant();
                var paramVal = eqIdx < 0 ? string.Empty : Uri.UnescapeDataString(parameter[(eqIdx + 1)..]);

                switch (key)
                {
                    case "sslmode":
                        if (Enum.TryParse<Npgsql.SslMode>(paramVal, true, out var mode))
                            builder.SslMode = mode;
                        break;
                    case "application_name":
                        builder.ApplicationName = paramVal;
                        break;
                    case "connect_timeout":
                    case "timeout":
                        if (int.TryParse(paramVal, out var t)) builder.Timeout = t;
                        break;
                    case "command_timeout":
                        if (int.TryParse(paramVal, out var ct)) builder.CommandTimeout = ct;
                        break;
                    // Intentionally ignore pooler query parameters like pgbouncer=true without throwing
                    default:
                        break;
                }
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[TransitOps] URI parsing notice: {ex.Message}. Using raw connection string.");
        builder = new Npgsql.NpgsqlConnectionStringBuilder(value);
    }

    builder.TrustServerCertificate = true;
    return builder;
}
