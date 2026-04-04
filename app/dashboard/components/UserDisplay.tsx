'use client'

import { useEffect, useState } from 'react'
import { getCurrentUser, getRoleLabel, type User } from '@/lib/user-context'

export default function UserDisplay() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = getCurrentUser()
    setUser(user)
    setLoading(false)
  }, [])

  if (loading || !user) {
    return (
      <div className="px-3 py-2 bg-gray-700 rounded text-sm animate-pulse">
        Loading...
      </div>
    )
  }

  const roleLabel = getRoleLabel(user.role)

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-700 rounded-lg">
      <div className="flex flex-col items-end">
        <div className="text-sm font-medium text-white">{user.name || 'User'}</div>
        <div className="text-xs text-gray-400">{roleLabel}</div>
      </div>
      <div className={`w-2 h-2 rounded-full ${
        user.role === 'admin' ? 'bg-red-500' :
        user.role === 'manager' ? 'bg-blue-500' :
        user.role === 'agent' ? 'bg-green-500' :
        'bg-gray-500'
      }`}></div>
    </div>
  )
}
