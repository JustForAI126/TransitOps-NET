using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using TransitOps.Domain.Entities;

namespace TransitOps.Application.Reports;

public sealed record VehicleRoiSummary(
    string RegistrationNumber,
    string Name,
    string Type,
    decimal AcquisitionCost,
    decimal Revenue,
    decimal MaintenanceCost,
    decimal FuelCost,
    decimal OperatingProfit,
    decimal RoiPercent);

public sealed record FleetRoiDashboardMetrics(
    int ActiveVehicles,
    int AvailableVehicles,
    int VehiclesInMaintenance,
    int ActiveTrips,
    int PendingTrips,
    int DriversOnDuty,
    decimal FleetUtilizationPercent,
    decimal AverageRevenuePerCompletedTrip,
    decimal AverageTripDistanceKm,
    decimal AverageOperatingCostPerVehicle,
    decimal AverageOperatingProfitPerVehicle,
    decimal AverageVehicleRoiPercent);

public interface IPdfReportService
{
    byte[] GenerateFinancialLedgerPdf(IEnumerable<Trip> completedTrips, decimal totalOpex, decimal grossRevenue, decimal netProfit);
    byte[] GenerateTripTurnInReceiptPdf(Trip trip);
    byte[] GenerateFleetRoiPdf(
        IEnumerable<VehicleRoiSummary> vehicleSummaries,
        FleetRoiDashboardMetrics dashboardMetrics);
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

    public byte[] GenerateFleetRoiPdf(
        IEnumerable<VehicleRoiSummary> vehicleSummaries,
        FleetRoiDashboardMetrics dashboardMetrics)
    {
        var rows = vehicleSummaries.ToArray();
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(30);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(style => style.FontSize(9).FontFamily("Arial"));

                page.Header().Row(row =>
                {
                    row.RelativeItem().Column(column =>
                    {
                        column.Item().Text("TransitOps").FontSize(22).Bold().FontColor(Colors.Amber.Darken3);
                        column.Item().Text("Fleet Vehicle ROI Summary").FontSize(12).FontColor(Colors.Grey.Darken2);
                    });
                    row.ConstantItem(140).Text($"As of {DateTime.UtcNow:yyyy-MM-dd}").AlignRight();
                });

                page.Content().PaddingVertical(18).Column(column =>
                {
                    column.Item().Text("Fleet Dashboard KPIs").FontSize(12).Bold();
                    column.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            for (var index = 0; index < 4; index++)
                                columns.RelativeColumn();
                        });
                        AddMetricCell(table, "ACTIVE VEHICLES", dashboardMetrics.ActiveVehicles.ToString());
                        AddMetricCell(table, "AVAILABLE", dashboardMetrics.AvailableVehicles.ToString());
                        AddMetricCell(table, "IN SHOP", dashboardMetrics.VehiclesInMaintenance.ToString());
                        AddMetricCell(table, "FLEET UTILIZATION", $"{dashboardMetrics.FleetUtilizationPercent:N1}%");
                        AddMetricCell(table, "ACTIVE TRIPS", dashboardMetrics.ActiveTrips.ToString());
                        AddMetricCell(table, "PENDING TRIPS", dashboardMetrics.PendingTrips.ToString());
                        AddMetricCell(table, "DRIVERS ON DUTY", dashboardMetrics.DriversOnDuty.ToString());
                        AddMetricCell(table, "COMPLETED TRIP AVG DISTANCE", $"{dashboardMetrics.AverageTripDistanceKm:N1} km");
                    });

                    column.Item().PaddingTop(12).Text("Fleet Averages").FontSize(12).Bold();
                    column.Item().Text("Trip averages use completed trips; per-vehicle averages use all vehicles in this organization.")
                        .FontSize(8).FontColor(Colors.Grey.Darken2);
                    column.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            for (var index = 0; index < 3; index++)
                                columns.RelativeColumn();
                        });
                        AddMetricCell(table, "AVG REVENUE / COMPLETED TRIP", $"₹{dashboardMetrics.AverageRevenuePerCompletedTrip:N0}");
                        AddMetricCell(table, "AVG OPERATING COST / VEHICLE", $"₹{dashboardMetrics.AverageOperatingCostPerVehicle:N0}");
                        AddMetricCell(table, "AVG OPERATING PROFIT / VEHICLE", $"₹{dashboardMetrics.AverageOperatingProfitPerVehicle:N0}");
                        AddMetricCell(table, "AVG VEHICLE ROI", $"{dashboardMetrics.AverageVehicleRoiPercent:N1}%");
                    });

                    column.Item().PaddingTop(12).Text("ROI = (Revenue − Maintenance − Fuel) / Acquisition Cost × 100")
                        .FontSize(10).Bold();
                    column.Item().PaddingTop(10).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(95);
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1.3f);
                            columns.RelativeColumn(1.3f);
                            columns.RelativeColumn(1.3f);
                            columns.RelativeColumn(1.3f);
                            columns.RelativeColumn(1.3f);
                            columns.RelativeColumn(0.9f);
                        });
                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Registration").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Vehicle").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Type").Bold();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Acquisition (₹)").Bold().AlignRight();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Revenue (₹)").Bold().AlignRight();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Maintenance (₹)").Bold().AlignRight();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Fuel (₹)").Bold().AlignRight();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("Operating Profit (₹)").Bold().AlignRight();
                            header.Cell().Background(Colors.Grey.Lighten2).Padding(4).Text("ROI").Bold().AlignRight();
                        });
                        foreach (var summary in rows)
                        {
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(summary.RegistrationNumber);
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(summary.Name);
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text(summary.Type);
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"₹{summary.AcquisitionCost:N0}").AlignRight();
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"₹{summary.Revenue:N0}").AlignRight();
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"₹{summary.MaintenanceCost:N0}").AlignRight();
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"₹{summary.FuelCost:N0}").AlignRight();
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"₹{summary.OperatingProfit:N0}").AlignRight();
                            table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten3).Padding(4).Text($"{summary.RoiPercent:N1}%").AlignRight();
                        }
                        if (rows.Length == 0)
                            table.Cell().ColumnSpan(9).Padding(8).Text("No vehicles are available for this report.");
                    });
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("TransitOps • Confidential Fleet Report • Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        });

        return document.GeneratePdf();
    }

    private static void AddMetricCell(TableDescriptor table, string label, string value)
    {
        table.Cell().Background(Colors.Grey.Lighten4).Padding(6).Column(column =>
        {
            column.Item().Text(label).FontSize(7).Bold().FontColor(Colors.Grey.Darken1);
            column.Item().PaddingTop(2).Text(value).FontSize(11).Bold();
        });
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
