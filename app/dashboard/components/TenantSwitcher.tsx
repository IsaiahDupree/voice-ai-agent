/**
 * Feature 139: Tenant Switcher Component
 * Navigation component that scopes all dashboard views to selected tenant
 */

'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
}

interface TenantSwitcherProps {
  onTenantChange?: (tenantId: string) => void
  className?: string
}

export default function TenantSwitcher({
  onTenantChange,
  className,
}: TenantSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTenants()
  }, [])

  useEffect(() => {
    // Load selected tenant from localStorage or default to first tenant
    const savedTenantId = localStorage.getItem('selected_tenant_id')
    if (savedTenantId && tenants.length > 0) {
      const tenant = tenants.find((t) => t.id === savedTenantId)
      if (tenant) {
        setSelectedTenant(tenant)
      } else if (tenants.length > 0) {
        setSelectedTenant(tenants[0])
      }
    } else if (tenants.length > 0 && !selectedTenant) {
      setSelectedTenant(tenants[0])
    }
  }, [tenants])

  useEffect(() => {
    if (selectedTenant) {
      // Save to localStorage
      localStorage.setItem('selected_tenant_id', selectedTenant.id)

      // Notify parent component
      if (onTenantChange) {
        onTenantChange(selectedTenant.id)
      }

      // Set global tenant context (could be used by other components)
      if (typeof window !== 'undefined') {
        ;(window as any).__CURRENT_TENANT_ID__ = selectedTenant.id
      }
    }
  }, [selectedTenant, onTenantChange])

  async function fetchTenants() {
    try {
      const response = await fetch('/api/tenants?limit=100')
      if (!response.ok) throw new Error('Failed to fetch tenants')

      const data = await response.json()
      setTenants(data.tenants || [])
    } catch (error) {
      console.error('Error fetching tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setOpen(false)
  }

  const getPlanBadgeColor = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'text-gray-500',
      starter: 'text-blue-500',
      pro: 'text-purple-500',
      enterprise: 'text-gold-500',
    }
    return colors[plan] || 'text-gray-500'
  }

  if (loading) {
    return (
      <div className={cn('w-[200px]', className)}>
        <Button variant="outline" disabled className="w-full justify-start">
          <Building2 className="mr-2 h-4 w-4" />
          Loading...
        </Button>
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div className={cn('w-[200px]', className)}>
        <Button variant="outline" disabled className="w-full justify-start">
          <Building2 className="mr-2 h-4 w-4" />
          No tenants
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('w-[200px]', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div className="flex items-center truncate">
              <Building2 className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">
                {selectedTenant ? selectedTenant.name : 'Select tenant...'}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search tenants..." />
            <CommandEmpty>No tenant found.</CommandEmpty>
            <CommandGroup>
              {tenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  onSelect={() => handleSelectTenant(tenant)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedTenant?.id === tenant.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate">{tenant.name}</span>
                    <span
                      className={cn(
                        'text-xs truncate',
                        getPlanBadgeColor(tenant.plan)
                      )}
                    >
                      {tenant.slug} • {tenant.plan}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Tenant Info Banner */}
      {selectedTenant && (
        <div className="mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-mono">{selectedTenant.slug}</span>
            <span>•</span>
            <span className={getPlanBadgeColor(selectedTenant.plan)}>
              {selectedTenant.plan}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Hook to get current tenant ID
 */
export function useCurrentTenant(): string | null {
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    // Get from localStorage
    const savedTenantId = localStorage.getItem('selected_tenant_id')
    setTenantId(savedTenantId)

    // Also check global window object
    if (typeof window !== 'undefined' && (window as any).__CURRENT_TENANT_ID__) {
      setTenantId((window as any).__CURRENT_TENANT_ID__)
    }
  }, [])

  return tenantId
}

/**
 * Hook to scope API calls to current tenant
 */
export function useTenantScopedFetch() {
  const tenantId = useCurrentTenant()

  const fetchWithTenant = async (url: string, options?: RequestInit) => {
    const headers = {
      ...options?.headers,
      'x-current-tenant-id': tenantId || 'default',
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }

  return { fetchWithTenant, tenantId }
}
