import { useState } from 'react';
import { login } from '../auth';
import type { CurrentUser } from '../types';

interface Props {
  onSignedIn: (user: CurrentUser) => void;
}

function describe(err: unknown): string {
  const status = (err as { statusCode?: number } | null)?.statusCode;
  if (status === 401) return 'メールアドレスまたはパスワードが正しくありません。';
  if (status === 429) return 'ログインの試行が多すぎます。少し待ってからやり直してください。';
  if (err instanceof Error && err.message) return `ログインできませんでした: ${err.message}`;
  return 'ログインできませんでした。';
}

export function Login({ onSignedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await login(email, password));
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <h1>会議室予約</h1>
        <p className="muted">GeonicDB のアカウントでログインしてください。</p>

        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={busy || !email || !password}>
          {busy ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
    </div>
  );
}
