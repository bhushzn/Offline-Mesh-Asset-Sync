export interface BatteryState {
  isSupported: boolean;
  level: number; // 0 - 100
  charging: boolean;
  isLowPowerMode: boolean;
}

type BatteryListener = (state: BatteryState) => void;

class BatteryService {
  private state: BatteryState = {
    isSupported: false,
    level: 85,
    charging: false,
    isLowPowerMode: false,
  };
  private listeners: Set<BatteryListener> = new Set();

  constructor() {
    this.initBatteryMonitoring();
  }

  private async initBatteryMonitoring() {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        this.updateState(battery);

        battery.addEventListener('levelchange', () => this.updateState(battery));
        battery.addEventListener('chargingchange', () => this.updateState(battery));
      } catch {
        // Fallback
      }
    }
  }

  private updateState(battery: any) {
    const level = Math.round(battery.level * 100);
    const charging = battery.charging;
    const isLowPowerMode = level <= 20 && !charging;

    this.state = {
      isSupported: true,
      level,
      charging,
      isLowPowerMode,
    };
    this.notify();
  }

  public getState(): BatteryState {
    return { ...this.state };
  }

  public subscribe(listener: BatteryListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const s = this.getState();
    for (const listener of this.listeners) {
      listener(s);
    }
  }
}

export const batteryService = new BatteryService();
