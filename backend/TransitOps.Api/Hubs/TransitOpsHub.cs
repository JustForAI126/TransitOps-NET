using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace TransitOps.Api.Hubs;

public interface ITransitOpsClient
{
    Task ReceiveTripDispatched(object tripData);
    Task ReceiveTripCompleted(object completionData);
    Task ReceiveVehicleStatusChanged(string vehicleId, string newStatus);
    Task ReceiveDriverStatusChanged(string driverId, string newStatus);
    Task ReceiveNotification(object notification);
}

public class TransitOpsHub : Hub<ITransitOpsClient>
{
    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var tenantId = Context.User?.FindFirst("tenant_id")?.Value
            ?? httpContext?.Request.Query["tenantId"].ToString();

        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? Context.User?.FindFirst("sub")?.Value
            ?? httpContext?.Request.Query["userId"].ToString();

        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
        }

        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
        }

        await base.OnConnectedAsync();
    }

    public async Task JoinTenantGroup(string tenantId)
    {
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
        }
    }

    public async Task LeaveTenantGroup(string tenantId)
    {
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"tenant_{tenantId}");
        }
    }

    public async Task BroadcastDispatchEvent(string tenantId, object tripData)
    {
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Clients.Group($"tenant_{tenantId}").ReceiveTripDispatched(tripData);
        }
    }

    public async Task SendTenantNotification(string tenantId, object notification)
    {
        if (!string.IsNullOrEmpty(tenantId))
        {
            await Clients.Group($"tenant_{tenantId}").ReceiveNotification(notification);
        }
    }

    public async Task SendUserNotification(string userId, object notification)
    {
        if (!string.IsNullOrEmpty(userId))
        {
            await Clients.Group($"user_{userId}").ReceiveNotification(notification);
        }
    }
}
