import * as signalR from '@microsoft/signalr';

type EventCallback = (data: any) => void;

class RealtimeService {
  private hubConnection: signalR.HubConnection | null = null;
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  public async connect() {
    if (this.hubConnection || this.eventSource) return;

    // 1. Try SignalR connection
    try {
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/transitops', {
          skipNegotiation: false,
          transport:
            signalR.HttpTransportType.ServerSentEvents |
            signalR.HttpTransportType.LongPolling,
        })
        .configureLogging(signalR.LogLevel.None)
        .withAutomaticReconnect()
        .build();

      this.hubConnection.on('ReceiveTripDispatched', (data) => this.emit('trip_dispatched', data));
      this.hubConnection.on('ReceiveTripCompleted', (data) => this.emit('trip_completed', data));
      this.hubConnection.on('ReceiveVehicleStatusChanged', (id, status) =>
        this.emit('vehicle_status', { vehicleId: id, status })
      );
      this.hubConnection.on('ReceiveNotification', (notif) => this.emit('notification', notif));

      await this.hubConnection.start();
      console.log('[TransitOps] SignalR real-time hub connected');
      return;
    } catch {
      // 2. Fallback to Server-Sent Events (SSE)
      this.connectSSE();
    }
  }

  private connectSSE() {
    try {
      this.eventSource = new EventSource('/api/events');

      this.eventSource.addEventListener('trip_dispatched', (e: MessageEvent) => {
        try {
          this.emit('trip_dispatched', JSON.parse(e.data));
        } catch { }
      });

      this.eventSource.addEventListener('trip_completed', (e: MessageEvent) => {
        try {
          this.emit('trip_completed', JSON.parse(e.data));
        } catch { }
      });

      this.eventSource.addEventListener('vehicle_status', (e: MessageEvent) => {
        try {
          this.emit('vehicle_status', JSON.parse(e.data));
        } catch { }
      });

      this.eventSource.addEventListener('notification', (e: MessageEvent) => {
        try {
          this.emit('notification', JSON.parse(e.data));
        } catch { }
      });
    } catch {
      // Real-time fallback silent
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
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.hubConnection = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const realtime = new RealtimeService();
