/**
 * Feature 184: TransferNode Component
 * Transfer call to human agent or external number
 */

'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export default memo(function TransferNode({ data, isConnectable }: NodeProps) {
  return (
    <div className="bg-white border-2 border-orange-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      <div className="bg-orange-500 text-white px-3 py-2 rounded-t-lg font-semibold text-sm">
        📞 Transfer
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
          Transfer Type
        </label>
        <select
          value={data.transfer_type || 'human'}
          onChange={(e) => {
            data.transfer_type = e.target.value
          }}
          className="w-full mb-2 px-2 py-1 text-sm border rounded"
        >
          <option value="human">Human Agent</option>
          <option value="external_number">External Number</option>
          <option value="sip_uri">SIP URI</option>
        </select>
        <label className="text-xs text-gray-700 block mb-1">
          Destination
        </label>
        <input
          type="text"
          value={data.destination || ''}
          onChange={(e) => {
            data.destination = e.target.value
          }}
          className="w-full px-2 py-1 text-sm border rounded"
          placeholder="+15555555555 or sip:agent@domain.com"
        />
        <input
          type="text"
          value={data.transfer_message || ''}
          onChange={(e) => {
            data.transfer_message = e.target.value
          }}
          className="w-full mt-2 px-2 py-1 text-sm border rounded"
          placeholder="Message before transfer (optional)"
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
