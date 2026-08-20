import { db } from './geonic';
import type { Booking, ReservationSlot, Room } from './types';
import { slotEnd, slotIndex, slotStart } from './slots';

const ROOM_TYPE = 'MeetingRoom';
const RESERVATION_TYPE = 'RoomReservation';

/** `urn:ngsi-ld:RoomReservation:A-2026-08-20-1000` — one id per room+date+slot. */
function slotEntityId(room: string, date: string, start: string): string {
  return `urn:ngsi-ld:${RESERVATION_TYPE}:${room}-${date}-${start.replace(':', '')}`;
}

function prop(value: string | number) {
  return { type: 'Property', value };
}

export async function fetchRooms(): Promise<Room[]> {
  const raw = await db.getEntities({ type: ROOM_TYPE, options: 'keyValues', limit: 100 });
  return raw
    .map((r) => {
      const e = r as Record<string, unknown>;
      return {
        id: String(e.id ?? ''),
        roomId: String(e.roomId ?? ''),
        name: String(e.name ?? ''),
        capacity: Number(e.capacity ?? 0),
        floor: String(e.floor ?? ''),
        note: String(e.note ?? ''),
      };
    })
    .sort((a, b) => a.roomId.localeCompare(b.roomId));
}

async function fetchSlots(date: string): Promise<ReservationSlot[]> {
  const raw = await db.getEntities({
    type: RESERVATION_TYPE,
    q: `date=="${date}"`,
    options: 'keyValues',
    limit: 1000,
  });
  return raw.map((r) => {
    const e = r as Record<string, unknown>;
    return {
      id: String(e.id ?? ''),
      bookingId: String(e.bookingId ?? ''),
      room: String(e.room ?? ''),
      date: String(e.date ?? ''),
      startTime: String(e.startTime ?? ''),
      endTime: String(e.endTime ?? ''),
      title: String(e.title ?? ''),
      organizer: String(e.organizer ?? ''),
      organizerName: String(e.organizerName ?? ''),
      attendees: Number(e.attendees ?? 0),
    };
  });
}

/**
 * Collapse the per-slot entities of one booking back into a single block so the
 * timetable can render "10:00–11:30 定例MTG" as one cell instead of three.
 */
export async function fetchBookings(date: string): Promise<Booking[]> {
  const slots = await fetchSlots(date);
  const grouped = new Map<string, ReservationSlot[]>();
  for (const slot of slots) {
    const key = slot.bookingId || slot.id;
    const list = grouped.get(key);
    if (list) list.push(slot);
    else grouped.set(key, [slot]);
  }

  const bookings: Booking[] = [];
  for (const [bookingId, list] of grouped) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    const first = list[0];
    const startIndex = slotIndex(first.startTime);
    if (startIndex < 0) continue;
    bookings.push({
      bookingId,
      room: first.room,
      date: first.date,
      startTime: first.startTime,
      endTime: list[list.length - 1].endTime,
      title: first.title,
      organizer: first.organizer,
      organizerName: first.organizerName,
      attendees: first.attendees,
      slotIds: list.map((s) => s.id),
      startIndex,
      slotCount: list.length,
    });
  }
  return bookings.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export class SlotTakenError extends Error {
  constructor(message = 'その時間帯はすでに予約されています。') {
    super(message);
    this.name = 'SlotTakenError';
  }
}

export interface CreateBookingInput {
  room: string;
  date: string;
  startIndex: number;
  slotCount: number;
  title: string;
  attendees: number;
  organizer: string;
  organizerName: string;
}

/**
 * Create every slot of a booking.
 *
 * NGSI-LD batch create is not transactional, so a slot lost to a concurrent
 * booker leaves the rest of ours behind. We delete what we did manage to write
 * before surfacing the conflict, otherwise a failed attempt would silently
 * block the range for everyone.
 */
export async function createBooking(input: CreateBookingInput): Promise<void> {
  const bookingId = crypto.randomUUID();
  const entities = Array.from({ length: input.slotCount }, (_, i) => {
    const index = input.startIndex + i;
    const start = slotStart(index);
    return {
      id: slotEntityId(input.room, input.date, start),
      type: RESERVATION_TYPE,
      bookingId: prop(bookingId),
      room: prop(input.room),
      date: prop(input.date),
      startTime: prop(start),
      endTime: prop(slotEnd(index)),
      title: prop(input.title),
      organizer: prop(input.organizer),
      organizerName: prop(input.organizerName),
      attendees: prop(input.attendees),
    };
  });

  let result: unknown;
  try {
    result = await db.batchCreate(entities);
  } catch (err) {
    await rollback(entities.map((e) => e.id));
    if (isConflict(err)) throw new SlotTakenError();
    throw err;
  }

  // A 207 Multi-Status comes back as a normal resolution with an `errors` array,
  // so a partial failure has to be inspected rather than caught.
  const errors = extractErrors(result);
  if (errors.length > 0) {
    await rollback(entities.map((e) => e.id));
    throw new SlotTakenError();
  }
}

export async function cancelBooking(booking: Booking): Promise<void> {
  await db.batchDelete(booking.slotIds);
}

async function rollback(ids: string[]): Promise<void> {
  try {
    await db.batchDelete(ids);
  } catch {
    // Nothing better to do here: the ids we never created simply 404, and the
    // conflict we are about to report is the more useful error to surface.
  }
}

function isConflict(err: unknown): boolean {
  const status = (err as { statusCode?: number } | null)?.statusCode;
  return status === 409 || status === 422;
}

function extractErrors(result: unknown): unknown[] {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return [];
  const errors = (result as { errors?: unknown }).errors;
  return Array.isArray(errors) ? errors : [];
}
