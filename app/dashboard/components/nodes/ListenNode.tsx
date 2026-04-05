/**
 * Feature 181: ListenNode Component
 * Listen for specific intents from the caller
 */

'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export default memo(function ListenNode({ data, isConnectable }: NodeProps) {
  return (
    <div className="bg-white border-2 border-green-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      <div className="bg-green-500 text-white px-3 py-2 rounded-t-lg font-semibold text-sm">
        👂 Listen
      </div>
      <div className="p-3">
        <input
          type="text"
          value={data.label || ''}
          onChange={(e) => {
            data.label = e.target.value
          }}
          className="w-full mb-2 px-2 py-1 text-xs font-semibold border rounded"
          placeholder="Node label"
        />
        <label className="text-xs text-gray-700 block mb-1">
          Expected Intents (comma-separated)
        </label>
        <input
          type="text"
          value={data.expected_intents?.join(', ') || ''}
          onChange={(e) => {
            data.expected_intents = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          }}
          className="w-full px-2 py-1 text-sm border rounded"
          placeholder="affirmative, negative, book_appointment"
        />
        <input
          type="number"
          value={data.timeout_seconds || 10}
          onChange={(e) => {
            data.timeout_seconds = parseInt(e.target.value) || 10
          }}
          className="w-full mt-2 px-2 py-1 text-sm border rounded"
          placeholder="Timeout (seconds)"
        />
      </div>

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      />
    </div>
  )
})
