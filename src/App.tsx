import { useCallback, useEffect, useState } from 'react';
import { db } from './geonic';
import { logout, restore } from './auth';
import { cancelBooking, createBooking, fetchBookings, fetchRooms } from './api';
import { Login } from './components/Login';
import { Timetable } from './components/Timetable';
import { BookingDialog, type BookingDraft } from './components/BookingDialog';
import type { Booking, CurrentUser, Room } from './types';
import { addDays, formatDateLabel, toDateKey } from './slots';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Rehydrate a remembered session before deciding to show the login form.
  useEffect(() => {
    restore()
      .then(setUser)
      .finally(() => setBooting(false));
  }, []);

  const reloadBookings = useCallback(async () => {
    try {
      setBookings(await fetchBookings(date));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約の取得に失敗しました。');
    }
  }, [date]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    fetchRooms()
      .then((r) => {
        if (!cancelled) setRooms(r);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : '会議室の取得に失敗しました。'),
      )
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void reloadBookings();
  }, [user, reloadBookings]);

  // Live updates so two people booking at once see each other's changes.
  // The periodic refresh is the backstop for a dropped socket.
  useEffect(() => {
    if (!user) return;
    const onChange = () => void reloadBookings();
    db.on('entityCreated', onChange);
    db.on('entityUpdated', onChange);
    db.on('entityDeleted', onChange);
    db.subscribe({ entityTypes: ['RoomReservation'] });
    db.connect().catch(() => {
      // Realtime is optional; the interval below keeps the view fresh.
    });
    const timer = window.setInterval(onChange, 30_000);
    return () => {
      window.clearInterval(timer);
      db.off('entityCreated', onChange);
      db.off('entityUpdated', onChange);
      db.off('entityDeleted', onChange);
      db.disconnect();
    };
  }, [user, reloadBookings]);

  async function submitBooking(values: { title: string; attendees: number; slotCount: number }) {
    if (!draft || !user) return;
    await createBooking({
      room: draft.room.roomId,
      date: draft.date,
      startIndex: draft.startIndex,
      slotCount: values.slotCount,
      title: values.title,
      attendees: values.attendees,
      organizer: user.email,
      organizerName: user.name,
    });
    setDraft(null);
    await reloadBookings();
  }

  async function requestCancel(booking: Booking) {
    if (!user) return;
    if (booking.organizer !== user.email) {
      setError(`「${booking.title}」は ${booking.organizerName} さんの予約です。キャンセルできません。`);
      return;
    }
    if (!window.confirm(`${booking.startTime}–${booking.endTime}「${booking.title}」をキャンセルしますか？`)) {
      return;
    }
    try {
      await cancelBooking(booking);
      await reloadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'キャンセルに失敗しました。');
    }
  }

  async function signOut() {
    await logout();
    setUser(null);
    setBookings([]);
    setRooms([]);
  }

  if (booting) return <div className="boot">読み込み中…</div>;
  if (!user) return <Login onSignedIn={setUser} />;

  return (
    <div className="app">
      <header className="topbar">
        <h1>会議室予約</h1>
        <div className="spacer" />
        <span className="muted">{user.name} さん</span>
        <button type="button" className="ghost" onClick={() => void signOut()}>
          ログアウト
        </button>
      </header>

      <div className="datebar">
        <button type="button" className="ghost" onClick={() => setDate(addDays(date, -1))}>
          ← 前日
        </button>
        <strong className="date-label">{formatDateLabel(date)}</strong>
        <button type="button" className="ghost" onClick={() => setDate(addDays(date, 1))}>
          翌日 →
        </button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button type="button" className="ghost" onClick={() => setDate(toDateKey(new Date()))}>
          今日
        </button>
      </div>

      {error && (
        <p className="error banner" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      {loading && rooms.length === 0 ? (
        <p className="muted pad">会議室を読み込み中…</p>
      ) : (
        <Timetable
          rooms={rooms}
          bookings={bookings}
          currentUserEmail={user.email}
          onPickSlot={(room, startIndex, maxSlots) =>
            setDraft({ room, date, startIndex, maxSlots })
          }
          onPickBooking={(booking) => void requestCancel(booking)}
        />
      )}

      <footer className="legend">
        <span className="swatch mine" /> 自分の予約（クリックでキャンセル）
        <span className="swatch others" /> 他の人の予約
        <span className="swatch free" /> 空き（クリックで予約）
      </footer>

      {draft && (
        <BookingDialog
          draft={draft}
          organizerName={user.name}
          onCancel={() => setDraft(null)}
          onSubmit={submitBooking}
        />
      )}
    </div>
  );
}
