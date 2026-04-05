/**
 * Feature 182: ConditionNode Component
 * Conditional branching based on context variables
 */

'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export default memo(function ConditionNode({ data, isConnectable }: NodeProps) {
  return (
    <div className="bg-white border-2 border-yellow-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      <div className="bg-yellow-500 text-white px-3 py-2 rounded-t-lg font-semibold text-sm">
        ❓ Condition
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
          Condition Expression
        </label>
        <input
          type="text"
          value={data.condition || ''}
          onChange={(e) => {
            data.condition = e.target.value
          }}
          className="w-full px-2 py-1 text-sm border rounded font-mono"
          placeholder='intent === "affirmative"'
        />
        <div className="mt-2 text-xs text-gray-600">
          Use: intent, sentiment, caller_name, etc.
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="true"
        isConnectable={isConnectable}
        style={{ top: '50%', background: '#22c55e' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        isConnectable={isConnectable}
        style={{ top: '50%', background: '#ef4444' }}
      />
    </div>
  )
})
