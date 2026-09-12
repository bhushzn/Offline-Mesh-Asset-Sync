import React, { useState, useMemo } from 'react';
import { Modal, Badge, EmptyState, addToast } from '../components/UI.jsx';
import { generateId } from '../utils/uuid.js';
import { toDTG, timeAgo } from '../utils/time.js';

const INCIDENT_TYPES = ['Equipment Failure', 'Injury', 'Security', 'Environmental', 'Comms Loss', 'Personnel', 'Other'];
const SEVERITY_LABELS = ['', 'Minor', 'Low', 'Moderate', 'High', 'Critical'];
const SEVERITY_VARIANTS = ['', 'success', 'info', 'warning', 'amber', 'danger'];

/**
 * Incidents — Situation report feed with severity-coded incident logging
 */
export function Incidents({ crdt }) {
  const [showForm, setShowForm] = useState(false);

  const incidents = useMemo(() => {
    return crdt.getAll('incidents')
      .map(([id, inc]) => ({ id, ...inc }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [crdt, crdt.version]);

  const handleSave = async (data) => {
    const id = generateId();
    await crdt.set('incidents', id, {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    addToast('Incident report filed', 'success');
    setShowForm(false);
  };

  const severityCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    incidents.forEach(inc => {
      const s = inc.severity || 1;
      counts[s]++;
    });
    return counts;
  }, [incidents]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <span className="icon">⚠</span> SITREP
          <span className="page-count">{incidents.length}</span>
        </h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          + Report
        </button>
      </div>

      {/* Severity summary bar */}
      {incidents.length > 0 && (
        <div className="card mb-lg">
          <div className="card-header">
            <span className="card-title">Severity Breakdown</span>
          </div>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
            {[5, 4, 3, 2, 1].map(level => (
              severityCounts[level] > 0 && (
                <Badge key={level} variant={SEVERITY_VARIANTS[level]}>
                  {SEVERITY_LABELS[level]}: {severityCounts[level]}
                </Badge>
              )
            ))}
          </div>
        </div>
      )}

      {/* Incident feed */}
      {incidents.length === 0 ? (
        <EmptyState
          icon="⚠"
          title="No incidents reported"
          text="File situation reports to track incidents. All reports sync across the mesh automatically."
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>+ File Report</button>}
        />
      ) : (
        <div className="list">
          {incidents.map(inc => (
            <div key={inc.id} className={`incident-item severity-${inc.severity || 1}`}>
              <div className="incident-header">
                <span className="incident-type">{inc.type || 'Unknown'}</span>
                <span className="incident-time">{toDTG(inc.createdAt)}</span>
              </div>
              <div className="incident-description">{inc.description}</div>
              <div className="incident-meta">
                <Badge variant={SEVERITY_VARIANTS[inc.severity || 1]}>
                  SEV {inc.severity || 1} — {SEVERITY_LABELS[inc.severity || 1]}
                </Badge>
                {inc.location && (
                  <Badge variant="neutral">📍 {inc.location}</Badge>
                )}
                {inc.personnel && (
                  <Badge variant="neutral">👤 {inc.personnel}</Badge>
                )}
              </div>
              <div className="text-xs text-dim mt-sm text-mono">{timeAgo(inc.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="File Incident Report"
      >
        <IncidentForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}

function IncidentForm({ onSave, onCancel }) {
  const [type, setType] = useState(INCIDENT_TYPES[0]);
  const [severity, setSeverity] = useState(3);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [personnel, setPersonnel] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) return;
    onSave({
      type,
      severity,
      description: description.trim(),
      location: location.trim(),
      personnel: personnel.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Incident Type</label>
          <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
            {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Severity (1-5)</label>
          <select className="form-select" value={severity} onChange={e => setSeverity(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(s => (
              <option key={s} value={s}>{s} — {SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Description *</label>
        <textarea
          className="form-textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the incident..."
          required
          style={{ minHeight: '100px' }}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Location</label>
          <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Grid ref or description" />
        </div>
        <div className="form-group">
          <label className="form-label">Personnel Involved</label>
          <input className="form-input" value={personnel} onChange={e => setPersonnel(e.target.value)} placeholder="Names / callsigns" />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>File Report</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
