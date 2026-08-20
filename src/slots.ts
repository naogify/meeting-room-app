/** Bookable window: 09:00–21:00 in 30-minute slots. */
export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 21;
export const SLOT_MINUTES = 30;
export const SLOT_COUNT = ((CLOSE_HOUR - OPEN_HOUR) * 60) / SLOT_MINUTES;

/** "10:00" for slot index 2. */
export function slotStart(index: number): string {
  const total = OPEN_HOUR * 60 + index * SLOT_MINUTES;
  return format(total);
}

/** "10:30" for slot index 2 — the exclusive end of that single slot. */
export function slotEnd(index: number): string {
  return format(OPEN_HOUR * 60 + (index + 1) * SLOT_MINUTES);
}

/** Inverse of slotStart. Returns -1 when the time is not on the grid. */
export function slotIndex(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  const offset = h * 60 + m - OPEN_HOUR * 60;
  if (offset < 0 || offset % SLOT_MINUTES !== 0) return -1;
  const index = offset / SLOT_MINUTES;
  return index < SLOT_COUNT ? index : -1;
}

function format(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function allSlotIndices(): number[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => i);
}

/** Local-time YYYY-MM-DD. Avoids the UTC shift that toISOString() would add. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${y}年${m}月${d}日(${wd})`;
}
