using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace TransitOps.Api.Hubs;

public interface ITransitOpsClient
{
    Task ReceiveTripDispatched(object tripData);
    Task ReceiveTripCompleted(object completionData);
    Task ReceiveVehicleStatusChanged(string vehicleId, string newStatus);
    Task ReceiveDriverStatusChanged(string driverId, string newStatus);
    Task ReceiveMaintenanceUpdated(object updateData);
    Task ReceiveExpenseUpdated(object updateData);
    Task ReceiveNotification(object notification);
}

[Authorize]
public class TransitOpsHub : Hub<ITransitOpsClient>
{
    public override async Task OnConnectedAsync()
    {
        var tenantId = Context.User?.FindFirst("tenant_id")?.Value;
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? Context.User?.FindFirst("sub")?.Value;

        if (string.IsNullOrWhiteSpace(tenantId) || string.IsNullOrWhiteSpace(userId))
        {
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");

        await base.OnConnectedAsync();
    }

    public async Task JoinTenantGroup(string tenantId)
    {
        EnsureOwnTenant(tenantId);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
    }

    public async Task LeaveTenantGroup(string tenantId)
    {
        EnsureOwnTenant(tenantId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
    }

    private void EnsureOwnTenant(string requestedTenantId)
    {
        var tenantId = Context.User?.FindFirst("tenant_id")?.Value;
        if (string.IsNullOrWhiteSpace(tenantId) ||
            !string.Equals(tenantId, requestedTenantId, StringComparison.Ordinal))
        {
            throw new HubException("Access to the requested tenant is denied.");
        }
    }
}
