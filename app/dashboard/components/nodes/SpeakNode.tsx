/**
 * Feature 180: SpeakNode Component
 * Agent speaks a message with variable interpolation support
 */

'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export default memo(function SpeakNode({ data, isConnectable }: NodeProps) {
  return (
    <div className="bg-white border-2 border-blue-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      <div className="bg-blue-500 text-white px-3 py-2 rounded-t-lg font-semibold text-sm">
        💬 Speak
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
        <textarea
          value={data.message || ''}
          onChange={(e) => {
            data.message = e.target.value
          }}
          className="w-full px-2 py-1 text-sm border rounded"
          rows={3}
          placeholder="Message to speak (use {{variable}} for dynamic content)"
        />
        <div className="mt-2 text-xs text-gray-600">
          Variables: {'{{caller_name}}'}, {'{{caller_phone}}'}
        </div>
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
