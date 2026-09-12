import { IMeshTransport, TransportMessageListener, TransportStateListener } from './MeshTransport';
import { TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';

export class BLETransport implements IMeshTransport {
  readonly type: TransportType = 'BLE';
  private messageListeners = new Set<TransportMessageListener>();
  private stateListeners = new Set<TransportStateListener>();
  private status: TransportStatus = 'unavailable';
  private activeDevice: any = null;
  private gattServer: any = null;
  private txCharacteristic: any = null;
  private rxCharacteristic: any = null;

  // Standard Tactical Custom GATT Service UUIDs
  public static readonly SERVICE_UUID = '0000ffd0-0000-1000-8000-00805f9b34fb';
  public static readonly TX_CHAR_UUID = '0000ffd1-0000-1000-8000-00805f9b34fb';
  public static readonly RX_CHAR_UUID = '0000ffd2-0000-1000-8000-00805f9b34fb';

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability() {
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator && (navigator as any).bluetooth) {
      this.status = 'available';
    } else {
      this.status = 'unavailable';
    }
  }

  public getStatus(): TransportStatus {
    this.checkAvailability();
    return this.status;
  }

  public getCapabilities(): TransportCapabilities {
    const isSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator && !!(navigator as any).bluetooth;
    return {
      type: 'BLE',
      isAvailable: isSupported,
      isSupported,
      latencyMs: 120,
      bandwidthKbps: 64,
      mtuBytes: 512,
      notes: isSupported 
        ? 'Web Bluetooth API (Requires HTTPS & User Gesture)' 
        : 'BLE unavailable on this device/browser (Safari/Firefox/iOS require native bridge)',
    };
  }

  public async discover(): Promise<string[]> {
    if (!this.getCapabilities().isAvailable) {
      return [];
    }

    try {
      const navBluetooth = (navigator as any).bluetooth;
      if (!navBluetooth || !navBluetooth.requestDevice) {
        return [];
      }

      // Web Bluetooth standard requires explicit user selection modal
      const device = await navBluetooth.requestDevice({
        acceptAllDevices: false,
        filters: [{ services: [BLETransport.SERVICE_UUID] }],
        optionalServices: ['generic_access', 'battery_service'],
      });

      if (device && device.id) {
        return [device.id];
      }
      return [];
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        console.warn('[BLE] Device discovery error:', err);
      }
      return [];
    }
  }

  public async connect(peerId: string): Promise<boolean> {
    if (!this.getCapabilities().isAvailable) {
      this.notifyState(peerId, 'unavailable');
      return false;
    }

    try {
      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        filters: [{ namePrefix: 'FIELDLINK' }],
        optionalServices: [BLETransport.SERVICE_UUID],
      });

      this.activeDevice = device;
      this.gattServer = await device.gatt.connect();
      const service = await this.gattServer.getPrimaryService(BLETransport.SERVICE_UUID);

      this.txCharacteristic = await service.getCharacteristic(BLETransport.TX_CHAR_UUID);
      this.rxCharacteristic = await service.getCharacteristic(BLETransport.RX_CHAR_UUID);

      await this.rxCharacteristic.startNotifications();
      this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder();
        try {
          const parsed = JSON.parse(decoder.decode(value));
          for (const listener of this.messageListeners) {
            listener(parsed, peerId, 'BLE');
          }
        } catch {
          // ignore
        }
      });

      this.status = 'connected';
      this.notifyState(peerId, 'connected');
      return true;
    } catch (err) {
      console.warn('[BLE] Connection failed:', err);
      this.notifyState(peerId, 'disconnected');
      return false;
    }
  }

  public async send(peerId: string, message: any): Promise<boolean> {
    if (!this.txCharacteristic) return false;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));
      await this.txCharacteristic.writeValue(data);
      return true;
    } catch {
      return false;
    }
  }

  public async broadcast(message: any): Promise<number> {
    if (this.status === 'connected') {
      const ok = await this.send(this.activeDevice?.id || 'ble-peer', message);
      return ok ? 1 : 0;
    }
    return 0;
  }

  public async disconnect(peerId: string): Promise<void> {
    if (this.gattServer && this.gattServer.connected) {
      this.gattServer.disconnect();
    }
    this.status = 'available';
    this.notifyState(peerId, 'disconnected');
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
      listener(peerId, status, 'BLE');
    }
  }

  public async destroy(): Promise<void> {
    if (this.activeDevice) {
      await this.disconnect(this.activeDevice.id);
    }
    this.messageListeners.clear();
    this.stateListeners.clear();
  }
}
