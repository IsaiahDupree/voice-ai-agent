/**
 * Feature 138: Tenant Management Dashboard
 * Lists all tenants with stats, allows creating/editing tenants
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Users, Phone, FileText, Settings } from 'lucide-react'

interface Tenant {
  id: string
  name: string
  slug: string
  phone_numbers: string[]
  plan: string
  created_at: string
  tenant_configs: Array<{
    assistant_id: string | null
    persona_name: string | null
    kb_namespace: string
  }>
}

interface TenantStats {
  total_calls: number
  total_contacts: number
  total_documents: number
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Record<string, TenantStats>>({})

  useEffect(() => {
    fetchTenants()
  }, [])

  async function fetchTenants() {
    try {
      const response = await fetch('/api/tenants')
      if (!response.ok) throw new Error('Failed to fetch tenants')

      const data = await response.json()
      setTenants(data.tenants || [])

      // Fetch stats for each tenant
      const statsPromises = (data.tenants || []).map(async (tenant: Tenant) => {
        const statsRes = await fetch(`/api/tenants/${tenant.id}`)
        const statsData = await statsRes.json()
        return { id: tenant.id, stats: statsData.stats }
      })

      const allStats = await Promise.all(statsPromises)
      const statsMap: Record<string, TenantStats> = {}
      allStats.forEach(({ id, stats }) => {
        statsMap[id] = stats
      })
      setStats(statsMap)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getPlanColor = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-500',
      starter: 'bg-blue-500',
      pro: 'bg-purple-500',
      enterprise: 'bg-gold-500',
    }
    return colors[plan] || 'bg-gray-500'
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading tenants...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            Manage multi-tenant configurations and settings
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Tenant
        </Button>
      </div>

      {/* Tenants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tenants.map((tenant) => {
          const tenantStats = stats[tenant.id] || {
            total_calls: 0,
            total_contacts: 0,
            total_documents: 0,
          }

          return (
            <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{tenant.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {tenant.slug}
                    </CardDescription>
                  </div>
                  <Badge className={getPlanColor(tenant.plan)}>
                    {tenant.plan}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Phone Numbers */}
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {tenant.phone_numbers.length} phone number
                    {tenant.phone_numbers.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {tenantStats.total_calls}
                    </div>
                    <div className="text-xs text-muted-foreground">Calls</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {tenantStats.total_contacts}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Contacts
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {tenantStats.total_documents}
                    </div>
                    <div className="text-xs text-muted-foreground">Docs</div>
                  </div>
                </div>

                {/* Config Info */}
                {tenant.tenant_configs?.[0] && (
                  <div className="pt-2 border-t space-y-1 text-sm">
                    {tenant.tenant_configs[0].assistant_id && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Assistant configured
                        </span>
                      </div>
                    )}
                    {tenant.tenant_configs[0].kb_namespace && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          KB: {tenant.tenant_configs[0].kb_namespace}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => (window.location.href = `/dashboard/tenants/${tenant.id}`)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {tenants.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tenants yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first tenant to get started with multi-tenant management
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create First Tenant
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
