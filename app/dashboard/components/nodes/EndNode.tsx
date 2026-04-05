/**
 * Feature 185: EndNode Component
 * End conversation with success/failure outcome
 */

'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export default memo(function EndNode({ data, isConnectable }: NodeProps) {
  return (
    <div className="bg-white border-2 border-red-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      <div className="bg-red-500 text-white px-3 py-2 rounded-t-lg font-semibold text-sm">
        🏁 End
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
        <label className="text-xs text-gray-700 block mb-1">End Reason</label>
        <select
          value={data.end_reason || 'success'}
          onChange={(e) => {
            data.end_reason = e.target.value
          }}
          className="w-full mb-2 px-2 py-1 text-sm border rounded"
        >
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="hangup">Hangup</option>
          <option value="timeout">Timeout</option>
        </select>
        <label className="text-xs text-gray-700 block mb-1">
          Final Message (optional)
        </label>
        <textarea
          value={data.final_message || ''}
          onChange={(e) => {
            data.final_message = e.target.value
          }}
          className="w-full px-2 py-1 text-sm border rounded"
          rows={2}
          placeholder="Goodbye message"
        />
        <input
          type="text"
          value={data.record_outcome || ''}
          onChange={(e) => {
            data.record_outcome = e.target.value
          }}
          className="w-full mt-2 px-2 py-1 text-sm border rounded"
          placeholder="Outcome to record (optional)"
        />
      </div>

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
      />
    </div>
  )
})
