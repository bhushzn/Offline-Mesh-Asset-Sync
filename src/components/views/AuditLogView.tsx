import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Info 
} from 'lucide-react';
import { AuditEvent } from '../../types/tactical';
import { auditLog } from '../../services/auditLogService';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    const unsub = auditLog.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return unsub;
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterSeverity !== 'ALL' && log.severity !== filterSeverity) return false;
    if (filterType !== 'ALL' && log.eventType !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchDetails = log.details.toLowerCase().includes(term);
      const matchEntity = log.entityId?.toLowerCase().includes(term);
      const matchDevice = log.deviceId.toLowerCase().includes(term);
      if (!matchDetails && !matchEntity && !matchDevice) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity: AuditEvent['severity']) => {
    switch (severity) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 mr-1" /> Verified
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 mr-1" /> Conflict/Warning
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3 mr-1" /> Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Info className="w-3 h-3 mr-1" /> Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            Operational Audit Trail
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Immutable local tamper-evident log of operational changes, peer handshakes, CRDT merges, and conflict resolutions.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span>{logs.length} Recorded Events</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="field-card p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by details, entity ID, or device..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            aria-label="Filter events by severity"
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Verified</option>
            <option value="WARN">Warnings / Conflicts</option>
            <option value="ERROR">Errors</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter events by type"
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="ALL">All Event Types</option>
            <option value="DATA_MODIFIED">Data Modified</option>
            <option value="PEER_DISCOVERED">Peer Discovered</option>
            <option value="SYNC_COMPLETED">Sync Completed</option>
            <option value="CONFLICT_RESOLVED">Conflict Resolved</option>
            <option value="AUTH_VERIFIED">Auth Verified</option>
            <option value="PACKET_FORWARDED">Packet Forwarded</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      <div className="field-card overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No audit events match your filter criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(log.severity)}
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {log.eventType}
                    </span>
                    {log.entityId && (
                      <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {log.entityId}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-800 font-medium">{log.details}</p>
                </div>

                <div className="flex sm:flex-col sm:items-end justify-between text-xs text-slate-500 font-mono">
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className="text-slate-400 text-[11px]">{new Date(log.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
