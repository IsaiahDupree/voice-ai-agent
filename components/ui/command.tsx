import * as React from 'react'

export function Command({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex flex-col overflow-hidden rounded-md bg-white ${className}`} {...props} />
}

export function CommandInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`flex h-10 w-full rounded-md bg-transparent px-3 py-2 text-sm outline-none placeholder:text-gray-400 ${className}`}
      {...props}
    />
  )
}

export function CommandEmpty({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`py-6 text-center text-sm text-gray-500 ${className}`} {...props} />
}

export function CommandGroup({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`overflow-hidden p-1 ${className}`} {...props} />
}

export function CommandItem({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 ${className}`}
      {...props}
    />
  )
}
