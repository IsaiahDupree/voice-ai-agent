'use client'

import { useEffect, useState } from 'react'

// F0746: Keyboard shortcuts modal
interface ShortcutGroup {
  title: string
  shortcuts: Array<{
    keys: string[]
    description: string
  }>
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Open search' },
      { keys: ['Shift', '?'], description: 'Show keyboard shortcuts' },
      { keys: ['Ctrl', 'R'], description: 'Refresh data' },
      { keys: ['Ctrl', ','], description: 'Open settings' },
      { keys: ['Esc'], description: 'Close modal' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'Start new call' },
      { keys: ['Ctrl', 'B'], description: 'Toggle notifications' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['1', '2', '3'], description: 'Switch tabs' },
    ],
  },
]

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Keyboard Shortcuts
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Boost your productivity with these shortcuts
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close shortcuts modal"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6 space-y-8">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {group.title}
              </h3>
              <div className="space-y-3">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1">
                          <kbd className="px-2.5 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
                            {key}
                          </kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-gray-400 dark:text-gray-500">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> to close this dialog
          </p>
        </div>
      </div>
    </div>
  )
}
