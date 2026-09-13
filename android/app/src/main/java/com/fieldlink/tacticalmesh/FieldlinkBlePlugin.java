package com.fieldlink.tacticalmesh;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(
    name = "FieldlinkBle",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT
            },
            alias = "ble"
        ),
        @Permission(
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            },
            alias = "location"
        )
    }
)
public class FieldlinkBlePlugin extends Plugin {
    private static final String TAG = "FieldlinkBle";

    // Custom 128-bit UUIDs for FIELDLINK Tactical P2P Mesh
    public static final UUID SERVICE_UUID = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_UUID = UUID.fromString("0000ffe1-0000-1000-8000-00805f9b34fb");
    public static final UUID CCCD_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private static final int CHUNK_PAYLOAD_SIZE = 180;

    private BluetoothManager bluetoothManager;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothLeScanner scanner;
    private BluetoothGattServer gattServer;
    private BluetoothGattCharacteristic serverCharacteristic;

    // Track active client connections (Central role - we are connected to remote GATT servers)
    private final Map<String, BluetoothGatt> gattClients = new ConcurrentHashMap<>();
    private final Map<String, BluetoothGattCharacteristic> clientWriteChars = new ConcurrentHashMap<>();

    // Track connected remote clients (Peripheral role - remote devices connected to our GATT server)
    private final Map<String, BluetoothDevice> serverConnectedClients = new ConcurrentHashMap<>();

    // Discovered peers
    private final Map<String, JSObject> discoveredPeers = new ConcurrentHashMap<>();

    // Chunk reassembly buffers: messageId -> (sequence -> chunkData)
    private final Map<String, Map<Integer, String>> incomingBuffers = new ConcurrentHashMap<>();
    private final Map<String, Integer> incomingTotals = new ConcurrentHashMap<>();

    private boolean isAdvertising = false;
    private boolean isScanning = false;
    private String localDeviceId = "";
    private String localDeviceName = "";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();
        Context ctx = getContext();
        bluetoothManager = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
    }

    private boolean checkBlePermissions() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        } else {
            return ActivityCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        boolean supported = (bluetoothAdapter != null);
        boolean enabled = supported && bluetoothAdapter.isEnabled();
        boolean hasPerms = checkBlePermissions();

        JSObject ret = new JSObject();
        ret.put("isSupported", supported);
        ret.put("isEnabled", enabled);
        ret.put("hasPermissions", hasPerms);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkPermissionsStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", checkBlePermissions());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBlePermissions(PluginCall call) {
        if (checkBlePermissions()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAliases(new String[]{"ble"}, call, "blePermissionsCallback");
        } else {
            requestPermissionForAliases(new String[]{"location"}, call, "blePermissionsCallback");
        }
    }

    public void blePermissionsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", checkBlePermissions());
        call.resolve(ret);
    }

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        if (!checkBlePermissions()) {
            call.reject("Bluetooth permissions not granted");
            return;
        }

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is disabled");
            return;
        }

        localDeviceId = call.getString("deviceId", "UNKNOWN_NODE");
        localDeviceName = call.getString("deviceName", "FLK-" + localDeviceId.substring(0, Math.min(4, localDeviceId.length())));

        try {
            initGattServer();

            advertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
            if (advertiser == null) {
                call.reject("BLE Advertising not supported on this hardware");
                return;
            }

            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .setTimeout(0)
                .build();

            // Store short node ID in 16-bit Service Data to fit in the 31-byte legacy advertising packet
            byte[] idBytes = localDeviceId.substring(0, Math.min(8, localDeviceId.length())).getBytes(StandardCharsets.UTF_8);

            AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                .addServiceUuid(new ParcelUuid(SERVICE_UUID))
                .addServiceData(new ParcelUuid(SERVICE_UUID), idBytes)
                .build();

            AdvertiseData scanResponse = new AdvertiseData.Builder()
                .setIncludeDeviceName(true)
                .build();

            advertiser.startAdvertising(settings, data, scanResponse, advertiseCallback);
            isAdvertising = true;

            JSObject ret = new JSObject();
            ret.put("advertising", true);
            ret.put("deviceId", localDeviceId);
            ret.put("deviceName", localDeviceName);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error starting advertising: " + e.getMessage(), e);
            call.reject("Failed to start advertising: " + e.getMessage());
        }
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            Log.i(TAG, "BLE Advertising started successfully");
        }

        @Override
        public void onStartFailure(int errorCode) {
            Log.e(TAG, "BLE Advertising failed with error code: " + errorCode);
            isAdvertising = false;
        }
    };

    private void initGattServer() {
        if (gattServer != null) {
            return; // Already initialized
        }

        gattServer = bluetoothManager.openGattServer(getContext(), gattServerCallback);
        if (gattServer == null) {
            Log.e(TAG, "Unable to open GATT Server");
            return;
        }

        BluetoothGattService service = new BluetoothGattService(
            SERVICE_UUID,
            BluetoothGattService.SERVICE_TYPE_PRIMARY
        );

        serverCharacteristic = new BluetoothGattCharacteristic(
            CHAR_UUID,
            BluetoothGattCharacteristic.PROPERTY_WRITE |
            BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE |
            BluetoothGattCharacteristic.PROPERTY_READ |
            BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_WRITE |
            BluetoothGattCharacteristic.PERMISSION_READ
        );

        BluetoothGattDescriptor cccd = new BluetoothGattDescriptor(
            CCCD_UUID,
            BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE
        );
        serverCharacteristic.addDescriptor(cccd);

        service.addCharacteristic(serverCharacteristic);
        gattServer.addService(service);
        Log.i(TAG, "GATT Server service and characteristic added successfully");
    }

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {
        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            String address = device.getAddress();
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.i(TAG, "Peer connected to our GATT Server: " + address);
                serverConnectedClients.put(address, device);

                JSObject ret = new JSObject();
                ret.put("peerAddress", address);
                ret.put("role", "client_connected_to_server");
                notifyListeners("peerConnected", ret);
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.i(TAG, "Peer disconnected from our GATT Server: " + address);
                serverConnectedClients.remove(address);

                JSObject ret = new JSObject();
                ret.put("peerAddress", address);
                notifyListeners("peerDisconnected", ret);
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId, BluetoothGattCharacteristic characteristic, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            if (responseNeeded) {
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            }

            if (value != null && value.length > 0) {
                String chunk = new String(value, StandardCharsets.UTF_8);
                handleIncomingChunk(device.getAddress(), chunk);
            }
        }

        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId, BluetoothGattDescriptor descriptor, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            if (responseNeeded) {
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            }
        }
    };

    @PluginMethod
    public void stopAdvertising(PluginCall call) {
        try {
            if (advertiser != null && isAdvertising) {
                advertiser.stopAdvertising(advertiseCallback);
                isAdvertising = false;
            }
            if (gattServer != null) {
                gattServer.close();
                gattServer = null;
            }
            serverConnectedClients.clear();
            JSObject ret = new JSObject();
            ret.put("advertising", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error stopping advertising: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startScanning(PluginCall call) {
        if (!checkBlePermissions()) {
            call.reject("Bluetooth permissions not granted");
            return;
        }

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is disabled");
            return;
        }

        try {
            scanner = bluetoothAdapter.getBluetoothLeScanner();
            if (scanner == null) {
                call.reject("BLE Scanner not available");
                return;
            }

            List<ScanFilter> filters = new ArrayList<>();
            filters.add(new ScanFilter.Builder()
                .setServiceUuid(new ParcelUuid(SERVICE_UUID))
                .build());

            ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

            discoveredPeers.clear();
            scanner.startScan(filters, settings, scanCallback);
            isScanning = true;

            JSObject ret = new JSObject();
            ret.put("scanning", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error starting scan: " + e.getMessage(), e);
            call.reject("Failed to start scan: " + e.getMessage());
        }
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            if (device == null || device.getAddress() == null) return;

            String address = device.getAddress();
            int rssi = result.getRssi();
            String name = device.getName();

            // Extract service data if available
            String remoteDeviceId = "";
            if (result.getScanRecord() != null) {
                byte[] data = result.getScanRecord().getServiceData(new ParcelUuid(SERVICE_UUID));
                if (data != null && data.length > 0) {
                    remoteDeviceId = new String(data, StandardCharsets.UTF_8).trim();
                }
            }

            if (remoteDeviceId.isEmpty()) {
                remoteDeviceId = name != null && !name.isEmpty() ? name : "NODE-" + address.replace(":", "").substring(Math.max(0, address.length() - 4));
            }

            // Don't discover self
            if (remoteDeviceId.equals(localDeviceId)) {
                return;
            }

            JSObject peerObj = new JSObject();
            peerObj.put("peerAddress", address);
            peerObj.put("name", name != null ? name : remoteDeviceId);
            peerObj.put("deviceId", remoteDeviceId);
            peerObj.put("rssi", rssi);

            discoveredPeers.put(address, peerObj);
            notifyListeners("peerDiscovered", peerObj);
        }

        @Override
        public void onScanFailed(int errorCode) {
            Log.e(TAG, "BLE Scan failed with code: " + errorCode);
            isScanning = false;
        }
    };

    @PluginMethod
    public void stopScanning(PluginCall call) {
        try {
            if (scanner != null && isScanning) {
                scanner.stopScan(scanCallback);
                isScanning = false;
            }
            JSObject ret = new JSObject();
            ret.put("scanning", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error stopping scan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String peerAddress = call.getString("peerAddress");
        if (peerAddress == null || peerAddress.isEmpty()) {
            call.reject("peerAddress is required");
            return;
        }

        if (!checkBlePermissions()) {
            call.reject("Bluetooth permissions not granted");
            return;
        }

        try {
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(peerAddress);
            if (device == null) {
                call.reject("Device not found: " + peerAddress);
                return;
            }

            BluetoothGatt gatt = device.connectGatt(
                getContext(),
                false,
                new BluetoothGattCallback() {
                    @Override
                    public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                        String addr = gatt.getDevice().getAddress();
                        if (newState == BluetoothProfile.STATE_CONNECTED) {
                            Log.i(TAG, "Connected to remote GATT Server: " + addr);
                            gattClients.put(addr, gatt);

                            // Request high MTU up to 517 bytes
                            gatt.requestMtu(517);

                            JSObject ret = new JSObject();
                            ret.put("peerAddress", addr);
                            ret.put("role", "connected_as_client");
                            notifyListeners("peerConnected", ret);
                        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                            Log.i(TAG, "Disconnected from remote GATT Server: " + addr);
                            gattClients.remove(addr);
                            clientWriteChars.remove(addr);
                            gatt.close();

                            JSObject ret = new JSObject();
                            ret.put("peerAddress", addr);
                            notifyListeners("peerDisconnected", ret);
                        }
                    }

                    @Override
                    public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
                        Log.i(TAG, "MTU changed to " + mtu + " for " + gatt.getDevice().getAddress());
                        gatt.discoverServices();
                    }

                    @Override
                    public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                        if (status == BluetoothGatt.GATT_SUCCESS) {
                            BluetoothGattService service = gatt.getService(SERVICE_UUID);
                            if (service != null) {
                                BluetoothGattCharacteristic characteristic = service.getCharacteristic(CHAR_UUID);
                                if (characteristic != null) {
                                    clientWriteChars.put(gatt.getDevice().getAddress(), characteristic);

                                    // Enable Notifications
                                    gatt.setCharacteristicNotification(characteristic, true);
                                    BluetoothGattDescriptor descriptor = characteristic.getDescriptor(CCCD_UUID);
                                    if (descriptor != null) {
                                        descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                                        gatt.writeDescriptor(descriptor);
                                    }
                                    Log.i(TAG, "FIELDLINK characteristic ready for TX/RX with " + gatt.getDevice().getAddress());
                                }
                            }
                        }
                    }

                    @Override
                    public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
                        byte[] value = characteristic.getValue();
                        if (value != null && value.length > 0) {
                            String chunk = new String(value, StandardCharsets.UTF_8);
                            handleIncomingChunk(gatt.getDevice().getAddress(), chunk);
                        }
                    }
                },
                BluetoothDevice.TRANSPORT_LE
            );

            JSObject ret = new JSObject();
            ret.put("connecting", true);
            ret.put("peerAddress", peerAddress);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error connecting to peer " + peerAddress + ": " + e.getMessage(), e);
            call.reject("Connection error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String peerAddress = call.getString("peerAddress");
        if (peerAddress == null) {
            call.reject("peerAddress is required");
            return;
        }

        try {
            BluetoothGatt gatt = gattClients.remove(peerAddress);
            if (gatt != null) {
                gatt.disconnect();
                gatt.close();
            }
            clientWriteChars.remove(peerAddress);
            serverConnectedClients.remove(peerAddress);

            JSObject ret = new JSObject();
            ret.put("disconnected", true);
            ret.put("peerAddress", peerAddress);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error disconnecting: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendPacket(PluginCall call) {
        String targetPeer = call.getString("peerAddress", "broadcast");
        String payload = call.getString("packet");

        if (payload == null || payload.isEmpty()) {
            call.reject("packet payload is required");
            return;
        }

        try {
            // Generate random 4-character message ID for chunk framing
            String msgId = String.format("%04x", new Random().nextInt(0x10000));
            List<String> chunks = frameMessage(msgId, payload, CHUNK_PAYLOAD_SIZE);

            int deliveryCount = 0;

            if ("broadcast".equalsIgnoreCase(targetPeer)) {
                // Send to all connected GATT clients (we act as central)
                for (Map.Entry<String, BluetoothGatt> entry : gattClients.entrySet()) {
                    String addr = entry.getKey();
                    BluetoothGatt gatt = entry.getValue();
                    BluetoothGattCharacteristic writeChar = clientWriteChars.get(addr);
                    if (gatt != null && writeChar != null) {
                        sendChunksToGattClient(gatt, writeChar, chunks);
                        deliveryCount++;
                    }
                }

                // Send to all connected clients on our GATT server (we act as peripheral)
                if (gattServer != null && serverCharacteristic != null) {
                    for (BluetoothDevice clientDevice : serverConnectedClients.values()) {
                        sendChunksToGattServerClients(clientDevice, serverCharacteristic, chunks);
                        deliveryCount++;
                    }
                }
            } else {
                // Specific peer address
                BluetoothGatt gatt = gattClients.get(targetPeer);
                BluetoothGattCharacteristic writeChar = clientWriteChars.get(targetPeer);
                if (gatt != null && writeChar != null) {
                    sendChunksToGattClient(gatt, writeChar, chunks);
                    deliveryCount++;
                } else {
                    BluetoothDevice clientDevice = serverConnectedClients.get(targetPeer);
                    if (gattServer != null && serverCharacteristic != null && clientDevice != null) {
                        sendChunksToGattServerClients(clientDevice, serverCharacteristic, chunks);
                        deliveryCount++;
                    }
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("msgId", msgId);
            ret.put("chunks", chunks.size());
            ret.put("deliveryCount", deliveryCount);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error sending packet: " + e.getMessage(), e);
            call.reject("Failed to send packet: " + e.getMessage());
        }
    }

    private List<String> frameMessage(String msgId, String payload, int chunkSize) {
        List<String> chunks = new ArrayList<>();
        int length = payload.length();
        int total = (int) Math.ceil((double) length / chunkSize);
        if (total == 0) total = 1;

        for (int i = 0; i < total; i++) {
            int start = i * chunkSize;
            int end = Math.min(start + chunkSize, length);
            String chunkData = payload.substring(start, end);
            // Format: "FLK:<msgId>:<seq>:<total>:<data>"
            chunks.add("FLK:" + msgId + ":" + i + ":" + total + ":" + chunkData);
        }
        return chunks;
    }

    private void sendChunksToGattClient(BluetoothGatt gatt, BluetoothGattCharacteristic writeChar, List<String> chunks) {
        for (String chunk : chunks) {
            writeChar.setValue(chunk.getBytes(StandardCharsets.UTF_8));
            writeChar.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
            gatt.writeCharacteristic(writeChar);
            try {
                Thread.sleep(15); // Short pause between BLE packet transmissions
            } catch (InterruptedException ignored) {}
        }
    }

    private void sendChunksToGattServerClients(BluetoothDevice device, BluetoothGattCharacteristic characteristic, List<String> chunks) {
        for (String chunk : chunks) {
            characteristic.setValue(chunk.getBytes(StandardCharsets.UTF_8));
            gattServer.notifyCharacteristicChanged(device, characteristic, false);
            try {
                Thread.sleep(15); // Short pause
            } catch (InterruptedException ignored) {}
        }
    }

    private synchronized void handleIncomingChunk(String peerAddress, String rawChunk) {
        if (!rawChunk.startsWith("FLK:")) {
            // Not a FIELDLINK framed chunk, ignore or pass through
            return;
        }

        String[] parts = rawChunk.split(":", 5);
        if (parts.length < 5) return;

        String msgId = parts[1];
        int seq;
        int total;
        try {
            seq = Integer.parseInt(parts[2]);
            total = Integer.parseInt(parts[3]);
        } catch (NumberFormatException e) {
            return;
        }
        String data = parts[4];

        Map<Integer, String> buffer = incomingBuffers.computeIfAbsent(msgId, k -> new ConcurrentHashMap<>());
        buffer.put(seq, data);
        incomingTotals.put(msgId, total);

        if (buffer.size() == total) {
            // All chunks received! Reassemble
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < total; i++) {
                sb.append(buffer.get(i));
            }
            incomingBuffers.remove(msgId);
            incomingTotals.remove(msgId);

            String completeMessage = sb.toString();

            mainHandler.post(() -> {
                JSObject ret = new JSObject();
                ret.put("peerAddress", peerAddress);
                ret.put("packet", completeMessage);
                notifyListeners("packetReceived", ret);
            });
        }
    }

    @PluginMethod
    public void getActivePeers(PluginCall call) {
        JSArray arr = new JSArray();
        for (JSObject peer : discoveredPeers.values()) {
            arr.put(peer);
        }
        JSObject ret = new JSObject();
        ret.put("peers", arr);
        call.resolve(ret);
    }
}
