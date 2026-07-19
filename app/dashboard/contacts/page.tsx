'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, ChevronRight, X } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  company?: string;
  call_count: number;
  last_call_date?: string;
  relationship_score: number;
  tags?: string[];
}

interface AddContactForm {
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [form, setForm] = useState<AddContactForm>({
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: '',
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContacts();
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchContacts();
  }, [page]);

  async function fetchContacts() {
    try {
      setLoading(true);
      let url = `/api/contacts?limit=50&offset=${(page - 1) * 50}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      setContacts(Array.isArray(data) ? data : data.contacts || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          company: form.company.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add contact');
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', company: '', notes: '' });
      await fetchContacts();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load contacts: {error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      ) : !contacts.length ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            {search ? 'No contacts match your search.' : 'No contacts found. Add one to get started.'}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Calls</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Relationship</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Call</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-muted transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium">{contact.name}</p>
                        {contact.tags && contact.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {contact.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="inline-block px-2 py-1 rounded text-xs bg-muted text-muted-foreground">{tag}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">{contact.phone}</td>
                      <td className="px-6 py-4 text-sm">{contact.email || '—'}</td>
                      <td className="px-6 py-4 text-sm">{contact.company || '—'}</td>
                      <td className="px-6 py-4 text-sm font-medium">{contact.call_count}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-blue-600" style={{ width: `${(contact.relationship_score ?? 0) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{((contact.relationship_score ?? 0) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {contact.last_call_date ? new Date(contact.last_call_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded border disabled:opacity-50">Previous</button>
            <span className="px-4 py-2">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={contacts.length < 50} className="px-4 py-2 rounded border disabled:opacity-50">Next</button>
          </div>
        </>
      )}

      {/* Add Contact Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold">Add Contact</h2>
              <button onClick={() => { setShowAdd(false); setAddError(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Company</label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAdd(false); setAddError(null); }} className="px-4 py-2 rounded-lg border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={adding || !form.phone.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {adding ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
