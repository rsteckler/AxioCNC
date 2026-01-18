/**
 * Format time duration in milliseconds to human-readable string
 * @param milliseconds Time in milliseconds
 * @returns Formatted string like "1:23:45" (hours:minutes:seconds) or "23:45" (minutes:seconds)
 */
export function formatTime(milliseconds: number): string {
  if (milliseconds < 0) {
    return '0:00'
  }
  
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
