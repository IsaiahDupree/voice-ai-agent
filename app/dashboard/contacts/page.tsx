'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, ChevronRight } from 'lucide-react';

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchContacts() {
      try {
        setLoading(true);
        let url = `/api/contacts?limit=50&offset=${(page - 1) * 50}`;
        if (search) {
          url += `&search=${encodeURIComponent(search)}`;
        }

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

    const timer = setTimeout(() => {
      fetchContacts();
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleAddContact = () => {
    alert('Add contact feature coming soon');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Contacts</h1>
        <button
          onClick={handleAddContact}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Search */}
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

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-700">Failed to load contacts: {error}</p>
        </div>
      )}

      {/* Contacts List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      ) : !contacts.length ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            {search ? 'No contacts match your search' : 'No contacts found. Add one to get started.'}
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
                              <span
                                key={tag}
                                className="inline-block px-2 py-1 rounded text-xs bg-muted text-muted-foreground"
                              >
                                {tag}
                              </span>
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
                            <div
                              className="h-full bg-blue-600"
                              style={{ width: `${contact.relationship_score * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {(contact.relationship_score * 100).toFixed(0)}%
                          </span>
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

          {/* Pagination */}
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded border disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={contacts.length < 50}
              className="px-4 py-2 rounded border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
