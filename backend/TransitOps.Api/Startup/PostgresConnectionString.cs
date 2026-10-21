namespace TransitOps.Api.Startup;

/// <summary>
/// Accepts either a key=value connection string or a postgres:// URI (as Supabase shows it) and
/// returns Npgsql settings with TLS required unless the connection string says otherwise.
/// </summary>
public static class PostgresConnectionString
{
    public static Npgsql.NpgsqlConnectionStringBuilder Build(string value)
    {
        // Values pasted into hosting dashboards often carry stray whitespace or the quotes from a JSON file.
        value = value.Trim().Trim('"', '\'').Trim();
        var builder = new Npgsql.NpgsqlConnectionStringBuilder();

        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                builder.ConnectionString = value;
            }
            catch (ArgumentException exception)
            {
                // Never echo the value: it contains the database password.
                throw new InvalidOperationException(
                    "ConnectionStrings:DefaultConnection is not a valid PostgreSQL connection string. Use either " +
                    "'Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require' or a " +
                    "'postgresql://user:password@host:5432/postgres' URI, with nothing before or after it.",
                    exception);
            }
            if (!builder.ContainsKey("SSL Mode")) builder.SslMode = Npgsql.SslMode.Require;
            return builder;
        }

        try
        {
            var uri = new Uri(value);
            builder.Host = uri.Host;
            builder.Port = uri.IsDefaultPort ? 5432 : uri.Port;
            builder.Database = string.IsNullOrWhiteSpace(uri.AbsolutePath.Trim('/')) ? "postgres" : Uri.UnescapeDataString(uri.AbsolutePath.Trim('/'));
            builder.SslMode = Npgsql.SslMode.Require;

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

        return builder;
    }
}
