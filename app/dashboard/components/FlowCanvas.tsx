/**
 * Feature 179: FlowCanvas Component
 * ReactFlow canvas with custom node types and drag-and-drop
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MiniMap,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'

import type { ConversationFlow } from '@/lib/flow-types'
import SpeakNodeComponent from './nodes/SpeakNode'
import ListenNodeComponent from './nodes/ListenNode'
import ConditionNodeComponent from './nodes/ConditionNode'
import ToolNodeComponent from './nodes/ToolNode'
import TransferNodeComponent from './nodes/TransferNode'
import EndNodeComponent from './nodes/EndNode'
import NodePalette from './NodePalette'
import FlowSimulator from './FlowSimulator'

interface FlowCanvasProps {
  flow: ConversationFlow
  onSave: (flow: ConversationFlow) => void
  tenantId: string
}

export default function FlowCanvas({ flow, onSave, tenantId }: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    (flow.nodes as any[]) || []
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (flow.edges as any[]) || []
  )
  const [exporting, setExporting] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportResult, setExportResult] = useState<any>(null)
  const [showInteractiveSimulator, setShowInteractiveSimulator] = useState(false)

  // Custom node types
  const nodeTypes = useMemo(
    () => ({
      speak: SpeakNodeComponent,
      listen: ListenNodeComponent,
      condition: ConditionNodeComponent,
      tool: ToolNodeComponent,
      transfer: TransferNodeComponent,
      end: EndNodeComponent,
    }),
    []
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds))
    },
    [setEdges]
  )

  const handleSave = useCallback(() => {
    const updatedFlow: ConversationFlow = {
      ...flow,
      nodes: nodes as any,
      edges: edges as any,
    }
    onSave(updatedFlow)
  }, [flow, nodes, edges, onSave])

  const handleExport = async () => {
    try {
      setExporting(true)
      const response = await fetch(
        `/api/flows/${flow.id}/export?tenant_id=${tenantId}`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setExportResult(data)
      setShowExportModal(true)
    } catch (err: any) {
      console.error('Export error:', err)
      alert(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleSimulate = async () => {
    try {
      setSimulating(true)

      // Prompt for mock user inputs
      const inputsRaw = prompt(
        'Enter mock user responses (comma-separated):\nExample: yes, tomorrow at 2pm, john@example.com'
      )

      if (!inputsRaw) {
        setSimulating(false)
        return
      }

      const userInputs = inputsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const response = await fetch(
        `/api/flows/${flow.id}/simulate?tenant_id=${tenantId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            user_inputs: userInputs,
            context: {
              caller_name: 'Test User',
              caller_phone: '+15555555555',
            },
            format: 'text',
          }),
        }
      )

      const textResult = await response.text()

      // Display in new window or alert
      const simulationWindow = window.open('', '_blank', 'width=800,height=600')
      if (simulationWindow) {
        simulationWindow.document.write(`
          <html>
            <head>
              <title>Flow Simulation: ${flow.name}</title>
              <style>
                body { font-family: monospace; padding: 20px; white-space: pre-wrap; }
              </style>
            </head>
            <body>${textResult}</body>
          </html>
        `)
        simulationWindow.document.close()
      } else {
        alert(textResult)
      }
    } catch (err: any) {
      console.error('Simulation error:', err)
      alert(`Simulation failed: ${err.message}`)
    } finally {
      setSimulating(false)
    }
  }

  const handleAddNode = useCallback(
    (nodeType: string) => {
      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: nodeType,
        position: { x: 100, y: 100 },
        data: {
          label: `New ${nodeType} node`,
          ...(nodeType === 'speak' && { message: 'Hello!' }),
          ...(nodeType === 'listen' && { expected_intents: ['affirmative', 'negative'] }),
          ...(nodeType === 'condition' && {
            condition_type: 'intent',
            condition: 'intent === "affirmative"',
            branches: {},
          }),
          ...(nodeType === 'tool' && {
            tool_type: 'vapi_function',
            tool_name: '',
            parameters: {},
          }),
          ...(nodeType === 'transfer' && {
            transfer_type: 'human',
            destination: '',
          }),
          ...(nodeType === 'end' && { end_reason: 'success' }),
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [setNodes]
  )

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{flow.name}</h2>
          <p className="text-xs text-gray-600">
            Version {flow.version} • {nodes.length} nodes • {edges.length} edges
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            💾 Save
          </button>

          <button
            onClick={() => setShowInteractiveSimulator(true)}
            disabled={nodes.length === 0}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:bg-gray-400"
          >
            💬 Interactive Test
          </button>

          <button
            onClick={handleSimulate}
            disabled={simulating || nodes.length === 0}
            className="px-4 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 disabled:bg-gray-400"
          >
            {simulating ? 'Simulating...' : '▶️ Batch Simulate'}
          </button>

          <button
            onClick={handleExport}
            disabled={exporting || nodes.length === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {exporting ? 'Exporting...' : '📤 Export to Vapi'}
          </button>
        </div>
      </div>

      {/* ReactFlow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

          {/* Node Palette */}
          <Panel position="top-left">
            <NodePalette onAddNode={handleAddNode} />
          </Panel>
        </ReactFlow>
      </div>

      {/* Export Modal */}
      {showExportModal && exportResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[800px] max-w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Export Successful ✅</h2>

            {exportResult.vapi_assistant_id && (
              <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded">
                <p className="font-semibold">Vapi Assistant Created!</p>
                <p className="text-sm">
                  Assistant ID: <code className="bg-white px-2 py-1 rounded">{exportResult.vapi_assistant_id}</code>
                </p>
              </div>
            )}

            <div className="mb-4">
              <h3 className="font-semibold mb-2">System Prompt</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-64">
                {exportResult.system_prompt}
              </pre>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Assistant Config JSON</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-64">
                {JSON.stringify(exportResult.assistant_config, null, 2)}
              </pre>
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Interactive Simulator */}
      {showInteractiveSimulator && (
        <FlowSimulator
          flow={flow}
          onClose={() => setShowInteractiveSimulator(false)}
        />
      )}
    </div>
  )
}
