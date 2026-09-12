import { IMeshTransport, TransportMessageListener, TransportStateListener } from './MeshTransport';
import { TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';

export class CloudTransport implements IMeshTransport {
  readonly type: TransportType = 'Cloud';
  private ws: WebSocket | null = null;
  private messageListeners = new Set<TransportMessageListener>();
  private stateListeners = new Set<TransportStateListener>();
  private status: TransportStatus = 'disconnected';
  private localDeviceId: string;
  private wsUrl: string;
  private reconnectTimeout: any = null;

  constructor(localDeviceId: string, wsUrl: string) {
    this.localDeviceId = localDeviceId;
    this.wsUrl = wsUrl;
    this.connectGateway();
  }

  public getStatus(): TransportStatus {
    return this.status;
  }

  public getCapabilities(): TransportCapabilities {
    return {
      type: 'Cloud',
      isAvailable: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSupported: typeof WebSocket !== 'undefined',
      latencyMs: 80,
      bandwidthKbps: 20000,
      notes: 'Central HQ WebSocket Gateway (Fastify + PostgreSQL)',
    };
  }

  public connectGateway() {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      this.status = 'unavailable';
      return;
    }

    try {
      this.status = 'connecting';
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.status = 'connected';
        this.ws?.send(JSON.stringify({
          action: 'REGISTER_DEVICE',
          deviceId: this.localDeviceId,
        }));
        this.notifyState('cloud-gateway', 'connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          let innerMsg = null;
          let sender = null;

          if (data.action === 'MESH_PACKET' && data.message) {
            innerMsg = data.message;
            sender = data.fromDeviceId || data.senderDeviceId || data.message.senderDeviceId;
          } else if (data.message && data.message.type) {
            innerMsg = data.message;
            sender = data.senderDeviceId || data.message.senderDeviceId;
          } else if (data.type && data.senderDeviceId) {
            innerMsg = data;
            sender = data.senderDeviceId;
          }

          if (innerMsg && sender && sender !== this.localDeviceId) {
            for (const listener of this.messageListeners) {
              listener(innerMsg, sender, 'Cloud');
            }
          }
        } catch {
          // ignore
        }
      };

      this.ws.onerror = () => {
        this.status = 'disconnected';
        this.notifyState('cloud-gateway', 'disconnected');
      };

      this.ws.onclose = () => {
        this.status = 'disconnected';
        this.notifyState('cloud-gateway', 'disconnected');
        // Graceful reconnect with backoff
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connectGateway(), 10000);
      };
    } catch {
      this.status = 'disconnected';
    }
  }

  public async discover(): Promise<string[]> {
    return [];
  }

  public async connect(peerId: string): Promise<boolean> {
    return this.status === 'connected';
  }

  public async disconnect(peerId: string): Promise<void> {
    // No-op
  }

  public async send(peerId: string, message: any): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify({
        action: 'SEND_TO_DEVICE',
        fromDeviceId: this.localDeviceId,
        senderDeviceId: this.localDeviceId,
        targetDeviceId: peerId,
        message,
      }));
      return true;
    } catch {
      return false;
    }
  }

  public async broadcast(message: any): Promise<number> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return 0;
    }
    try {
      this.ws.send(JSON.stringify({
        action: 'MESH_PACKET',
        fromDeviceId: this.localDeviceId,
        senderDeviceId: this.localDeviceId,
        message,
      }));
      return 1;
    } catch {
      return 0;
    }
  }

  public onMessage(listener: TransportMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStateChange(listener: TransportStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyState(peerId: string, status: TransportStatus) {
    for (const listener of this.stateListeners) {
      listener(peerId, status, 'Cloud');
    }
  }

  public async destroy(): Promise<void> {
    clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
    }
    this.messageListeners.clear();
    this.stateListeners.clear();
  }
}
