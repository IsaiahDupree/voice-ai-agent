import * as React from 'react'

interface PopoverProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

export function Popover({ open, onOpenChange, children }: PopoverProps) {
  return <div className="relative inline-block">{children}</div>
}

interface PopoverTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

export function PopoverTrigger({ asChild, children, ...props }: PopoverTriggerProps) {
  return <div {...props}>{children}</div>
}

export function PopoverContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`absolute z-50 mt-1 rounded-md border border-gray-200 bg-white shadow-lg ${className}`}
      {...props}
    />
  )
}
