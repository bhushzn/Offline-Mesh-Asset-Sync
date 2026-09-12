import { cloudSync } from './cloudSyncService';
import { auditLog } from './auditLogService';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  callsign: string;
  token?: string;
  isOfflineUser: boolean;
}

export class AuthService {
  private currentUser: AuthUser = {
    id: 'user-field-lead',
    username: 'operator.miller',
    callsign: 'ALPHA-LEAD',
    role: 'FIELD_OPERATOR',
    isOfflineUser: true,
  };
  private token: string | null = null;
  private listeners: Set<(user: AuthUser) => void> = new Set();

  constructor() {
    this.loadPersistedAuth();
  }

  private loadPersistedAuth() {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedToken = localStorage.getItem('fieldlink_auth_token');
        const savedUser = localStorage.getItem('fieldlink_auth_user');
        if (savedToken && savedUser) {
          this.token = savedToken;
          this.currentUser = JSON.parse(savedUser);
        }
      } catch {
        // ignore
      }
    }
  }

  public getAccessToken(): string | null {
    return this.token;
  }

  public getCurrentUser(): AuthUser {
    return { ...this.currentUser };
  }

  public async login(credentials: { username: string; password?: string; callsign?: string }): Promise<boolean> {
    const backendUrl = cloudSync.getBackendUrl();

    // Try cloud authentication if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(`${backendUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });

        if (res.ok) {
          const data = await res.json();
          this.token = data.token || data.accessToken || 'jwt-live-token';
          this.currentUser = {
            id: data.user?.id || `user-${Date.now()}`,
            username: credentials.username,
            role: data.user?.role || 'FIELD_OPERATOR',
            callsign: credentials.callsign || data.user?.callsign || 'ALPHA-LEAD',
            token: this.token || undefined,
            isOfflineUser: false,
          };
          this.persist();
          auditLog.log({
            deviceId: 'local-device',
            eventType: 'AUTH_VERIFIED',
            details: `Authenticated with Central Cloud as ${this.currentUser.username}`,
            severity: 'SUCCESS',
          });
          this.notify();
          return true;
        }
      } catch {
        // Fallback to offline authentication
      }
    }

    // Offline Local Session
    this.currentUser = {
      id: `user-${Date.now()}`,
      username: credentials.username,
      callsign: credentials.callsign || 'OPERATOR',
      role: 'FIELD_OPERATOR',
      isOfflineUser: true,
    };
    this.persist();
    auditLog.log({
      deviceId: 'local-device',
      eventType: 'AUTH_VERIFIED',
      details: `Established local offline tactical session for ${this.currentUser.username}`,
      severity: 'INFO',
    });
    this.notify();
    return true;
  }

  public logout() {
    this.token = null;
    this.currentUser = {
      id: 'user-anonymous',
      username: 'guest',
      callsign: 'RECON-01',
      role: 'FIELD_OPERATOR',
      isOfflineUser: true,
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('fieldlink_auth_token');
      localStorage.removeItem('fieldlink_auth_user');
    }
    this.notify();
  }

  public async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {});
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    return fetch(url, {
      ...options,
      headers,
    });
  }

  public subscribe(listener: (user: AuthUser) => void): () => void {
    this.listeners.add(listener);
    listener(this.getCurrentUser());
    return () => this.listeners.delete(listener);
  }

  private persist() {
    if (typeof localStorage !== 'undefined') {
      if (this.token) localStorage.setItem('fieldlink_auth_token', this.token);
      localStorage.setItem('fieldlink_auth_user', JSON.stringify(this.currentUser));
    }
  }

  private notify() {
    const u = this.getCurrentUser();
    for (const listener of this.listeners) {
      listener(u);
    }
  }
}

export const authService = new AuthService();
