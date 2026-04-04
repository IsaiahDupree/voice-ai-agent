import * as React from "react"
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "secondary" | "destructive"
}
export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-blue-600 text-white",
    outline: "border border-gray-500 text-gray-300",
    secondary: "bg-gray-700 text-gray-200",
    destructive: "bg-red-600 text-white",
  }
  return <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`} {...props} />
}
