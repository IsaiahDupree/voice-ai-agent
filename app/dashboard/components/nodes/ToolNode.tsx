/**
 * Feature 183: ToolNode Component
 * Call a function tool (Vapi or MCP)
 */

'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export default memo(function ToolNode({ data, isConnectable }: NodeProps) {
  return (
    <div className="bg-white border-2 border-purple-500 rounded-lg shadow-lg min-w-[200px] max-w-[300px]">
      <div className="bg-purple-500 text-white px-3 py-2 rounded-t-lg font-semibold text-sm">
        🛠️ Tool Call
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
        <label className="text-xs text-gray-700 block mb-1">Tool Type</label>
        <select
          value={data.tool_type || 'vapi_function'}
          onChange={(e) => {
            data.tool_type = e.target.value
          }}
          className="w-full mb-2 px-2 py-1 text-sm border rounded"
        >
          <option value="vapi_function">Vapi Function</option>
          <option value="mcp_tool">MCP Tool</option>
        </select>
        <label className="text-xs text-gray-700 block mb-1">Tool Name</label>
        <input
          type="text"
          value={data.tool_name || ''}
          onChange={(e) => {
            data.tool_name = e.target.value
          }}
          className="w-full px-2 py-1 text-sm border rounded font-mono"
          placeholder="checkCalendar"
        />
        <label className="text-xs text-gray-700 block mb-1 mt-2">
          Store Result As (variable name)
        </label>
        <input
          type="text"
          value={data.store_result_as || ''}
          onChange={(e) => {
            data.store_result_as = e.target.value
          }}
          className="w-full px-2 py-1 text-sm border rounded"
          placeholder="calendar_slots"
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
