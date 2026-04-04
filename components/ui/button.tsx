import * as React from "react"
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg"
}
export function Button({ className = "", variant = "default", size = "default", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none"
  const variants: Record<string, string> = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    outline: "border border-gray-600 text-gray-200 hover:bg-gray-700",
    ghost: "text-gray-300 hover:bg-gray-700",
    destructive: "bg-red-600 text-white hover:bg-red-700",
  }
  const sizes: Record<string, string> = {
    default: "h-10 py-2 px-4 text-sm",
    sm: "h-8 px-3 text-xs",
    lg: "h-12 px-6 text-base",
  }
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
}
