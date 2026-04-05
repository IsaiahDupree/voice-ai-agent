import Link from 'next/link'

export const metadata = {
  title: 'LocalReach — Voice AI Outbound Dashboard',
  description: 'Mobile-first dashboard for managing local outbound calling campaigns',
}

export default function LocalReachLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-lg sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Back to main dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <Link href="/localreach" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight">LocalReach</span>
            </Link>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              href="/localreach/campaigns"
              className="min-h-[44px] px-3 flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Campaigns
            </Link>
            <Link
              href="/localreach/offers"
              className="min-h-[44px] px-3 flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Offers
            </Link>
            <Link
              href="/localreach/map"
              className="min-h-[44px] px-3 hidden sm:flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Map
            </Link>
            <Link
              href="/localreach/compliance"
              className="min-h-[44px] px-3 hidden sm:flex items-center text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Compliance
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-lg sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto px-4 py-4 sm:py-6">
        {children}
      </main>
    </div>
  )
}
