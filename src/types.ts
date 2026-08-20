export interface Room {
  id: string;
  roomId: string;
  name: string;
  capacity: number;
  floor: string;
  note: string;
}

/**
 * One reservation slot as stored in GeonicDB.
 *
 * A booking that spans more than 30 minutes is stored as several of these,
 * all sharing the same `bookingId`. The server-side `no-double-booking`
 * unique constraint on (room, date, startTime) is what actually prevents two
 * people from taking the same slot, so keeping one entity per slot is what
 * makes that guarantee cover the whole booking rather than just its start.
 */
export interface ReservationSlot {
  id: string;
  bookingId: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  organizer: string;
  organizerName: string;
  attendees: number;
}

/** Contiguous slots of one booking, collapsed back into a single block. */
export interface Booking {
  bookingId: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  organizer: string;
  organizerName: string;
  attendees: number;
  slotIds: string[];
  startIndex: number;
  slotCount: number;
}

export interface CurrentUser {
  email: string;
  name: string;
}
