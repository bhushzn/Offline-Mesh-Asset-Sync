import { IMeshTransport, TransportMessageListener, TransportStateListener } from './MeshTransport';
import { TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';
import { FieldlinkBle, isNativePlatform, BleDiscoveredPeer } from '../nativeBlePlugin';
import { deviceIdentity } from '../deviceIdentityService';

export class BLETransport implements IMeshTransport {
  readonly type: TransportType = 'BLE';
  private messageListeners = new Set<TransportMessageListener>();
  private stateListeners = new Set<TransportStateListener>();
  private status: TransportStatus = 'unavailable';

  // Native BLE state
  private isNative: boolean = false;
  private isAdvertising: boolean = false;
  private isScanning: boolean = false;
  private peerAddressToDeviceId = new Map<string, string>();
  private deviceIdToPeerAddress = new Map<string, string>();
  private connectedPeers = new Set<string>(); // deviceIds or addresses

  // Web Bluetooth state (browser fallback)
  private activeDevice: any = null;
  private gattServer: any = null;
  private txCharacteristic: any = null;
  private rxCharacteristic: any = null;

  public static readonly SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
  public static readonly CHAR_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

  private localDeviceId: string;
  private localDeviceName: string;

  constructor(deviceId?: string, deviceName?: string) {
    this.localDeviceId = deviceId || deviceIdentity.getDeviceId();
    this.localDeviceName = deviceName || deviceIdentity.getDeviceName();
    this.isNative = isNativePlatform();

    if (this.isNative) {
      this.initNativeBle();
    } else {
      this.checkWebBluetoothAvailability();
    }
  }

  private async initNativeBle() {
    try {
      const initResult = await FieldlinkBle.initialize();
      console.log('[BLE Native] Initialized:', initResult);

      if (!initResult.isSupported) {
        this.status = 'unavailable';
        return;
      }

      // Request runtime permissions on Android
      const permResult = await FieldlinkBle.requestBlePermissions();
      console.log('[BLE Native] Permissions granted:', permResult.granted);

      this.status = permResult.granted ? 'available' : 'unavailable';

      // Setup Listeners
      FieldlinkBle.addListener('peerDiscovered', (peer: BleDiscoveredPeer) => {
        this.handlePeerDiscovered(peer);
      });

      FieldlinkBle.addListener('peerConnected', (info) => {
        console.log('[BLE Native] Peer connected:', info);
        this.connectedPeers.add(info.peerAddress);
        const devId = this.peerAddressToDeviceId.get(info.peerAddress) || info.peerAddress;
        this.status = 'connected';
        this.notifyState(devId, 'connected');
      });

      FieldlinkBle.addListener('peerDisconnected', (info) => {
        console.log('[BLE Native] Peer disconnected:', info);
        this.connectedPeers.delete(info.peerAddress);
        const devId = this.peerAddressToDeviceId.get(info.peerAddress) || info.peerAddress;
        this.notifyState(devId, 'disconnected');
        if (this.connectedPeers.size === 0) {
          this.status = 'available';
        }
      });

      FieldlinkBle.addListener('packetReceived', (data) => {
        this.handleIncomingPacket(data.peerAddress, data.packet);
      });

      // Automatically start advertising this node and scanning for peers
      if (permResult.granted) {
        await this.startNativeMesh();
      }
    } catch (err) {
      console.error('[BLE Native] Initialization error:', err);
      this.status = 'unavailable';
    }
  }

  public async startNativeMesh(): Promise<boolean> {
    if (!this.isNative) return false;

    try {
      // 1. Start Advertising GATT Server
      const adv = await FieldlinkBle.startAdvertising({
        deviceId: this.localDeviceId,
        deviceName: this.localDeviceName,
      });
      this.isAdvertising = adv.advertising;
      console.log('[BLE Native] Advertising active:', adv);

      // 2. Start Scanning for other FIELDLINK nodes
      const scan = await FieldlinkBle.startScanning();
      this.isScanning = scan.scanning;
      console.log('[BLE Native] Scanning active:', scan);

      return true;
    } catch (err) {
      console.warn('[BLE Native] Start mesh error:', err);
      return false;
    }
  }

  private handlePeerDiscovered(peer: BleDiscoveredPeer) {
    if (!peer || !peer.peerAddress) return;
    const remoteDevId = peer.deviceId || peer.peerAddress;

    // Ignore self
    if (remoteDevId === this.localDeviceId) return;

    this.peerAddressToDeviceId.set(peer.peerAddress, remoteDevId);
    this.deviceIdToPeerAddress.set(remoteDevId, peer.peerAddress);

    this.notifyState(remoteDevId, 'connecting');

    // Deterministic connection tie-breaker:
    // The device with lexicographically greater deviceId acts as Central (initiates GATT connection)
    // The other device stays as Peripheral and accepts the connection on its GATT server.
    if (this.localDeviceId > remoteDevId) {
      console.log(`[BLE Native] Initiating GATT connection to ${remoteDevId} (${peer.peerAddress})`);
      FieldlinkBle.connect({ peerAddress: peer.peerAddress }).catch(err => {
        console.warn(`[BLE Native] Connect to ${peer.peerAddress} failed:`, err);
      });
    }
  }

  private handleIncomingPacket(peerAddress: string, packetStr: string) {
    try {
      const parsed = JSON.parse(packetStr);
      const senderDeviceId = parsed.senderDeviceId || this.peerAddressToDeviceId.get(peerAddress) || peerAddress;

      // Update peer mapping if senderDeviceId is present
      if (parsed.senderDeviceId && peerAddress) {
        this.peerAddressToDeviceId.set(peerAddress, parsed.senderDeviceId);
        this.deviceIdToPeerAddress.set(parsed.senderDeviceId, peerAddress);
        this.connectedPeers.add(peerAddress);
      }

      for (const listener of this.messageListeners) {
        listener(parsed, senderDeviceId, 'BLE');
      }
    } catch (err) {
      console.warn('[BLE] Error parsing packet:', err);
    }
  }

  private checkWebBluetoothAvailability() {
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator && (navigator as any).bluetooth) {
      this.status = 'available';
    } else {
      this.status = 'unavailable';
    }
  }

  public getStatus(): TransportStatus {
    return this.status;
  }

  public getCapabilities(): TransportCapabilities {
    const isSupported = this.isNative || (typeof navigator !== 'undefined' && 'bluetooth' in navigator && !!(navigator as any).bluetooth);
    return {
      type: 'BLE',
      isAvailable: this.status !== 'unavailable',
      isSupported,
      latencyMs: 120,
      bandwidthKbps: 64,
      mtuBytes: 512,
      notes: this.isNative
        ? 'Native Android BLE (P2P Mesh GATT Server + Scanner, Zero Internet/Laptop)'
        : 'Web Bluetooth API (Browser mode)',
    };
  }

  public async discover(): Promise<string[]> {
    if (this.isNative) {
      const res = await FieldlinkBle.getActivePeers();
      return (res.peers || []).map(p => p.deviceId || p.peerAddress);
    }

    // Web fallback
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth?.requestDevice) {
      return [];
    }
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: false,
        filters: [{ services: [BLETransport.SERVICE_UUID] }],
      });
      return device && device.id ? [device.id] : [];
    } catch {
      return [];
    }
  }

  public async connect(peerId: string): Promise<boolean> {
    if (this.isNative) {
      const address = this.deviceIdToPeerAddress.get(peerId) || peerId;
      try {
        const res = await FieldlinkBle.connect({ peerAddress: address });
        return res.connecting;
      } catch (err) {
        console.warn('[BLE Native] connect failed:', err);
        return false;
      }
    }

    // Web fallback
    try {
      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        filters: [{ namePrefix: 'FIELDLINK' }],
        optionalServices: [BLETransport.SERVICE_UUID],
      });

      this.activeDevice = device;
      this.gattServer = await device.gatt.connect();
      const service = await this.gattServer.getPrimaryService(BLETransport.SERVICE_UUID);
      this.txCharacteristic = await service.getCharacteristic(BLETransport.CHAR_UUID);
      this.rxCharacteristic = this.txCharacteristic;

      this.status = 'connected';
      this.notifyState(peerId, 'connected');
      return true;
    } catch (err) {
      this.notifyState(peerId, 'disconnected');
      return false;
    }
  }

  public async send(peerId: string, message: any): Promise<boolean> {
    const payload = JSON.stringify({
      ...message,
      senderDeviceId: this.localDeviceId,
      timestamp: message.timestamp || Date.now(),
    });

    if (this.isNative) {
      const address = this.deviceIdToPeerAddress.get(peerId) || (peerId === 'broadcast' ? 'broadcast' : peerId);
      try {
        const res = await FieldlinkBle.sendPacket({
          peerAddress: address,
          packet: payload,
        });
        return res.success;
      } catch (err) {
        console.warn('[BLE Native] send failed:', err);
        return false;
      }
    }

    // Web fallback
    if (!this.txCharacteristic) return false;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      await this.txCharacteristic.writeValue(data);
      return true;
    } catch {
      return false;
    }
  }

  public async broadcast(message: any): Promise<number> {
    const payload = JSON.stringify({
      ...message,
      senderDeviceId: this.localDeviceId,
      timestamp: message.timestamp || Date.now(),
    });

    if (this.isNative) {
      try {
        const res = await FieldlinkBle.sendPacket({
          peerAddress: 'broadcast',
          packet: payload,
        });
        return res.deliveryCount;
      } catch (err) {
        console.warn('[BLE Native] broadcast failed:', err);
        return 0;
      }
    }

    if (this.status === 'connected') {
      const ok = await this.send('broadcast', message);
      return ok ? 1 : 0;
    }
    return 0;
  }

  public async disconnect(peerId: string): Promise<void> {
    if (this.isNative) {
      const address = this.deviceIdToPeerAddress.get(peerId) || peerId;
      try {
        await FieldlinkBle.disconnect({ peerAddress: address });
      } catch (err) {
        console.warn('[BLE Native] disconnect failed:', err);
      }
    } else if (this.gattServer && this.gattServer.connected) {
      this.gattServer.disconnect();
    }
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
    if (this.isNative) {
      await FieldlinkBle.stopScanning().catch(() => {});
      await FieldlinkBle.stopAdvertising().catch(() => {});
    } else if (this.activeDevice) {
      await this.disconnect(this.activeDevice.id);
    }
    this.messageListeners.clear();
    this.stateListeners.clear();
  }
}
