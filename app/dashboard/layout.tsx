'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LayoutGrid, PhoneCall, Users, FileText, Calendar, BarChart3, Settings, MessageSquare, ShieldCheck, Search } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/dashboard/calls', label: 'Calls', icon: PhoneCall },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: FileText },
  { href: '/dashboard/bookings', label: 'Bookings', icon: Calendar },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/sms-inbox', label: 'SMS Inbox', icon: MessageSquare },
  { href: '/dashboard/compliance/audit-log', label: 'Audit Log', icon: ShieldCheck },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

type SearchResult = {
  id: string
  type: 'call' | 'contact' | 'campaign'
  title: string
  subtitle?: string
  url: string
}

const TYPE_LABELS: Record<string, string> = {
  call: 'Call',
  contact: 'Contact',
  campaign: 'Campaign',
}

const TYPE_COLORS: Record<string, string> = {
  call: 'bg-blue-100 text-blue-700',
  contact: 'bg-green-100 text-green-700',
  campaign: 'bg-purple-100 text-purple-700',
}

function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results || [])
        setOpen(true)
        setActiveIndex(-1)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)
  }, [query])

  function handleSelect(result: SearchResult) {
    router.push(result.url)
    setQuery('')
    setOpen(false)
    setResults([])
    inputRef.current?.blur()
  }

  function handleKeyNav(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    }
  }

  return (
    <div className="relative w-72">
      <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-muted/40 focus-within:bg-background focus-within:border-primary transition-colors">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyNav}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search… (⌘K)"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && (
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {results.map((result, idx) => (
            <button
              key={result.id}
              onMouseDown={() => handleSelect(result)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors ${idx === activeIndex ? 'bg-muted' : ''}`}
            >
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${TYPE_COLORS[result.type] || 'bg-gray-100 text-gray-700'}`}>
                {TYPE_LABELS[result.type] || result.type}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{result.title}</div>
                {result.subtitle && (
                  <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-lg px-4 py-3 text-sm text-muted-foreground">
          No results for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card">
        <div className="p-6">
          <h1 className="text-xl font-bold">Voice AI Agent</h1>
        </div>
        <nav className="space-y-2 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Top header with search */}
        <header className="flex items-center justify-end px-8 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <GlobalSearch />
        </header>
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
