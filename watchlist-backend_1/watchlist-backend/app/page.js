'use client';

import { useEffect, useState } from 'react';
import { UserButton } from '@clerk/nextjs';

function daysBetween(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target - today) / 86400000);
}

function tierFor(daysLeft, reminderDays) {
  if (daysLeft <= reminderDays) return 'urgent';
  if (daysLeft <= 14) return 'upcoming';
  return 'later';
}

function statusText(daysLeft) {
  if (daysLeft > 1) return `next charge in ${daysLeft} days`;
  if (daysLeft === 1) return 'next charge tomorrow';
  if (daysLeft === 0) return 'next charge today';
  if (daysLeft === -1) return 'charged 1 day ago — check it';
  return `charged ${Math.abs(daysLeft)} days ago — check it`;
}

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', cost: '', cadence: 'monthly', renewalDate: '', reminderDaysBefore: 3 });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/subscriptions');
    const data = await res.json();
    setItems(data.subscriptions || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        cost: parseFloat(form.cost),
        cadence: form.cadence,
        renewalDate: form.renewalDate,
        reminderDaysBefore: parseInt(form.reminderDaysBefore, 10) || 3,
      }),
    });
    setForm({ name: '', cost: '', cadence: 'monthly', renewalDate: '', reminderDaysBefore: 3 });
    setShowForm(false);
    load();
  }

  async function handleAction(id, action) {
    await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function handleDelete(id) {
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    load();
  }

  const urgentCount = items.filter((i) => tierFor(daysBetween(i.renewal_date), i.reminder_days_before) === 'urgent').length;
  const monthlyTotal = items.reduce((sum, i) => sum + (i.cadence === 'yearly' ? i.cost / 12 : i.cadence === 'monthly' ? Number(i.cost) : 0), 0);

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>Watchlist</h1>
          <p className="tagline">Track what's about to charge you.</p>
        </div>
        <UserButton />
      </div>

      <div className="summary">
        <div className="stat">
          <span className="stat-num">{items.length}</span>
          <span className="stat-label">tracking</span>
        </div>
        <div className="stat">
          <span className="stat-num">{urgentCount}</span>
          <span className="stat-label">need attention</span>
        </div>
        <div className="stat">
          <span className="stat-num">${monthlyTotal.toFixed(2)}</span>
          <span className="stat-label">per month</span>
        </div>
      </div>

      {!showForm && (
        <button className="add-btn" onClick={() => setShowForm(true)}>+ Add a subscription</button>
      )}

      {showForm && (
        <div className="add-form">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Price</label>
              <input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required />
            </div>
            <div className="field">
              <label>Billing</label>
              <select value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="trial">One-time trial</option>
              </select>
            </div>
            <div className="field">
              <label>Next charge date</label>
              <input type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} required />
            </div>
            <div className="field">
              <label>Remind me (days before)</label>
              <input type="number" min="1" max="30" value={form.reminderDaysBefore} onChange={(e) => setForm({ ...form, reminderDaysBefore: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="submit" className="save-btn">Save</button>
              <button type="button" className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="empty">Nothing tracked yet. Add the trial or subscription you're most likely to forget.</p>
      )}

      <div className="list">
        {items
          .slice()
          .sort((a, b) => new Date(a.renewal_date) - new Date(b.renewal_date))
          .map((item) => {
            const daysLeft = daysBetween(item.renewal_date);
            const tier = tierFor(daysLeft, item.reminder_days_before);
            return (
              <div key={item.id} className={`item tier-${tier}`}>
                <div className="item-row">
                  <span className="item-name">{item.name}</span>
                  <span>${Number(item.cost).toFixed(2)}</span>
                </div>
                <div className="item-row">
                  <span className="badge">{item.cadence}</span>
                  <span className={`status status-${tier}`}>{statusText(daysLeft)}</span>
                </div>
                <div className="item-row" style={{ justifyContent: 'flex-start', gap: '1rem', marginTop: '0.4rem' }}>
                  <button className="link-btn" onClick={() => handleAction(item.id, 'snooze')}>Snooze</button>
                  <button className="link-btn" onClick={() => handleDelete(item.id)}>Delete</button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
