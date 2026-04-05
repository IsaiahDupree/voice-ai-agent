/**
 * Feature 178: Flow Builder Dashboard
 * Visual conversation flow builder using ReactFlow
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import FlowCanvas from '../components/FlowCanvas'
import type { ConversationFlow } from '@/lib/flow-types'

export default function FlowsPage() {
  const router = useRouter()
  const [flows, setFlows] = useState<ConversationFlow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<ConversationFlow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewFlowModal, setShowNewFlowModal] = useState(false)
  const [newFlowName, setNewFlowName] = useState('')
  const [newFlowDescription, setNewFlowDescription] = useState('')
  const [tenantId] = useState('default')

  useEffect(() => {
    fetchFlows()
  }, [])

  async function fetchFlows() {
    try {
      setLoading(true)
      const response = await fetch(`/api/flows?tenant_id=${tenantId}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setFlows(data.flows || [])
    } catch (err: any) {
      console.error('Error fetching flows:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateFlow() {
    if (!newFlowName.trim()) {
      setError('Flow name is required')
      return
    }

    try {
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          name: newFlowName,
          description: newFlowDescription,
          nodes: [],
          edges: [],
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setNewFlowName('')
      setNewFlowDescription('')
      setShowNewFlowModal(false)
      await fetchFlows()
      setSelectedFlow(data.flow)
    } catch (err: any) {
      console.error('Error creating flow:', err)
      setError(err.message)
    }
  }

  async function handleDeleteFlow(flowId: number) {
    if (!confirm('Are you sure you want to delete this flow?')) {
      return
    }

    try {
      const response = await fetch(`/api/flows/${flowId}?tenant_id=${tenantId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      await fetchFlows()
      if (selectedFlow?.id === flowId) {
        setSelectedFlow(null)
      }
    } catch (err: any) {
      console.error('Error deleting flow:', err)
      setError(err.message)
    }
  }

  const handleSaveFlow = useCallback(
    async (updatedFlow: ConversationFlow) => {
      try {
        const response = await fetch(`/api/flows/${updatedFlow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            nodes: updatedFlow.nodes,
            edges: updatedFlow.edges,
          }),
        })

        const data = await response.json()

        if (data.error) {
          throw new Error(data.error)
        }

        // Update flow in list
        setFlows((prev) =>
          prev.map((f) => (f.id === updatedFlow.id ? data.flow : f))
        )
        setSelectedFlow(data.flow)
      } catch (err: any) {
        console.error('Error saving flow:', err)
        setError(err.message)
      }
    },
    [tenantId]
  )

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conversation Flow Builder</h1>
          <p className="text-sm text-gray-600">
            Design voice AI conversation flows visually
          </p>
        </div>
        <button
          onClick={() => setShowNewFlowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + New Flow
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mx-6 mt-4 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right font-bold"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Flow list */}
        <div className="w-64 bg-gray-50 border-r overflow-y-auto p-4">
          <h2 className="font-semibold mb-3">Your Flows ({flows.length})</h2>

          {loading && (
            <div className="text-center py-4 text-gray-600">Loading...</div>
          )}

          {!loading && flows.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No flows yet. Click "New Flow" to create one.
            </div>
          )}

          <div className="space-y-2">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className={`p-3 rounded border cursor-pointer hover:bg-white transition ${
                  selectedFlow?.id === flow.id
                    ? 'bg-white border-blue-500'
                    : 'bg-gray-100 border-gray-300'
                }`}
                onClick={() => setSelectedFlow(flow)}
              >
                <div className="font-medium text-sm truncate">{flow.name}</div>
                <div className="text-xs text-gray-600 mt-1">
                  v{flow.version} • {flow.nodes?.length || 0} nodes
                </div>
                {flow.is_active && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                    Active
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteFlow(flow.id!)
                  }}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main canvas area */}
        <div className="flex-1 bg-gray-100">
          {selectedFlow ? (
            <FlowCanvas
              flow={selectedFlow}
              onSave={handleSaveFlow}
              tenantId={tenantId}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">No flow selected</p>
                <p className="text-sm">
                  Select a flow from the sidebar or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Flow Modal */}
      {showNewFlowModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full">
            <h2 className="text-xl font-bold mb-4">Create New Flow</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Flow Name *
                </label>
                <input
                  type="text"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., Appointment Booking Flow"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newFlowDescription}
                  onChange={(e) => setNewFlowDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder="Brief description of this flow"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowNewFlowModal(false)
                    setNewFlowName('')
                    setNewFlowDescription('')
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFlow}
                  disabled={!newFlowName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
