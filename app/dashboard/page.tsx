'use client';

import { StatsBar } from './components/stats-bar';
import { CampaignsWidget } from './components/campaigns-widget';
import { RecentCallsFeed } from './components/recent-calls-feed';
import { BookingsWidget } from './components/bookings-widget';
import { PerformanceWidget } from './components/performance-widget';
import { CallsTrendChart } from './components/calls-trend-chart';

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your AI voice agent activity</p>
      </div>

      {/* Stats Bar */}
      <div className="mb-8">
        <StatsBar />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Campaigns & Recent Calls */}
        <div>
          <CampaignsWidget />
        </div>
        <div>
          <RecentCallsFeed />
        </div>
      </div>

      {/* Secondary Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bookings & Performance */}
        <div>
          <BookingsWidget />
        </div>
        <div>
          <PerformanceWidget />
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="mt-8">
        <CallsTrendChart />
      </div>
    </div>
  );
}
