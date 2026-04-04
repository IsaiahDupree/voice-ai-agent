import * as React from "react"
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export function Input({ className = "", ...props }: InputProps) {
  return <input className={`flex h-10 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${className}`} {...props} />
}
