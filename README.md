# 会議室予約アプリ

GeonicDB (NGSI-LD Context Broker) をバックエンドにした会議室予約アプリ。
フロントは React + Vite + TypeScript、データアクセスは `@geolonia/geonicdb-sdk`。

- テナント: `ohashi`
- 予約可能時間: 09:00–21:00 / 30分単位
- 会議室: 5部屋（A・B は定員 20名、C・D・E は定員 6名）

## 公開先

GitHub Pages: https://naogify.github.io/meeting-room-app/

`main` への push で `.github/workflows/deploy.yml` が走り、`dist` が Pages へ配信される。
Pages 配信のため本番ビルドのベースパスは `/meeting-room-app/`（`vite.config.ts`）。
接続先は `.env.production` に入っている（いずれも非機密の公開設定）。

ログインには GeonicDB テナント `ohashi` のアカウントが必要。アカウントを持たない
訪問者はログイン画面から先に進めない。

## セットアップ

```bash
npm install
cp .env.example .env.local   # 既定値のままで動く
npm run dev                  # http://localhost:5173
```

| 環境変数 | 既定値 | 説明 |
| --- | --- | --- |
| `VITE_GEONICDB_URL` | `https://geonicdb.geolonia.com/` | GeonicDB のベース URL |
| `VITE_GEONICDB_TENANT` | `ohashi` | テナント名 |

## サーバー側の構成（`geonic` CLI で作成済み）

### データモデル

`geonic custom-data-models list` で確認できる。

**MeetingRoom** — 予約対象の会議室

| プロパティ | 型 | 例 |
| --- | --- | --- |
| `roomId` | string | `A` |
| `name` | string | `会議室A` |
| `capacity` | number | `20` |
| `floor` | string | `3F` |
| `note` | string | `大会議室・プロジェクタ/TV会議あり` |

`roomId` に `unique-room-id` 制約。

**RoomReservation** — 予約（30分スロット 1件 = エンティティ 1件）

| プロパティ | 型 | 例 |
| --- | --- | --- |
| `bookingId` | string | `b-1a2b3c` |
| `room` | string | `A` |
| `date` | string | `2026-08-20` |
| `startTime` | string | `10:00` |
| `endTime` | string | `10:30` |
| `title` | string | `定例MTG` |
| `organizer` | string | `ohashi@example.com` |
| `organizerName` | string | `大橋直記` |
| `attendees` | number | `8` |

`(room, date, startTime)` に `no-double-booking` 複合ユニーク制約。

### なぜ「30分スロット 1件 = エンティティ 1件」なのか

二重予約の防止をサーバー側の複合ユニーク制約に任せるため。

1件の予約を `startTime`/`endTime` を持つ 1エンティティで表すと、ユニーク制約は
「同じ開始時刻」しか弾けない。10:00–11:00 の予約がある状態で 10:30–11:30 の予約が
通ってしまう。30分ごとに 1エンティティへ分解すれば、重複する区間は必ず同じ
`(room, date, startTime)` を踏むので、制約が予約区間の全体をカバーする。

同一予約のスロットは `bookingId` で束ねてあり、UI 側（`fetchBookings`）で 1ブロックに
畳み直して表示・キャンセルする。

### 会議室データの投入

```bash
geonic entities list --type MeetingRoom -f table
```

再投入したい場合は `rooms.ndjson` を用意して:

```bash
geonic import rooms.ndjson
```

## ハマりどころ: ベース URL の末尾スラッシュ

SDK は `baseUrl` にパスをそのまま連結する（末尾スラッシュを正規化しない）。
`VITE_GEONICDB_URL` に `https://geonicdb.geolonia.com/` のように末尾スラッシュを
付けると、実際のリクエストは `//auth/login` になる。

このパスはサーバー側で認証免除プレフィックスの外に落ちるため、XACML の評価対象になり
`403 Access denied: no applicable policy` が返る。**認証情報は正しいのに権限エラーに
見える**ので紛らわしい。

```
POST /auth/login   → 401 Invalid email or password   (ハンドラに到達している)
POST //auth/login  → 403 Access denied: no applicable policy
```

`src/geonic.ts` の `normalizeBaseUrl()` で末尾スラッシュを落としているため、
`.env.local` にどちらの形式を書いても動く。

なお、ログイン直後に `POST /auth/dpop-bind` が **401 を返すのは正常**。
RFC 9449 §8 の `use_dpop_nonce` ハンドシェイクで、SDK が `DPoP-Nonce` を受け取って
自動で再送し、DPoP sender-constrained セッションを確立する。ブラウザの
コンソールに 401 が 1件出るが、エラーではない。

## ユーザーの追加

```bash
geonic admin users create '{
  "email": "someone@example.com",
  "password": "<パスワード>",
  "role": "user",
  "primaryTenantId": "fc402f66-fc2e-43b0-899f-75e127f8c255"
}'
```

一時パスワードを発行して初回ログイン時に変更させる場合は `--force-reset` を付ける
(`password` は省略する)。

## 実装メモ

| ファイル | 役割 |
| --- | --- |
| `src/geonic.ts` | SDK インスタンス（アプリ全体で 1つを共有） |
| `src/auth.ts` | ログイン / セッション復元 / ログアウト |
| `src/api.ts` | 会議室・予約の取得、予約作成（ロールバック付き）、キャンセル |
| `src/slots.ts` | 30分スロットと時刻・日付の変換 |
| `src/components/Timetable.tsx` | 会議室 × 時間のグリッド |
| `src/components/BookingDialog.tsx` | 予約フォーム（定員バリデーション） |

- **セッション維持**: `login(..., { rememberSession: true })` で IndexedDB に永続化し、
  起動時に `restoreSession()` で復元する。DPoP 鍵は `extractable: false` のまま保存される。
- **予約作成の部分失敗**: NGSI-LD のバッチ作成はトランザクションではないので、
  同時予約で一部スロットを取られた場合は作成できたスロットを削除してから
  `SlotTakenError` を投げる。失敗した試行が区間を占有したままにならないようにするため。
- **リアルタイム更新**: WebSocket (`db.subscribe` + `db.connect`) で `RoomReservation` の
  変更を購読し再取得する。切断時の保険として 30秒間隔のポーリングも併用。
- **定員**: 予約フォームで会議室の `capacity` を上限として検証する
  （A・B は 20名、C・D・E は 6名）。
- **キャンセル権限**: 予約の `organizer` がログイン中のユーザーと一致する場合のみ可能。
