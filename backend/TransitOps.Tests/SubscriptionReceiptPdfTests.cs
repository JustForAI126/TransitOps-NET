using TransitOps.Application.Reports;

namespace TransitOps.Tests;

public sealed class SubscriptionReceiptPdfTests
{
    [Theory]
    [InlineData(749900, "Rupees Seven Thousand Four Hundred Ninety-Nine Only")]
    [InlineData(1999950, "Rupees Nineteen Thousand Nine Hundred Ninety-Nine and Fifty Paise Only")]
    [InlineData(1234567800, "Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight Only")]
    [InlineData(50, "Rupees Zero and Fifty Paise Only")]
    public void AmountInWordsUsesIndianNumberingSystem(long paise, string expected) =>
        Assert.Equal(expected, SubscriptionReceiptPdf.AmountInWords(paise));

    [Fact]
    public void AmountUsesIndianDigitGrouping() =>
        Assert.Equal("₹1,23,456.78", SubscriptionReceiptPdf.FormatAmount(12345678));

    [Fact]
    public void ReceiptNumberIsStableAndUsesIndianDate()
    {
        var id = Guid.Parse("3f9a12bc-1111-2222-3333-444455556666");
        // 20:00 UTC on 19 Oct is already 20 Oct in India.
        var paid = new DateTimeOffset(2026, 10, 19, 20, 0, 0, TimeSpan.Zero);
        Assert.Equal("TO-20261020-3F9A12BC", SubscriptionReceiptPdf.ReceiptNumberFor(id, paid));
    }

    [Fact]
    public void GeneratesPdfDocument()
    {
        var paid = DateTimeOffset.UtcNow;
        var pdf = SubscriptionReceiptPdf.Generate(new SubscriptionReceiptData(
            "TO-TEST", paid, "Org", "Name", "a@example.com", "Growth", ["Feature"], 1,
            paid, paid.AddMonths(1), 749900, "INR", "order_1", "pay_1", true, "support@example.com"));

        Assert.True(pdf.Length > 1000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
