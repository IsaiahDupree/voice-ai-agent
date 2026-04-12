export default function DashboardPage() {
  return (
    <main className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Manage your AI voice agent campaigns and calls</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Active Campaigns</h2>
          <p className="text-sm text-muted-foreground">No active campaigns. Start a new campaign to begin outreach.</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Recent Calls</h2>
          <p className="text-sm text-muted-foreground">No calls yet. Configure your agent to start calling.</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Bookings</h2>
          <p className="text-sm text-muted-foreground">No bookings scheduled. Calls that convert will appear here.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Quick Actions</h2>
          <div className="flex flex-col gap-2">
            <a href="/dashboard/contacts" className="text-sm text-blue-600 hover:underline">Manage Contacts</a>
            <a href="/dashboard/scheduling" className="text-sm text-blue-600 hover:underline">View Schedule</a>
            <a href="/dashboard/caller-memory" className="text-sm text-blue-600 hover:underline">Caller Memory</a>
            <a href="/dashboard/business-context" className="text-sm text-blue-600 hover:underline">Business Context</a>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold mb-2">Performance</h2>
          <p className="text-sm text-muted-foreground">Analytics will appear here once calls are made.</p>
        </div>
      </div>
    </main>
  )
}
