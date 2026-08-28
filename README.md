# ねことはたらく

猫と一緒に今日の仕事を始め、勤務時間・ToDo・作業内容を記録して振り返る個人用Webアプリです。

初期版として、勤務タイマー、今日のToDo、作業カテゴリ、日別記録、週・月集計、目標・猫設定を実装しています。データの正はHosted Supabaseです。

## 必要環境

- Node.js 20.9以上（開発環境では24.13.0を使用）
- npm
- Hosted Supabaseプロジェクト
- 本番運用時はVercelを想定

Docker DesktopとローカルSupabaseは必須ではありません。

## 環境変数

`.env.example` を `.env.local` としてコピーし、Hosted Supabaseの値を設定します。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=ねことはたらく
```

`NEXT_PUBLIC_SITE_URL` はローカルでは省略可能です。省略時はリクエスト元のoriginを使います。本番ではVercelの環境ごとに設定してください。service role keyは使用しません。

NFC連携でもservice role keyは使用しません。PC側はpublishable keyと、
NFC勤怠操作だけに権限を限定したデバイストークンを使用します。トークン本体は
PCの`.env.nfc`だけに保存し、DBにはSHA-256ハッシュのみを登録します。

## 開発起動

PowerShellの実行ポリシーによって `npm.ps1` が止まる環境では、以下のように `.cmd` を明示します。

```powershell
npm.cmd install
npm.cmd run dev
```

ブラウザで `http://localhost:3000` を開きます。Supabase環境変数が未設定の場合は接続案内を表示し、勤務操作は行いません。

## Hosted Supabaseの準備

1. Supabase Dashboardでプロジェクトを作成します。
2. Project URLとpublishable keyを `.env.local` とVercelへ設定します。
3. CLIをHostedプロジェクトへ接続してmigrationを適用します。

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npm.cmd run db:push
```

4. Authentication > URL Configurationへ以下を追加します。
   - Site URL: 本番Vercel URL
   - Redirect URL: `http://localhost:3000/auth/confirm`
   - Redirect URL: `https://YOUR_APP.vercel.app/auth/confirm`
   - Preview Deploymentを使う場合は、必要なpreview URLも許可します。
5. Authentication > Usersで自分のユーザーを作成します。
6. アプリはSupabase標準のMagic Linkテンプレート（`ConfirmationURL`）とPKCE callbackを使用します。Email Templateの変更やCustom SMTPは必須ではありません。
7. 自分のユーザー作成後は、新規登録を無効にしておくことを推奨します。アプリ側も `shouldCreateUser: false` で未知のメールアドレスからユーザーを作成しません。

migrationは既存ユーザーも初期プロフィール・設定・カテゴリへ補完します。以後のユーザーにはDB triggerで同じ初期データを作成します。

Phase 2 migrationは、勤務開始・休憩・再開・退勤をPostgres Functionとして追加します。Phase 3 migrationは、ToDo／カテゴリからの勤務開始・切替とToDo並べ替えを追加します。複数レコードの更新は1トランザクションで行い、クライアントから勤務テーブルを直接変更する権限は外します。

## 勤務タイマー

- 状態は独立したstatusカラムへ保存せず、openな勤務セッションとwork/break segmentから導出します。
- 開始時刻・終了時刻はPostgreSQLのサーバー時刻を使用します。
- 画面はRPCが返すサーバー時刻から経過時間を進め、秒数をDBへ毎秒保存しません。
- ページ再読み込みや別端末からの表示時は、毎回Supabaseの状態を取得します。
- RealtimeはPhase 2では使っていません。同時に開いた別端末は再読み込みまたはページ再訪で更新されます。
- 18時間以上openな勤務セッションには退勤忘れの警告を表示します。終了時刻の修正UIは後続Phaseです。

### NFCからの出勤・退勤

`toggle_work_via_nfc` RPCは、登録済みのタグIDとデバイストークンを検証し、
openな勤務セッションがなければ出勤、あれば退勤を実行します。ブラウザ用RPCと
同じDB内部関数へ委譲するため、ロック、サーバー時刻、勤務区間の更新規則は共通です。

## Vercel

通常のNext.jsプロジェクトとしてリポジトリをImportできます。VercelのProduction / Preview / Development環境へ次を設定します。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_NAME`（任意）

本番の `NEXT_PUBLIC_SITE_URL` には末尾パスを付けず、例として `https://YOUR_APP.vercel.app` を指定します。

## 品質確認

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

DB関数のpgTAPテストはHosted Supabaseへlinkし、全migrationを適用した後に実行します。DockerやローカルSupabaseは不要です。テストはトランザクションをrollbackします。実データがある環境では、接続先とテスト内容を確認してから実行してください。

```powershell
npm.cmd run test:db:linked
```

DB型はHosted Supabaseへlinkした後、migration適用後に再生成できます。

```powershell
npm.cmd run db:types
```

## 日付と勤務セッション

- 日時はPostgreSQLの `timestamptz` で保持します。
- 勤務セッションは深夜を跨いでも分割しません。
- `work_date` は論理勤務日のラベルであり、集計の正にはしません。
- 日・週・月集計は、各作業区間・休憩区間とAsia/Tokyoの暦日境界との重なりを共通ロジックで計算します。
- 例として23:00〜翌01:00はセッション1件のまま、日次集計では各日に1時間ずつ分配します。

## 初期版に含まれないもの

- Realtimeによる自動反映
- 勤務・休憩区間の時刻修正（短い日別メモの編集は可能）
- 退勤忘れの終了時刻修正UI
- 通知、魚報酬、着せ替え、実績
- オフライン動作
