export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function formatMs(ms: number): string {
  return formatMinutes(ms / 60000);
}

export function minuteToTime(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function daysSummary(mask: number): string {
  if (mask === 0) return 'No days';
  if (mask === 0b1111111) return 'Every day';
  if (mask === 0b0111110) return 'Weekdays';
  if (mask === 0b1000001) return 'Weekends';
  return [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => mask & (1 << d))
    .map((d) => DAY_NAMES[d])
    .join(', ');
}

export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfDayNDaysAgo(n: number): number {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
