namespace TransitOps.Application.Services;

public sealed record EmailAttachment(string FileName, byte[] Content, string MediaType);

public interface IEmailSender
{
    /// <summary>True when SMTP host, port, sender and credentials are all configured.</summary>
    bool IsConfigured { get; }

    /// <summary>Sender address shown to recipients, also used as the support contact.</summary>
    string FromAddress { get; }

    /// <summary>Sends a plain-text email with an optional HTML alternative. Returns false on delivery failure.</summary>
    Task<bool> TrySendAsync(
        string recipient,
        string subject,
        string textBody,
        string? htmlBody = null,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken cancellationToken = default);
}
