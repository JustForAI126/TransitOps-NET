import * as signalR from '@microsoft/signalr';

type EventCallback = (data: any) => void;

class RealtimeService {
  private hubConnection: signalR.HubConnection | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public async connect() {
    if (this.hubConnection) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/transitops', {
        skipNegotiation: false,
        transport:
          signalR.HttpTransportType.ServerSentEvents |
          signalR.HttpTransportType.LongPolling,
      })
      .configureLogging(signalR.LogLevel.None)
      .withAutomaticReconnect()
      .build();
    this.hubConnection = connection;

    connection.on('ReceiveTripDispatched', (data) => this.emit('trip_dispatched', data));
    connection.on('ReceiveTripCompleted', (data) => this.emit('trip_completed', data));
    connection.on('ReceiveVehicleStatusChanged', (id, status) =>
      this.emit('vehicle_status', { vehicleId: id, status })
    );
    connection.on('ReceiveDriverStatusChanged', (id, status) =>
      this.emit('driver_status', { driverId: id, status })
    );
    connection.on('ReceiveMaintenanceUpdated', (data) => this.emit('maintenance_updated', data));
    connection.on('ReceiveExpenseUpdated', (data) => this.emit('expense_updated', data));
    connection.on('ReceiveNotification', (notif) => this.emit('notification', notif));

    try {
      await connection.start();
      console.log('[TransitOps] SignalR real-time hub connected');
    } catch (error) {
      this.hubConnection = null;
      await connection.stop();
      console.warn('[TransitOps] SignalR connection failed:', error);
    }
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error('[Realtime Error]', err);
        }
      });
    }
  }

  public disconnect() {
    if (!this.hubConnection) return;
    const connection = this.hubConnection;
    this.hubConnection = null;
    void connection.stop();
  }
}

export const realtime = new RealtimeService();
