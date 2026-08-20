import type { Booking, Room } from '../types';
import { SLOT_COUNT, allSlotIndices, slotStart } from '../slots';

interface Props {
  rooms: Room[];
  bookings: Booking[];
  currentUserEmail: string;
  onPickSlot: (room: Room, startIndex: number, maxSlots: number) => void;
  onPickBooking: (booking: Booking) => void;
}

/** occupancy[roomId][slotIndex] — the booking covering that cell, if any. */
function buildOccupancy(rooms: Room[], bookings: Booking[]) {
  const map = new Map<string, (Booking | undefined)[]>();
  for (const room of rooms) map.set(room.roomId, new Array(SLOT_COUNT).fill(undefined));
  for (const booking of bookings) {
    const column = map.get(booking.room);
    if (!column) continue;
    for (let i = 0; i < booking.slotCount; i++) {
      const index = booking.startIndex + i;
      if (index < SLOT_COUNT) column[index] = booking;
    }
  }
  return map;
}

export function Timetable({ rooms, bookings, currentUserEmail, onPickSlot, onPickBooking }: Props) {
  const occupancy = buildOccupancy(rooms, bookings);
  const slots = allSlotIndices();

  /** Consecutive free slots starting at index — caps how long a new booking can run. */
  function freeRun(roomId: string, startIndex: number): number {
    const column = occupancy.get(roomId);
    if (!column) return 0;
    let n = 0;
    while (startIndex + n < SLOT_COUNT && !column[startIndex + n]) n++;
    return n;
  }

  return (
    <div className="timetable-scroll">
      <div
        className="timetable"
        style={{ gridTemplateColumns: `var(--gutter) repeat(${rooms.length}, minmax(9rem, 1fr))` }}
      >
        <div className="th corner" />
        {rooms.map((room) => (
          <div key={room.roomId} className="th">
            <span className="room-name">{room.name}</span>
            <span className="room-meta">
              {room.floor}・{room.capacity}名
            </span>
          </div>
        ))}

        {slots.map((index) => (
          <div key={`time-${index}`} className="time-label" style={{ gridRow: index + 2 }}>
            {index % 2 === 0 ? slotStart(index) : ''}
          </div>
        ))}

        {rooms.map((room, column) =>
          slots.map((index) => {
            const booking = occupancy.get(room.roomId)?.[index];
            if (booking) {
              // Render the block once, on the slot where it starts.
              if (booking.startIndex !== index) return null;
              const mine = booking.organizer === currentUserEmail;
              return (
                <button
                  key={`${room.roomId}-${index}`}
                  type="button"
                  className={`booking ${mine ? 'mine' : 'others'}`}
                  style={{
                    gridColumn: column + 2,
                    gridRow: `${index + 2} / span ${booking.slotCount}`,
                  }}
                  onClick={() => onPickBooking(booking)}
                  title={`${booking.startTime}–${booking.endTime} ${booking.title} / ${booking.organizerName}`}
                >
                  <span className="booking-time">
                    {booking.startTime}–{booking.endTime}
                  </span>
                  <span className="booking-title">{booking.title}</span>
                  <span className="booking-who">
                    {booking.organizerName}・{booking.attendees}名
                  </span>
                </button>
              );
            }

            const run = freeRun(room.roomId, index);
            return (
              <button
                key={`${room.roomId}-${index}`}
                type="button"
                className={`slot ${index % 2 === 0 ? 'hour-start' : ''}`}
                style={{ gridColumn: column + 2, gridRow: index + 2 }}
                onClick={() => onPickSlot(room, index, run)}
                aria-label={`${room.name} ${slotStart(index)} を予約`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
