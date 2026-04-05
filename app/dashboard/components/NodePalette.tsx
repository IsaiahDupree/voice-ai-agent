/**
 * Feature 186: NodePalette Component
 * Sidebar with drag-and-drop node types
 */

'use client'

interface NodePaletteProps {
  onAddNode: (nodeType: string) => void
}

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  const nodeTypes = [
    { type: 'speak', label: 'Speak', icon: '💬', color: 'bg-blue-100' },
    { type: 'listen', label: 'Listen', icon: '👂', color: 'bg-green-100' },
    { type: 'condition', label: 'Condition', icon: '❓', color: 'bg-yellow-100' },
    { type: 'tool', label: 'Tool Call', icon: '🛠️', color: 'bg-purple-100' },
    { type: 'transfer', label: 'Transfer', icon: '📞', color: 'bg-orange-100' },
    { type: 'end', label: 'End', icon: '🏁', color: 'bg-red-100' },
  ]

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 w-48">
      <div className="text-sm font-semibold mb-2 text-gray-700">Add Node</div>
      <div className="space-y-1">
        {nodeTypes.map((node) => (
          <button
            key={node.type}
            onClick={() => onAddNode(node.type)}
            className={`w-full text-left px-3 py-2 rounded ${node.color} hover:opacity-80 transition text-sm flex items-center gap-2`}
          >
            <span>{node.icon}</span>
            <span>{node.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
        Click a node type to add it to the canvas
      </div>
    </div>
  )
}
