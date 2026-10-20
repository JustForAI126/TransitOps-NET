using TransitOps.Infrastructure.Services;

namespace TransitOps.Tests;

public sealed class PaymentSignatureVerifierTests
{
    [Fact]
    public void CheckoutSignatureMatchesRazorpayHmacSha256Format()
    {
        const string signature = "6c343620f1910da483982cf25b9dc33d709afdd25930f08964ef60b65aefa831";

        var actual = PaymentSignatureVerifier.ComputeCheckoutSignature(
            "test_secret",
            "order_123",
            "pay_456");

        Assert.Equal(signature, actual, ignoreCase: true);
        Assert.True(PaymentSignatureVerifier.VerifyHex(actual, signature));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-hex-signature")]
    [InlineData("0000000000000000000000000000000000000000000000000000000000000000")]
    public void VerifyHexRejectsMissingMalformedAndMismatchedSignatures(string? suppliedSignature)
    {
        var expected = PaymentSignatureVerifier.ComputeCheckoutSignature(
            "test_secret",
            "order_123",
            "pay_456");

        Assert.False(PaymentSignatureVerifier.VerifyHex(expected, suppliedSignature));
    }

    [Fact]
    public void WebhookSignatureCoversTheExactRequestBody()
    {
        const string body = "{\"event\":\"payment.captured\"}";
        var signature = PaymentSignatureVerifier.ComputeWebhookSignature("webhook_secret", body);

        Assert.True(PaymentSignatureVerifier.VerifyHex(signature, signature.ToLowerInvariant()));
        Assert.False(PaymentSignatureVerifier.VerifyHex(
            signature,
            PaymentSignatureVerifier.ComputeWebhookSignature("webhook_secret", body + " ")));
    }
}
