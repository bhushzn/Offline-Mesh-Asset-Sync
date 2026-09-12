import { TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';

export interface TransportMessageListener {
  (message: any, peerId: string, transportType: TransportType): void;
}

export interface TransportStateListener {
  (peerId: string, status: TransportStatus, transportType: TransportType): void;
}

export interface IMeshTransport {
  readonly type: TransportType;
  getStatus(): TransportStatus;
  getCapabilities(): TransportCapabilities;
  discover(): Promise<string[]>;
  connect(peerId: string, options?: any): Promise<boolean>;
  disconnect(peerId: string): Promise<void>;
  send(peerId: string, message: any): Promise<boolean>;
  broadcast(message: any): Promise<number>; // returns count of recipients
  onMessage(listener: TransportMessageListener): () => void;
  onStateChange(listener: TransportStateListener): () => void;
  destroy(): Promise<void>;
}
