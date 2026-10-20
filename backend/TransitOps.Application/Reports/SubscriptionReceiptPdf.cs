using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace TransitOps.Application.Reports;

/// <summary>Everything printed on a subscription payment receipt.</summary>
public sealed record SubscriptionReceiptData(
    string ReceiptNumber,
    DateTimeOffset PaidAtUtc,
    string OrganizationName,
    string BillingName,
    string BillingEmail,
    string PlanName,
    IReadOnlyList<string> PlanFeatures,
    int TermMonths,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset EndsAtUtc,
    long AmountPaise,
    string Currency,
    string RazorpayOrderId,
    string RazorpayPaymentId,
    bool IsTestMode,
    string SupportEmail);

public static class SubscriptionReceiptPdf
{
    private static readonly TimeZoneInfo India = FindIndiaTimeZone();
    private static readonly CultureInfo IndianCulture = CultureInfo.GetCultureInfo("en-IN");

    private const string Ink = "#1F2430";
    private const string Muted = "#6B7280";
    private const string Accent = "#B45309";
    private const string Line = "#E5E7EB";
    private const string Panel = "#F9FAFB";

    static SubscriptionReceiptPdf()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    /// <summary>Stable receipt number derived from the purchase, e.g. TO-20261020-3F9A12BC.</summary>
    public static string ReceiptNumberFor(Guid purchaseId, DateTimeOffset paidAtUtc) =>
        $"TO-{ToIst(paidAtUtc):yyyyMMdd}-{purchaseId.ToString("N")[..8].ToUpperInvariant()}";

    public static string FormatAmount(long paise) =>
        "₹" + (paise / 100m).ToString("#,##,##0.00", IndianCulture);

    public static byte[] Generate(SubscriptionReceiptData data)
    {
        var amount = FormatAmount(data.AmountPaise);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(Ink));

                page.Header().Column(header =>
                {
                    header.Item().Row(row =>
                    {
                        row.RelativeItem().Column(brand =>
                        {
                            brand.Item().Text("TransitOps").FontSize(22).Bold().FontColor(Accent);
                            brand.Item().Text("Fleet operations platform").FontSize(9).FontColor(Muted);
                        });
                        row.RelativeItem().AlignRight().Column(title =>
                        {
                            title.Item().AlignRight().Text("PAYMENT RECEIPT").FontSize(16).Bold();
                            title.Item().AlignRight().Text(data.ReceiptNumber).FontSize(10).FontColor(Muted);
                            if (data.IsTestMode)
                                title.Item().AlignRight().PaddingTop(4)
                                    .Background("#FEF3C7").PaddingHorizontal(6).PaddingVertical(2)
                                    .Text("TEST MODE — NO REAL MONEY CHARGED").FontSize(8).Bold().FontColor(Accent);
                        });
                    });
                    header.Item().PaddingTop(12).LineHorizontal(1.5f).LineColor(Accent);
                });

                page.Content().PaddingTop(18).Column(col =>
                {
                    col.Spacing(16);

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            Label(c, "BILLED TO");
                            c.Item().Text(data.OrganizationName).Bold().FontSize(12);
                            c.Item().Text(data.BillingName);
                            c.Item().Text(data.BillingEmail).FontColor(Muted);
                        });
                        row.RelativeItem().Column(c =>
                        {
                            Label(c, "RECEIPT DETAILS");
                            KeyValue(c, "Receipt no.", data.ReceiptNumber);
                            KeyValue(c, "Payment date", $"{ToIst(data.PaidAtUtc):dd MMM yyyy, hh:mm tt} IST");
                            KeyValue(c, "Status", "Paid");
                        });
                    });

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(5);
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(2);
                        });

                        table.Header(h =>
                        {
                            h.Cell().Background(Ink).Padding(8).Text("Description").FontColor(Colors.White).Bold();
                            h.Cell().Background(Ink).Padding(8).Text("Service period").FontColor(Colors.White).Bold();
                            h.Cell().Background(Ink).Padding(8).AlignRight().Text("Amount").FontColor(Colors.White).Bold();
                        });

                        table.Cell().BorderBottom(1).BorderColor(Line).Padding(8).Column(c =>
                        {
                            c.Item().Text($"TransitOps {data.PlanName} plan").Bold();
                            c.Item().Text($"{data.TermMonths}-month subscription, one-time charge (no auto-renewal)")
                                .FontSize(9).FontColor(Muted);
                            foreach (var feature in data.PlanFeatures)
                                c.Item().Text($"• {feature}").FontSize(9).FontColor(Muted);
                        });
                        table.Cell().BorderBottom(1).BorderColor(Line).Padding(8)
                            .Text($"{ToIst(data.StartsAtUtc):dd MMM yyyy} – {ToIst(data.EndsAtUtc):dd MMM yyyy}");
                        table.Cell().BorderBottom(1).BorderColor(Line).Padding(8).AlignRight().Text(amount);
                    });

                    col.Item().AlignRight().Width(240).Column(totals =>
                    {
                        totals.Item().Row(r =>
                        {
                            r.RelativeItem().Text("Subtotal").FontColor(Muted);
                            r.RelativeItem().AlignRight().Text(amount);
                        });
                        totals.Item().PaddingTop(6).Background(Panel).Padding(8).Row(r =>
                        {
                            r.RelativeItem().Text("Total paid").Bold().FontSize(12);
                            r.RelativeItem().AlignRight().Text(amount).Bold().FontSize(12).FontColor(Accent);
                        });
                    });

                    col.Item().Text($"Amount in words: {AmountInWords(data.AmountPaise)}").Italic().FontSize(9);

                    col.Item().Background(Panel).Padding(12).Column(c =>
                    {
                        Label(c, "PAYMENT INFORMATION");
                        KeyValue(c, "Payment gateway", data.IsTestMode ? "Razorpay (Test Mode)" : "Razorpay");
                        KeyValue(c, "Payment ID", data.RazorpayPaymentId);
                        KeyValue(c, "Order ID", data.RazorpayOrderId);
                        KeyValue(c, "Currency", data.Currency);
                    });
                });

                page.Footer().Column(footer =>
                {
                    footer.Item().LineHorizontal(0.5f).LineColor(Line);
                    footer.Item().PaddingTop(6).Text(
                            "This is a computer-generated payment receipt and does not require a signature. " +
                            "It is not a tax invoice.")
                        .FontSize(8).FontColor(Muted);
                    footer.Item().Text($"Questions about this payment? Contact {data.SupportEmail} and quote {data.ReceiptNumber}.")
                        .FontSize(8).FontColor(Muted);
                });
            });
        }).GeneratePdf();
    }

    private static void Label(ColumnDescriptor column, string text) =>
        column.Item().PaddingBottom(4).Text(text).FontSize(8).Bold().FontColor(Muted).LetterSpacing(0.05f);

    private static void KeyValue(ColumnDescriptor column, string key, string value) =>
        column.Item().Row(r =>
        {
            r.ConstantItem(95).Text(key).FontColor(Muted);
            r.RelativeItem().Text(value);
        });

    private static DateTime ToIst(DateTimeOffset value) => TimeZoneInfo.ConvertTime(value, India).DateTime;

    private static TimeZoneInfo FindIndiaTimeZone()
    {
        foreach (var id in new[] { "Asia/Kolkata", "India Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
        }
        return TimeZoneInfo.CreateCustomTimeZone("IST", TimeSpan.FromHours(5.5), "IST", "IST");
    }

    /// <summary>Indian-system words, e.g. 749900 paise → "Rupees Seven Thousand Four Hundred Ninety-Nine Only".</summary>
    public static string AmountInWords(long paise)
    {
        var rupees = paise / 100;
        var remainder = paise % 100;
        var words = "Rupees " + (rupees == 0 ? "Zero" : NumberToWords(rupees));
        if (remainder > 0)
            words += " and " + NumberToWords(remainder) + " Paise";
        return words + " Only";
    }

    private static readonly string[] Ones =
    {
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    };
    private static readonly string[] Tens =
        { "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };

    private static string NumberToWords(long n)
    {
        var parts = new List<string>();
        void Add(long value, string unit)
        {
            if (value > 0) parts.Add(BelowHundredWords(value) + (unit.Length > 0 ? " " + unit : ""));
        }

        if (n >= 10_000_000)
        {
            parts.Add(NumberToWords(n / 10_000_000) + " Crore");
            n %= 10_000_000;
        }
        Add(n / 100_000, "Lakh");
        n %= 100_000;
        Add(n / 1000, "Thousand");
        n %= 1000;
        Add(n / 100, "Hundred");
        n %= 100;
        Add(n, "");
        return string.Join(" ", parts);
    }

    private static string BelowHundredWords(long n) =>
        n < 20 ? Ones[n] : Tens[n / 10] + (n % 10 > 0 ? "-" + Ones[n % 10] : "");
}
