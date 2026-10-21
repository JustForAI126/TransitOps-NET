using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using TransitOps.Application.Services;

namespace TransitOps.Infrastructure.Services;

/// <summary>
/// Sends email through any SMTP server with MailKit. System.Net.Mail.SmtpClient is not used because it
/// never authenticates with some providers (Brevo answers "5.7.0 Please authenticate first").
/// </summary>
public sealed class SmtpEmailSender : IEmailSender
{
    private readonly SmtpEmailOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<SmtpEmailOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.Host) &&
        _options.Port is > 0 and <= 65535 &&
        !string.IsNullOrWhiteSpace(_options.FromAddress) &&
        !string.IsNullOrWhiteSpace(_options.UserName) &&
        !string.IsNullOrWhiteSpace(_options.Password);

    public string FromAddress => _options.FromAddress;

    public async Task<bool> TrySendAsync(
        string recipient,
        string subject,
        string textBody,
        string? htmlBody = null,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
            return false;
        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_options.FromName, _options.FromAddress));
            message.To.Add(MailboxAddress.Parse(recipient));
            message.Subject = subject;

            var body = new BodyBuilder { TextBody = textBody, HtmlBody = htmlBody };
            foreach (var attachment in attachments ?? [])
                body.Attachments.Add(attachment.FileName, attachment.Content, ContentType.Parse(attachment.MediaType));
            message.Body = body.ToMessageBody();

            using var smtp = new SmtpClient { Timeout = 30_000 };
            // EnableSsl means TLS: implicit on port 465, STARTTLS elsewhere (587, 2525). Off only for local test servers.
            var security = !_options.EnableSsl
                ? SecureSocketOptions.None
                : _options.Port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            await smtp.ConnectAsync(_options.Host, _options.Port, security, cancellationToken);
            if (smtp.Capabilities.HasFlag(SmtpCapabilities.Authentication))
                await smtp.AuthenticateAsync(_options.UserName, _options.Password, cancellationToken);
            await smtp.SendAsync(message, cancellationToken);
            await smtp.DisconnectAsync(true, cancellationToken);
            return true;
        }
        catch (Exception exception) when (exception is SmtpCommandException or SmtpProtocolException
            or AuthenticationException or SslHandshakeException or IOException
            or System.Net.Sockets.SocketException or ParseException or TimeoutException)
        {
            _logger.LogError(exception, "Could not deliver an email via {Host}:{Port}.", _options.Host, _options.Port);
            return false;
        }
    }
}
