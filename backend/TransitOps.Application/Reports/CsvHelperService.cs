using System.Globalization;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;

namespace TransitOps.Application.Reports;

public interface ICsvExportService
{
    byte[] ExportToCsv<T>(IEnumerable<T> records);
}

public class CsvExportService : ICsvExportService
{
    public byte[] ExportToCsv<T>(IEnumerable<T> records)
    {
        using var memoryStream = new MemoryStream();
        using (var writer = new StreamWriter(memoryStream, Encoding.UTF8))
        using (var csv = new CsvWriter(writer, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true
        }))
        {
            csv.WriteRecords(records);
        }

        return memoryStream.ToArray();
    }
}
