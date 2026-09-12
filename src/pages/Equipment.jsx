import React, { useState, useMemo } from 'react';
import { Modal, Badge, EmptyState, addToast } from '../components/UI.jsx';
import { generateId } from '../utils/uuid.js';

const CATEGORIES = ['Weapons', 'Comms', 'Medical', 'Optics', 'Transport', 'Shelter', 'Provisions', 'Other'];
const STATUSES = ['available', 'deployed', 'maintenance', 'lost'];
const STATUS_VARIANTS = {
  available: 'success',
  deployed: 'amber',
  maintenance: 'warning',
  lost: 'danger',
};

/**
 * Equipment — Inventory list with search, filter, and CRUD
 */
export function Equipment({ crdt }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const items = useMemo(() => {
    return crdt.getAll('equipment')
      .map(([id, item]) => ({ id, ...item }))
      .filter(item => {
        if (search && !item.name?.toLowerCase().includes(search.toLowerCase()) &&
            !item.serial?.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
        return true;
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [crdt, search, filterStatus, crdt.version]);

  const handleSave = async (data) => {
    const id = editId || generateId();
    await crdt.set('equipment', id, {
      ...data,
      updatedAt: Date.now(),
      createdAt: editId ? crdt.get('equipment', editId)?.createdAt || Date.now() : Date.now(),
    });
    addToast(editId ? 'Equipment updated' : 'Equipment added', 'success');
    setShowForm(false);
    setEditId(null);
  };

  const handleDelete = async (id) => {
    await crdt.remove('equipment', id);
    addToast('Equipment removed', 'warning');
  };

  const handleEdit = (id) => {
    setEditId(id);
    setShowForm(true);
  };

  const editItem = editId ? crdt.get('equipment', editId) : null;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <span className="icon">⬡</span> Equipment
          <span className="page-count">{items.length}</span>
        </h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditId(null); setShowForm(true); }}>
          + Add
        </button>
      </div>

      {/* Search */}
      <div className="search-bar">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder="Search by name or serial..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="tabs">
        <button className={`tab ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>All</button>
        {STATUSES.map(s => (
          <button key={s} className={`tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <EmptyState
          icon="⬡"
          title="No equipment tracked"
          text="Add your first piece of equipment to begin tracking inventory across the mesh."
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Equipment</button>}
        />
      ) : (
        <div className="list">
          {items.map(item => (
            <div key={item.id} className="list-item" onClick={() => handleEdit(item.id)}>
              <div className="list-item-icon" style={{
                background: `var(--${STATUS_VARIANTS[item.status] || 'neutral'}-dim, var(--bg-elevated))`,
              }}>
                {getCategoryIcon(item.category)}
              </div>
              <div className="list-item-content">
                <div className="list-item-title">{item.name}</div>
                <div className="list-item-subtitle">
                  {item.serial || 'No serial'} · {item.category || 'Uncategorized'}
                </div>
              </div>
              <div className="list-item-meta">
                <Badge variant={STATUS_VARIANTS[item.status] || 'neutral'}>
                  {item.status || 'unknown'}
                </Badge>
                {item.assignedTo && (
                  <div className="text-xs text-dim mt-sm text-mono">{item.assignedTo}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditId(null); }}
        title={editId ? 'Edit Equipment' : 'Add Equipment'}
      >
        <EquipmentForm
          initialData={editItem}
          onSave={handleSave}
          onDelete={editId ? () => { handleDelete(editId); setShowForm(false); setEditId(null); } : null}
          onCancel={() => { setShowForm(false); setEditId(null); }}
        />
      </Modal>
    </div>
  );
}

function EquipmentForm({ initialData, onSave, onDelete, onCancel }) {
  const [name, setName] = useState(initialData?.name || '');
  const [serial, setSerial] = useState(initialData?.serial || '');
  const [category, setCategory] = useState(initialData?.category || CATEGORIES[0]);
  const [status, setStatus] = useState(initialData?.status || 'available');
  const [assignedTo, setAssignedTo] = useState(initialData?.assignedTo || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), serial: serial.trim(), category, status, assignedTo: assignedTo.trim(), notes: notes.trim() });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Item Name *</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. AN/PRC-152 Radio" required />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Serial / ID</label>
          <input className="form-input" value={serial} onChange={e => setSerial(e.target.value)} placeholder="SN-001234" />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Assigned To</label>
          <input className="form-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Callsign / name" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
          {initialData ? 'Update' : 'Add Equipment'}
        </button>
        {onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function getCategoryIcon(category) {
  const icons = {
    Weapons: '⚔',
    Comms: '📡',
    Medical: '✚',
    Optics: '🔭',
    Transport: '🚛',
    Shelter: '⛺',
    Provisions: '📦',
    Other: '⬡',
  };
  return icons[category] || '⬡';
}
