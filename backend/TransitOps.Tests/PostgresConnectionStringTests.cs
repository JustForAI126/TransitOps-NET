using TransitOps.Api.Startup;

namespace TransitOps.Tests;

public sealed class PostgresConnectionStringTests
{
    private const string KeyValue =
        "Host=db.example.com;Port=5432;Database=postgres;Username=app;Password=secret;SSL Mode=Require;Maximum Pool Size=6";

    [Theory]
    [InlineData(KeyValue)]
    [InlineData("  " + KeyValue + "  ")]
    [InlineData("\"" + KeyValue + "\"")]
    [InlineData("\n" + KeyValue + "\r\n")]
    public void KeyValueStringsSurvivePastedWhitespaceAndQuotes(string value)
    {
        var builder = PostgresConnectionString.Build(value);
        Assert.Equal("db.example.com", builder.Host);
        Assert.Equal("app", builder.Username);
        Assert.Equal("secret", builder.Password);
        Assert.Equal(6, builder.MaxPoolSize);
    }

    [Fact]
    public void SupabaseUriIsParsedWithTlsRequired()
    {
        var builder = PostgresConnectionString.Build(
            "postgresql://postgres.ref:p%40ss@aws-0-ap-south-1.pooler.supabase.com:5432/postgres");
        Assert.Equal("aws-0-ap-south-1.pooler.supabase.com", builder.Host);
        Assert.Equal("postgres.ref", builder.Username);
        Assert.Equal("p@ss", builder.Password);
        Assert.Equal(Npgsql.SslMode.Require, builder.SslMode);
    }

    [Fact]
    public void InvalidValueGivesClearErrorWithoutLeakingThePassword()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            PostgresConnectionString.Build("\"ConnectionStrings:DefaultConnection\": \"Host=x;Password=topsecret\""));
        Assert.Contains("not a valid PostgreSQL connection string", error.Message);
        Assert.DoesNotContain("topsecret", error.Message);
    }
}
