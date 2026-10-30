// Date math on "YYYY-MM-DD" days, as the database gives them. Shared by
// Vitest and Playwright to tell which days the app should show

export function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The same day `months` later, or the last day of a shorter month
export function addMonths(day: string, months: number) {
  const [year, month, date] = day.split("-").map(Number);
  const lastDate = new Date(Date.UTC(year, month + months, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(date, lastDate)))
    .toISOString()
    .slice(0, 10);
}
