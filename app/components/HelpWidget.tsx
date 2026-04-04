'use client'

import { useState } from 'react'

// F0759: Dashboard help widget
interface HelpArticle {
  id: string
  title: string
  category: 'getting-started' | 'features' | 'troubleshooting' | 'api'
  url: string
}

const helpArticles: HelpArticle[] = [
  {
    id: '1',
    title: 'Creating your first AI agent',
    category: 'getting-started',
    url: '/docs/getting-started/first-agent',
  },
  {
    id: '2',
    title: 'Connecting Cal.com for bookings',
    category: 'getting-started',
    url: '/docs/getting-started/calendar-setup',
  },
  {
    id: '3',
    title: 'Setting up phone numbers',
    category: 'getting-started',
    url: '/docs/getting-started/phone-numbers',
  },
  {
    id: '4',
    title: 'Understanding call analytics',
    category: 'features',
    url: '/docs/features/analytics',
  },
  {
    id: '5',
    title: 'Creating outbound campaigns',
    category: 'features',
    url: '/docs/features/campaigns',
  },
  {
    id: '6',
    title: 'Customizing agent personas',
    category: 'features',
    url: '/docs/features/personas',
  },
  {
    id: '7',
    title: 'Why are calls dropping?',
    category: 'troubleshooting',
    url: '/docs/troubleshooting/call-drops',
  },
  {
    id: '8',
    title: 'Booking failures and fixes',
    category: 'troubleshooting',
    url: '/docs/troubleshooting/booking-errors',
  },
  {
    id: '9',
    title: 'API authentication',
    category: 'api',
    url: '/docs/api/authentication',
  },
  {
    id: '10',
    title: 'Webhook endpoints',
    category: 'api',
    url: '/docs/api/webhooks',
  },
]

const categories = [
  { id: 'getting-started', label: 'Getting Started', icon: '🚀' },
  { id: 'features', label: 'Features', icon: '⚡' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🔧' },
  { id: 'api', label: 'API & Webhooks', icon: '🔌' },
]

export default function HelpWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredArticles = helpArticles.filter((article) => {
    const matchesSearch = !searchQuery || article.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || article.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <>
      {/* Help Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 bg-primary hover:bg-primary-dark text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
        aria-label="Help"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Help Panel */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed bottom-6 right-6 w-96 max-h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary to-primary-dark text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">How can we help?</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors"
                  aria-label="Close help"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search help articles..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    !selectedCategory
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="mr-1">{category.icon}</span>
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Articles */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredArticles.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    No articles found
                  </p>
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <a
                    key={article.id}
                    href={article.url}
                    className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                          {article.title}
                        </p>
                      </div>
                      <svg className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="/docs"
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
                >
                  📚 Full Docs
                </a>
                <a
                  href="mailto:support@example.com"
                  className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-center"
                >
                  ✉️ Contact Support
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
