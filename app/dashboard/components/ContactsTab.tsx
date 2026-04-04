// F0710: Contacts tab
// F0711: Contact detail page link

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Contact {
  id: number
  name: string
  phone_number: string
  email: string | null
  company: string | null
  deal_stage: string | null
  last_called: string | null
  total_calls: number
  notes: string | null
}

export default function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 20

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    try {
      const res = await fetch('/api/contacts')
      const data = await res.json()
      setContacts(Array.isArray(data) ? data : data.contacts || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading contacts:', error)
      setLoading(false)
    }
  }

  const filteredContacts = contacts.filter((contact) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      contact.name?.toLowerCase().includes(searchLower) ||
      contact.phone_number?.includes(search) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.company?.toLowerCase().includes(searchLower)
    )
  })

  const paginatedContacts = filteredContacts.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filteredContacts.length / perPage)

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading contacts...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <a
            href="/api/contacts/export"
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Export CSV
          </a>
          {/* F0753: Dashboard contact import */}
          <a
            href="/dashboard/contacts/import"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Import Contacts
          </a>
        </div>
      </div>

      {paginatedContacts.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          {search ? 'No contacts match your search' : 'No contacts yet'}
        </p>
      ) : (
        <>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deal Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Calls
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Called
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <Link
                      href={`/dashboard/contacts/${contact.id}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {contact.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contact.phone_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {contact.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {contact.company || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {contact.deal_stage ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {contact.deal_stage}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contact.total_calls || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {contact.last_called
                      ? new Date(contact.last_called).toLocaleDateString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {filteredContacts.length > perPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(page - 1) * perPage + 1} to{' '}
                {Math.min(page * perPage, filteredContacts.length)} of {filteredContacts.length}{' '}
                contacts
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
