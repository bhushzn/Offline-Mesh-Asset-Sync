// ============================================================
// FIELDLINK — Native Android BLE Capacitor Plugin Bridge
// ============================================================

import { registerPlugin, PluginListenerHandle, Capacitor } from '@capacitor/core';

export interface BleDiscoveredPeer {
  peerAddress: string;
  name: string;
  deviceId: string;
  rssi: number;
}

export interface BlePeerConnectionInfo {
  peerAddress: string;
  role: string;
}

export interface BlePacketData {
  peerAddress: string;
  packet: string;
}

export interface FieldlinkBlePluginInterface {
  initialize(): Promise<{ isSupported: boolean; isEnabled: boolean; hasPermissions: boolean }>;
  checkPermissionsStatus(): Promise<{ granted: boolean }>;
  requestBlePermissions(): Promise<{ granted: boolean }>;
  startAdvertising(options: { deviceId: string; deviceName?: string }): Promise<{ advertising: boolean; deviceId: string; deviceName: string }>;
  stopAdvertising(): Promise<{ advertising: boolean }>;
  startScanning(): Promise<{ scanning: boolean }>;
  stopScanning(): Promise<{ scanning: boolean }>;
  connect(options: { peerAddress: string }): Promise<{ connecting: boolean; peerAddress: string }>;
  disconnect(options: { peerAddress: string }): Promise<{ disconnected: boolean; peerAddress: string }>;
  sendPacket(options: { peerAddress?: string; packet: string }): Promise<{ success: boolean; msgId: string; chunks: number; deliveryCount: number }>;
  getActivePeers(): Promise<{ peers: BleDiscoveredPeer[] }>;
  addListener(eventName: 'peerDiscovered', listenerFunc: (peer: BleDiscoveredPeer) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'peerConnected', listenerFunc: (info: BlePeerConnectionInfo) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'peerDisconnected', listenerFunc: (info: { peerAddress: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'packetReceived', listenerFunc: (data: BlePacketData) => void): Promise<PluginListenerHandle>;
}

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const FieldlinkBle = registerPlugin<FieldlinkBlePluginInterface>('FieldlinkBle');
