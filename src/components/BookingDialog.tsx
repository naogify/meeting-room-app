import { useState } from 'react';
import type { Room } from '../types';
import { slotEnd, slotStart } from '../slots';

export interface BookingDraft {
  room: Room;
  date: string;
  startIndex: number;
  /** How many consecutive slots are free from startIndex — the booking cannot exceed this. */
  maxSlots: number;
}

interface Props {
  draft: BookingDraft;
  organizerName: string;
  onCancel: () => void;
  onSubmit: (values: { title: string; attendees: number; slotCount: number }) => Promise<void>;
}

export function BookingDialog({ draft, organizerName, onCancel, onSubmit }: Props) {
  const { room, startIndex, maxSlots } = draft;
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState(1);
  const [slotCount, setSlotCount] = useState(2 <= maxSlots ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const overCapacity = attendees > room.capacity;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (overCapacity) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), attendees, slotCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : '予約に失敗しました。');
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onMouseDown={onCancel}>
      <form className="card dialog" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <h2>予約する</h2>

        <dl className="summary">
          <div>
            <dt>会議室</dt>
            <dd>
              {room.name} <span className="muted">／ {room.floor}・定員 {room.capacity}名</span>
            </dd>
          </div>
          <div>
            <dt>日時</dt>
            <dd>
              {draft.date} {slotStart(startIndex)} – {slotEnd(startIndex + slotCount - 1)}
            </dd>
          </div>
          <div>
            <dt>予約者</dt>
            <dd>{organizerName}</dd>
          </div>
        </dl>

        <label>
          件名
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="定例MTG"
            maxLength={80}
            required
          />
        </label>

        <div className="row">
          <label>
            利用時間
            <select value={slotCount} onChange={(e) => setSlotCount(Number(e.target.value))}>
              {Array.from({ length: maxSlots }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n * 30}分（〜{slotEnd(startIndex + n - 1)}）
                </option>
              ))}
            </select>
          </label>

          <label>
            人数
            <input
              type="number"
              min={1}
              max={room.capacity}
              value={attendees}
              onChange={(e) => setAttendees(Number(e.target.value))}
              required
            />
          </label>
        </div>

        {overCapacity && (
          <p className="error">
            {room.name} の定員は {room.capacity}名です。人数を減らすか、より大きい会議室を選んでください。
          </p>
        )}
        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
            やめる
          </button>
          <button type="submit" disabled={busy || overCapacity || !title.trim()}>
            {busy ? '予約中…' : 'この内容で予約'}
          </button>
        </div>
      </form>
    </div>
  );
}
