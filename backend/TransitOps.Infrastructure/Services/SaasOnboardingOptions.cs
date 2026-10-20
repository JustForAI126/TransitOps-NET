namespace TransitOps.Infrastructure.Services;

public sealed class SaasOnboardingOptions
{
    public List<Plan> Plans { get; set; } = [];

    public sealed class Plan
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public long AmountPaise { get; set; }
        public string Currency { get; set; } = "INR";
        public int TermMonths { get; set; } = 1;
        public List<string> Features { get; set; } = [];
    }
}

public sealed class RazorpayOptions
{
    public string KeyId { get; set; } = string.Empty;
    public string KeySecret { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
}

public sealed class SmtpEmailOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool EnableSsl { get; set; } = true;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = "TransitOps";
}

public sealed class PublicApplicationOptions
{
    public string BaseUrl { get; set; } = "http://localhost:3000";
}
