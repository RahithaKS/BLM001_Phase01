import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateTime(date: string | Date | null | undefined, options?: { dateOnly?: boolean; timeOnly?: boolean }): string {
  if (!date) {
    return '—';
  }
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return '—';
  }
  
  if (options?.dateOnly) {
    return d.toLocaleDateString();
  }
  
  if (options?.timeOnly) {
    return d.toLocaleTimeString();
  }
  
  return d.toLocaleString();
}
