import React, { useState, useMemo } from 'react';
import { Modal, Badge, EmptyState, addToast } from '../components/UI.jsx';
import { generateId } from '../utils/uuid.js';
import { toDTG } from '../utils/time.js';

const ROLES = ['Operator', 'Medic', 'Comms', 'Engineer', 'Leader', 'Support', 'Observer'];
const PERSON_STATUSES = ['present', 'absent', 'on-mission', 'injured'];
const STATUS_VARIANTS = {
  present: 'success',
  absent: 'danger',
  'on-mission': 'amber',
  injured: 'warning',
};

/**
 * MusterRoll — Personnel roll call with one-tap status updates
 */
export function MusterRoll({ crdt }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const personnel = useMemo(() => {
    return crdt.getAll('personnel')
      .map(([id, p]) => ({ id, ...p }))
      .filter(p => {
        if (search && !p.name?.toLowerCase().includes(search.toLowerCase()) &&
            !p.callsign?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [crdt, search, crdt.version]);

  const counts = useMemo(() => {
    const all = crdt.getAll('personnel').map(([, p]) => p);
    return {
      total: all.length,
      present: all.filter(p => p.status === 'present').length,
      absent: all.filter(p => p.status === 'absent').length,
      mission: all.filter(p => p.status === 'on-mission').length,
      injured: all.filter(p => p.status === 'injured').length,
    };
  }, [crdt, crdt.version]);

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'present' ? 'absent' : 'present';
    const person = crdt.get('personnel', id);
    if (person) {
      await crdt.set('personnel', id, {
        ...person,
        status: nextStatus,
        lastCheckIn: nextStatus === 'present' ? Date.now() : person.lastCheckIn,
        updatedAt: Date.now(),
      });
    }
  };

  const markAll = async (status) => {
    const all = crdt.getAll('personnel');
    for (const [id, person] of all) {
      await crdt.set('personnel', id, {
        ...person,
        status,
        lastCheckIn: status === 'present' ? Date.now() : person.lastCheckIn,
        updatedAt: Date.now(),
      });
    }
    addToast(`All marked ${status}`, 'info');
  };

  const handleSave = async (data) => {
    const id = editId || generateId();
    await crdt.set('personnel', id, {
      ...data,
      updatedAt: Date.now(),
      createdAt: editId ? crdt.get('personnel', editId)?.createdAt || Date.now() : Date.now(),
    });
    addToast(editId ? 'Personnel updated' : 'Personnel added', 'success');
    setShowForm(false);
    setEditId(null);
  };

  const handleDelete = async (id) => {
    await crdt.remove('personnel', id);
    addToast('Personnel removed', 'warning');
    setShowForm(false);
    setEditId(null);
  };

  const editPerson = editId ? crdt.get('personnel', editId) : null;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <span className="icon">⦿</span> Muster Roll
          <span className="page-count">{counts.total}</span>
        </h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditId(null); setShowForm(true); }}>
          + Add
        </button>
      </div>

      {/* Summary */}
      {counts.total > 0 && (
        <div className="muster-summary">
          <div className="muster-summary-item">
            <div className="muster-summary-value text-green">{counts.present}</div>
            <div className="muster-summary-label">Present</div>
          </div>
          <div className="muster-summary-item">
            <div className="muster-summary-value text-red">{counts.absent}</div>
            <div className="muster-summary-label">Absent</div>
          </div>
          <div className="muster-summary-item">
            <div className="muster-summary-value text-amber">{counts.mission}</div>
            <div className="muster-summary-label">Mission</div>
          </div>
          <div className="muster-summary-item">
            <div className="muster-summary-value" style={{ color: 'var(--color-warning)' }}>{counts.injured}</div>
            <div className="muster-summary-label">Injured</div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {counts.total > 0 && (
        <div className="flex gap-sm mb-lg">
          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => markAll('present')}>
            ✓ All Present
          </button>
          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => markAll('absent')}>
            ✕ All Absent
          </button>
        </div>
      )}

      {/* Search */}
      <div className="search-bar">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search by name or callsign..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {personnel.length === 0 ? (
        <EmptyState
          icon="⦿"
          title="No personnel registered"
          text="Add team members to track roll calls and accountability across the mesh."
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Personnel</button>}
        />
      ) : (
        <div className="list">
          {personnel.map(person => (
            <div key={person.id} className="muster-item">
              <button
                className={`muster-check ${person.status === 'present' ? 'checked' : person.status === 'absent' ? 'absent' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleStatus(person.id, person.status); }}
              >
                {person.status === 'present' ? '✓' : person.status === 'absent' ? '✕' : '—'}
              </button>
              <div className="list-item-content" onClick={() => { setEditId(person.id); setShowForm(true); }} style={{ cursor: 'pointer' }}>
                <div className="list-item-title">{person.name}</div>
                <div className="list-item-subtitle">
                  {person.callsign || 'No callsign'} · {person.role || 'No role'}
                </div>
              </div>
              <Badge variant={STATUS_VARIANTS[person.status] || 'neutral'}>
                {person.status || 'unknown'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* DTG */}
      {counts.total > 0 && (
        <div className="text-center mt-lg text-xs text-dim text-mono">
          Roll as of {toDTG(Date.now())}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditId(null); }}
        title={editId ? 'Edit Personnel' : 'Add Personnel'}
      >
        <MusterForm
          initialData={editPerson}
          onSave={handleSave}
          onDelete={editId ? () => handleDelete(editId) : null}
          onCancel={() => { setShowForm(false); setEditId(null); }}
        />
      </Modal>
    </div>
  );
}

function MusterForm({ initialData, onSave, onDelete, onCancel }) {
  const [name, setName] = useState(initialData?.name || '');
  const [callsign, setCallsign] = useState(initialData?.callsign || '');
  const [role, setRole] = useState(initialData?.role || ROLES[0]);
  const [status, setStatus] = useState(initialData?.status || 'absent');
  const [unit, setUnit] = useState(initialData?.unit || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      callsign: callsign.trim(),
      role,
      status,
      unit: unit.trim(),
      notes: notes.trim(),
      lastCheckIn: status === 'present' ? Date.now() : (initialData?.lastCheckIn || null),
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Full Name *</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Last, First" required />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Callsign</label>
          <input className="form-input" value={callsign} onChange={e => setCallsign(e.target.value)} placeholder="BRAVO-1" />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            {PERSON_STATUSES.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Unit / Squad</label>
          <input className="form-input" value={unit} onChange={e => setUnit(e.target.value)} placeholder="Alpha Team" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Medical conditions, special skills..." />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
          {initialData ? 'Update' : 'Add Personnel'}
        </button>
        {onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete}>Remove</button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
