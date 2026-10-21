using System.Text;
using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FluentValidation;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.OpenApi.Models;
using TransitOps.Api.Middleware;
using TransitOps.Api.Hubs;
using TransitOps.Api.Startup;
using TransitOps.Application.Reports;
using TransitOps.Application.Services;
using TransitOps.Application.Validators;
using TransitOps.Domain.Entities;
using TransitOps.Domain.Enums;
using TransitOps.Infrastructure.BackgroundJobs;
using TransitOps.Infrastructure.Persistence;
using TransitOps.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);
var demoPassword = builder.Configuration["DemoAccounts:Password"];
// Demo organization, accounts and sample data: always in Development, and in a deployed
// demonstration environment when DemoData:Enabled is true.
var seedDemoData = builder.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("DemoData:Enabled");
if (seedDemoData && string.IsNullOrWhiteSpace(demoPassword))
{
    // Say where the value was looked for, so a misconfigured editor or host is easy to diagnose.
    var secretsPath = Microsoft.Extensions.Configuration.UserSecrets.PathHelper
        .GetSecretsPathFromSecretsId("TransitOps.Api-LocalDevelopment");
    var fromEnvironment = Environment.GetEnvironmentVariable("DemoAccounts__Password");
    throw new InvalidOperationException(
        "Demo seeding requires DemoAccounts:Password. Configure it with .NET User Secrets locally or as a host secret when deployed. " +
        $"Environment: {builder.Environment.EnvironmentName}; application: {builder.Environment.ApplicationName}; " +
        $"User Secrets file: {secretsPath} (exists: {File.Exists(secretsPath)}); " +
        $"DemoAccounts__Password environment variable: {(fromEnvironment is null ? "not set" : "set but empty")}.");
}

// 1. PostgreSQL is required; never silently start with non-persistent storage.
var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["SUPABASE_DATABASE_URL"]
    ?? string.Empty;

if (string.IsNullOrWhiteSpace(rawConnectionString) ||
    rawConnectionString.Contains("YOUR_SUPABASE", StringComparison.OrdinalIgnoreCase))
{
    throw new InvalidOperationException(
        "A PostgreSQL connection string must be configured as ConnectionStrings:DefaultConnection. Use .NET User Secrets for local development.");
}

var npgsqlBuilder = PostgresConnectionString.Build(rawConnectionString);
if (string.IsNullOrWhiteSpace(npgsqlBuilder.Host))
{
    throw new InvalidOperationException("The configured PostgreSQL connection string must include a host.");
}
// Supabase session poolers commonly cap all clients at 15; reserve connections for other tools and services.
npgsqlBuilder.MaxPoolSize = Math.Min(npgsqlBuilder.MaxPoolSize, 8);
npgsqlBuilder.MinPoolSize = Math.Min(npgsqlBuilder.MinPoolSize, npgsqlBuilder.MaxPoolSize);
var connectionString = npgsqlBuilder.ConnectionString;
builder.Services.AddDbContext<TransitOpsDbContext>(options =>
    options.UseNpgsql(connectionString, b => b.MigrationsAssembly("TransitOps.Infrastructure")));

// 2. Identity Configuration
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 10;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.Lockout.AllowedForNewUsers = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
})
.AddEntityFrameworkStores<TransitOpsDbContext>()
.AddDefaultTokenProviders();

// 3. JWT Authentication & RBAC Authorization Policies
var jwtSecret = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Configure a private JWT signing key using Jwt:Key.");
if (Encoding.UTF8.GetByteCount(jwtSecret) < 32)
{
    throw new InvalidOperationException("Jwt:Key must contain at least 32 UTF-8 bytes.");
}
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Configure Jwt:Issuer.");
var jwtAudience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Configure Jwt:Audience.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
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
        OnTokenValidated = async context =>
        {
            var userId = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var tokenStamp = context.Principal?.FindFirst("security_stamp")?.Value;
            if (string.IsNullOrWhiteSpace(userId) || tokenStamp is null)
            {
                context.Fail("The access token is no longer valid.");
                return;
            }

            var userManager = context.HttpContext.RequestServices
                .GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByIdAsync(userId);
            if (user is null || !string.Equals(user.SecurityStamp, tokenStamp, StringComparison.Ordinal))
                context.Fail("The access token is no longer valid.");
        },
        OnMessageReceived = context =>
        {
            var path = context.HttpContext.Request.Path;
            if (path.StartsWithSegments("/hubs") &&
                !string.IsNullOrEmpty(context.Request.Query["access_token"]))
            {
                context.Token = context.Request.Query["access_token"];
            }
            else if (context.Request.Cookies.TryGetValue("transitops_access", out var cookieToken))
            {
                context.Token = cookieToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    var authenticatedTenant = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .RequireClaim("tenant_id")
        .Build();
    options.DefaultPolicy = authenticatedTenant;
    options.FallbackPolicy = authenticatedTenant;
    options.AddPolicy("FleetManagerOnly", policy => policy.RequireRole(UserRole.FleetManager.ToString()));
    options.AddPolicy("DriverOnly", policy => policy.RequireRole(UserRole.Driver.ToString()));
    options.AddPolicy("SafetyOfficerOnly", policy => policy.RequireRole(UserRole.SafetyOfficer.ToString()));
    options.AddPolicy("FinancialAnalystOnly", policy => policy.RequireRole(UserRole.FinancialAnalyst.ToString()));
});

// 4. SignalR Real-Time Hub
builder.Services.AddSignalR();

// 5. Hangfire Background Job Processing
builder.Services.AddHangfire(configuration => configuration
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UsePostgreSqlStorage(c => c.UseNpgsqlConnection(connectionString)));
builder.Services.AddHangfireServer(options => options.WorkerCount = 2);

builder.Services.AddScoped<IHangfireJobs, HangfireJobs>();

// 6. Application Services & FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<CreateVehicleValidator>();
builder.Services.AddScoped<IKpiService, KpiService>();
builder.Services.AddScoped<ISafetyScoreService, SafetyScoreService>();
builder.Services.AddScoped<ICsvExportService, CsvExportService>();
builder.Services.AddScoped<IPdfReportService, QuestPdfReportService>();
builder.Services.Configure<SaasOnboardingOptions>(builder.Configuration.GetSection("SaasOnboarding"));
builder.Services.Configure<RazorpayOptions>(builder.Configuration.GetSection("Razorpay"));
builder.Services.Configure<SmtpEmailOptions>(builder.Configuration.GetSection("Email:Smtp"));
builder.Services.Configure<PublicApplicationOptions>(builder.Configuration.GetSection("PublicApplication"));
builder.Services.AddHttpClient("Razorpay", client =>
{
    client.BaseAddress = new Uri("https://api.razorpay.com/v1/");
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddScoped<ISaasOnboardingService, SaasOnboardingService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

// 7. CORS
builder.Services.AddCors(options =>
{
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? ["http://localhost:3000"];
    options.AddPolicy("TransitOpsFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();
builder.Services.AddExceptionHandler<OnboardingExceptionHandler>();

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("onboarding", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

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
// Hosting platforms terminate HTTPS at a proxy. Without the forwarded headers the app would see
// plain HTTP from one IP: auth cookies would lack the Secure flag and every user would share one
// login rate-limit bucket.
var forwardedHeaders = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};
if (app.Configuration.GetValue<bool>("ReverseProxy:TrustAllProxies"))
{
    forwardedHeaders.KnownIPNetworks.Clear();
    forwardedHeaders.KnownProxies.Clear();
}
app.UseForwardedHeaders(forwardedHeaders);
app.UseExceptionHandler();
// The production image puts the built React app in wwwroot so the UI, API and SignalR share one origin.
// Locally the React dev server serves the UI and there is no wwwroot, so skip static files there.
var hasWebRoot = Directory.Exists(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"));
if (hasWebRoot)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}
app.UseRouting();
app.UseCors("TransitOpsFrontend");
app.UseRateLimiter();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
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

if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = [new FleetManagerDashboardAuthorizationFilter()]
    });
}

app.MapControllers();
app.MapHub<TransitOpsHub>("/hubs/transitops");
// Liveness probe for the hosting platform; anonymous and outside every rate limit.
app.MapHealthChecks("/api/health").AllowAnonymous().DisableRateLimiting();
if (hasWebRoot && File.Exists(Path.Combine(app.Environment.WebRootPath!, "index.html")))
{
    // Client-side routes such as /vehicles load the SPA; unknown /api paths still return 404.
    app.MapFallbackToFile("{*path:regex(^(?!api/|hubs/|swagger).*$)}", "index.html").AllowAnonymous();
}

// Create/upgrade the schema and seed the demo organization (see Startup/).
DatabaseInitializer.Initialize(app, seedDemoData, demoPassword);
RecurringJobs.Register(app);

app.Run();
