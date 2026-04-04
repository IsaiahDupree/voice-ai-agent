import { useEffect } from 'react'

// F0746: Keyboard shortcuts for common dashboard actions
export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl === undefined || shortcut.ctrl === event.ctrlKey
        const shiftMatch = shortcut.shift === undefined || shortcut.shift === event.shiftKey
        const altMatch = shortcut.alt === undefined || shortcut.alt === event.altKey
        const metaMatch = shortcut.meta === undefined || shortcut.meta === event.metaKey
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

        if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
          event.preventDefault()
          shortcut.action()
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

// F0746: Default keyboard shortcuts for dashboard
export const defaultShortcuts = {
  search: { key: 'k', ctrl: true, shift: false, description: 'Open search' },
  newCall: { key: 'n', ctrl: true, shift: false, description: 'Start new call' },
  refresh: { key: 'r', ctrl: true, shift: false, description: 'Refresh data' },
  help: { key: '/', shift: true, description: 'Show keyboard shortcuts' },
  settings: { key: ',', ctrl: true, description: 'Open settings' },
  notifications: { key: 'b', ctrl: true, shift: false, description: 'Toggle notifications' },
}
