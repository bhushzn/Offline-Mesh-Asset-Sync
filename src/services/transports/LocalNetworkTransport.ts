import { IMeshTransport, TransportMessageListener, TransportStateListener } from './MeshTransport';
import { TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';

export class LocalNetworkTransport implements IMeshTransport {
  readonly type: TransportType = 'LocalNetwork';
  private channel?: BroadcastChannel;
  private messageListeners = new Set<TransportMessageListener>();
  private stateListeners = new Set<TransportStateListener>();
  private status: TransportStatus = 'available';
  private localDeviceId: string;

  constructor(localDeviceId: string, channelName: string = 'fieldlink_tactical_mesh') {
    this.localDeviceId = localDeviceId;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(channelName);
        this.status = 'connected';
        this.channel.onmessage = (event) => {
          const raw = event.data;
          if (raw && raw.senderDeviceId && raw.senderDeviceId !== this.localDeviceId) {
            for (const listener of this.messageListeners) {
              listener(raw, raw.senderDeviceId, 'LocalNetwork');
            }
          }
        };
      } catch (err) {
        console.warn('[LocalNetwork] BroadcastChannel error:', err);
        this.status = 'unavailable';
      }
    } else {
      this.status = 'unavailable';
    }
  }

  public getStatus(): TransportStatus {
    return this.status;
  }

  public getCapabilities(): TransportCapabilities {
    const isSupported = typeof window !== 'undefined' && 'BroadcastChannel' in window;
    return {
      type: 'LocalNetwork',
      isAvailable: isSupported,
      isSupported,
      latencyMs: 1,
      bandwidthKbps: 50000,
      mtuBytes: 1048576,
      notes: 'Ultra-fast local memory bus / BroadcastChannel',
    };
  }

  public async discover(): Promise<string[]> {
    return [];
  }

  public async connect(peerId: string): Promise<boolean> {
    return this.status === 'connected';
  }

  public async disconnect(peerId: string): Promise<void> {
    // No-op for BroadcastChannel
  }

  public async send(peerId: string, message: any): Promise<boolean> {
    if (!this.channel) return false;
    try {
      this.channel.postMessage({
        ...message,
        targetDeviceId: peerId,
        senderDeviceId: this.localDeviceId,
      });
      return true;
    } catch {
      return false;
    }
  }

  public async broadcast(message: any): Promise<number> {
    if (!this.channel) return 0;
    try {
      this.channel.postMessage({
        ...message,
        senderDeviceId: this.localDeviceId,
      });
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

  public async destroy(): Promise<void> {
    if (this.channel) {
      this.channel.close();
    }
    this.messageListeners.clear();
    this.stateListeners.clear();
  }
}
