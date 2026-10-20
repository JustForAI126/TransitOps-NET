using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TransitOps.Application.Services;

namespace TransitOps.Infrastructure.Services;

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
            using var message = new MailMessage
            {
                From = new MailAddress(_options.FromAddress, _options.FromName),
                Subject = subject,
                Body = textBody,
                IsBodyHtml = false
            };
            if (htmlBody is not null)
                message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(htmlBody, Encoding.UTF8, "text/html"));
            foreach (var attachment in attachments ?? [])
                message.Attachments.Add(new Attachment(new MemoryStream(attachment.Content), attachment.FileName, attachment.MediaType));
            message.To.Add(new MailAddress(recipient));

            using var smtp = new SmtpClient(_options.Host, _options.Port)
            {
                EnableSsl = _options.EnableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_options.UserName, _options.Password)
            };
            await smtp.SendMailAsync(message, cancellationToken);
            return true;
        }
        catch (SmtpException exception)
        {
            _logger.LogError(exception, "Could not deliver an email.");
            return false;
        }
        catch (FormatException exception)
        {
            _logger.LogError(exception, "Email sender or recipient address is invalid.");
            return false;
        }
    }
}
