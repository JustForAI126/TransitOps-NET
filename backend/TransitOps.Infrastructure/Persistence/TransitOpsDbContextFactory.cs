using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TransitOps.Infrastructure.Persistence;

public sealed class TransitOpsDbContextFactory : IDesignTimeDbContextFactory<TransitOpsDbContext>
{
    public TransitOpsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<TransitOpsDbContext>()
            .UseNpgsql("Host=localhost;Database=transitops_design_time;Username=design_time;Password=design_time")
            .Options;
        return new TransitOpsDbContext(options);
    }
}
