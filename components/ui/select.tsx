import * as React from "react"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (val: string) => void
}

export function Select({ className = "", onValueChange, onChange, children, ...props }: SelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange?.(e.target.value)
    onChange?.(e)
  }
  return (
    <select
      className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      onChange={handleChange}
      {...props}
    >
      {children}
    </select>
  )
}

export function SelectTrigger({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${className}`} {...props} />
}

export function SelectValue({ className = "", placeholder, ...props }: React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }) {
  return <span className={`${className}`} {...props}>{props.children || placeholder}</span>
}

export function SelectContent({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-md border border-gray-300 bg-white shadow-lg ${className}`} {...props} />
}

export function SelectItem({ className = "", ...props }: React.OptionHTMLAttributes<HTMLOptionElement>) {
  return <option className={`px-2 py-1.5 text-sm ${className}`} {...props} />
}
