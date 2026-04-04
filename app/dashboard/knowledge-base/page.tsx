/**
 * Knowledge Base Dashboard
 * Upload documents and test semantic search
 */

'use client'

import { useState, useEffect } from 'react'

interface Document {
  id: number
  title: string
  fileType: string
  chunkCount: number
  createdAt: string
  metadata: any
}

interface SearchResult {
  id: number
  documentId: number
  documentTitle: string
  chunkText: string
  chunkIndex: number
  similarity: number
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    try {
      setLoading(true)
      const response = await fetch('/api/kb/documents')
      const data = await response.json()

      if (data.success) {
        setDocuments(data.documents)
      }
    } catch (err: any) {
      console.error('Failed to fetch documents:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleFileUpload() {
    if (!selectedFile || !uploadTitle) {
      setError('Please select a file and enter a title')
      return
    }

    try {
      setUploading(true)
      setError(null)

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('title', uploadTitle)
      formData.append('tenantId', 'default')

      const response = await fetch('/api/kb/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      // Reset form and refresh list
      setSelectedFile(null)
      setUploadTitle('')
      await fetchDocuments()

      alert(`Document uploaded successfully! Created ${data.result.chunkCount} chunks.`)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    try {
      setSearching(true)
      setError(null)

      const response = await fetch('/api/kb/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
          similarityThreshold: 0.7,
          tenantId: 'default',
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Search failed')
      }

      setSearchResults(data.results)
    } catch (err: any) {
      console.error('Search error:', err)
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleDelete(documentId: number) {
    if (!confirm('Are you sure you want to delete this document?')) {
      return
    }

    try {
      const response = await fetch(`/api/kb/documents/${documentId}?tenantId=default`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Delete failed')
      }

      await fetchDocuments()
    } catch (err: any) {
      console.error('Delete error:', err)
      setError(err.message)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Knowledge Base</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="Enter document title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              File (PDF, DOCX, TXT)
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>
          <button
            onClick={handleFileUpload}
            disabled={uploading || !selectedFile || !uploadTitle}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Search</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-2 border rounded"
            placeholder="Enter search query..."
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="font-semibold">Results ({searchResults.length})</h3>
            {searchResults.map((result) => (
              <div key={result.id} className="border rounded p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium">{result.documentTitle}</div>
                  <div className="text-sm text-gray-600">
                    {(result.similarity * 100).toFixed(1)}% match
                  </div>
                </div>
                <p className="text-sm text-gray-700">{result.chunkText}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Documents ({documents.length})
        </h2>
        {loading ? (
          <p>Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="text-gray-600">No documents yet. Upload one to get started!</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="border rounded p-4 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-sm text-gray-600">
                    {doc.fileType.toUpperCase()} • {doc.chunkCount} chunks •{' '}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-red-600 hover:text-red-800 px-3 py-1 border border-red-600 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
