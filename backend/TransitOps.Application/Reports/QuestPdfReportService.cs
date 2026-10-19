using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TransitOps.Domain.Entities;

namespace TransitOps.Application.Reports;

public interface IPdfReportService
{
    byte[] GenerateFinancialLedgerPdf(IEnumerable<Trip> completedTrips, decimal totalOpex, decimal grossRevenue, decimal netProfit);
    byte[] GenerateTripTurnInReceiptPdf(Trip trip);
}

public class QuestPdfReportService : IPdfReportService
{
    static QuestPdfReportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] GenerateFinancialLedgerPdf(IEnumerable<Trip> completedTrips, decimal totalOpex, decimal grossRevenue, decimal netProfit)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Arial"));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("TransitOps").FontSize(22).Bold().FontColor(Colors.Amber.Darken3);
                        col.Item().Text("Fleet Operations Financial Ledger & Profitability Audit").FontSize(11).FontColor(Colors.Grey.Darken2);
                    });

                    row.ConstantItem(140).Column(col =>
                    {
                        col.Item().Text($"Date: {DateTime.UtcNow:yyyy-MM-dd}").AlignRight();
                        col.Item().Text("Currency: INR (₹)").Bold().AlignRight();
                    });
                });

                page.Content().PaddingVertical(15).Column(col =>
                {
                    // Executive KPI Summary Box
                    col.Item().Background(Colors.Grey.Lighten4).Padding(12).Row(r =>
                    {
                        r.RelativeItem().Column(c =>
                        {
                            c.Item().Text("GROSS REVENUE").FontSize(8).Bold().FontColor(Colors.Grey.Darken1);
                            c.Item().Text($"₹{grossRevenue:N0}").FontSize(14).Bold().FontColor(Colors.Green.Darken2);
                        });

                        r.RelativeItem().Column(c =>
                        {
                            c.Item().Text("TOTAL OPEX").FontSize(8).Bold().FontColor(Colors.Grey.Darken1);
                            c.Item().Text($"₹{totalOpex:N0}").FontSize(14).Bold().FontColor(Colors.Red.Darken2);
                        });

                        r.RelativeItem().Column(c =>
                        {
                            c.Item().Text("NET PROFIT").FontSize(8).Bold().FontColor(Colors.Grey.Darken1);
                            c.Item().Text($"₹{netProfit:N0}").FontSize(14).Bold().FontColor(netProfit >= 0 ? Colors.Green.Darken2 : Colors.Red.Darken2);
                        });
                    });

                    col.Item().PaddingTop(20).Text("Completed Dispatches & Trip Ledgers").FontSize(12).Bold();

                    // Table
                    col.Item().PaddingTop(8).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(80);
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(2);
                            columns.ConstantColumn(70);
                            columns.ConstantColumn(80);
                            columns.ConstantColumn(80);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Trip Code").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Route").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Vehicle / Driver").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Distance").Bold().AlignRight();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Revenue (₹)").Bold().AlignRight();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Fuel (L)").Bold().AlignRight();
                        });

                        foreach (var trip in completedTrips)
                        {
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(trip.TripCode);
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"{trip.Source} → {trip.Destination}");
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"{trip.Vehicle?.Name ?? "Truck"} / {trip.Driver?.Name ?? "Driver"}");
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"{trip.PlannedDistanceKm} km").AlignRight();
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"₹{trip.Revenue:N0}").AlignRight();
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(trip.FuelConsumedLiters.HasValue ? $"{trip.FuelConsumedLiters.Value:F1}" : "—").AlignRight();
                        }
                    });
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("Generated autonomously by TransitOps Platform • Confidential Financial Audit Record • Page ");
                    x.CurrentPageNumber();
                    x.Span(" of ");
                    x.TotalPages();
                });
            });
        });

        return document.GeneratePdf();
    }

    public byte[] GenerateTripTurnInReceiptPdf(Trip trip)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A5.Landscape());
                page.Margin(20);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(col =>
                    {
                        col.Item().Text("TransitOps").FontSize(18).Bold().FontColor(Colors.Amber.Darken3);
                        col.Item().Text("Official Delivery Turn-in & Dispatch Receipt").FontSize(10).FontColor(Colors.Grey.Darken2);
                    });

                    row.ConstantItem(120).Text($"TRIP: {trip.TripCode}").Bold().FontSize(12).AlignRight();
                });

                page.Content().PaddingVertical(15).Column(col =>
                {
                    col.Item().Background(Colors.Grey.Lighten4).Padding(10).Row(r =>
                    {
                        r.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Origin: {trip.Source}").Bold();
                            c.Item().Text($"Destination: {trip.Destination}").Bold();
                            c.Item().Text($"Cargo Payload: {trip.CargoWeightKg:N0} kg");
                        });

                        r.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Vehicle: {trip.Vehicle?.Name ?? "Asset"} ({trip.Vehicle?.RegistrationNumber ?? ""})");
                            c.Item().Text($"Driver: {trip.Driver?.Name ?? "Operator"}");
                            c.Item().Text($"Planned Distance: {trip.PlannedDistanceKm} km");
                        });
                    });

                    col.Item().PaddingTop(15).Row(r =>
                    {
                        r.RelativeItem().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Column(c =>
                        {
                            c.Item().Text("Final Odometer Reading").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text($"{trip.FinalOdometerKm?.ToString("N0") ?? "—"} km").Bold().FontSize(14);
                        });

                        r.ConstantItem(10);

                        r.RelativeItem().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Column(c =>
                        {
                            c.Item().Text("Fuel Consumed").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text($"{trip.FuelConsumedLiters?.ToString("F1") ?? "—"} Liters").Bold().FontSize(14);
                        });

                        r.ConstantItem(10);

                        r.RelativeItem().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Column(c =>
                        {
                            c.Item().Text("Trip Freight Revenue").FontSize(8).FontColor(Colors.Grey.Darken1);
                            c.Item().Text($"₹{trip.Revenue:N0}").Bold().FontSize(14).FontColor(Colors.Green.Darken2);
                        });
                    });
                });

                page.Footer().AlignCenter().Text($"Turn-in timestamp: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC • TransitOps Autonomous Safe Record");
            });
        });

        return document.GeneratePdf();
    }
}
