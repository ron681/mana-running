// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMeetDate(dateString: string): string {
  // Handle YYYY-MM-DD format from database
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function formatMeetDateShort(dateString: string): string {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Invalid Date'
  
  const days = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.']
  const dayName = days[date.getDay()]
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()
  
  return `${dayName} ${month}/${day}/${year}`
}



export function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  
  // Your database stores actual centiseconds as "seconds"
  // So we need to treat the input as centiseconds for formatting
  const totalSeconds = Math.floor(seconds / 100)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  const hundredths = Math.round(seconds % 100);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`
}


export function parseTime(timeString: string): number | null {
  if (!timeString || timeString.trim() === '') return null
  
  // Remove any whitespace and convert to lowercase
  const cleanTime = timeString.trim().toLowerCase()
  
  // Handle common non-time values
  if (['dnf', 'dns', 'dq', '--:--', ''].includes(cleanTime)) {
    return null
  }
  
  // Match patterns like 15:23.45, 15:23, 1:15:23.45, etc.
  const timePattern = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?$/
  const match = cleanTime.match(timePattern)
  
  if (!match) return null
  
  const [, hours, minutes, seconds, hundredths] = match
  
  let totalCentiseconds = 0
  totalCentiseconds += (hours ? parseInt(hours) * 3600 : 0) * 100
  totalCentiseconds += parseInt(minutes) * 60 * 100
  totalCentiseconds += parseInt(seconds) * 100
  totalCentiseconds += hundredths ? parseInt(hundredths.padEnd(2, '0')) : 0
  
  return totalCentiseconds
}