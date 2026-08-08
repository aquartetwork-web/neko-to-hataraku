import Image from "next/image";
import type { Metadata } from "next";

import { sendMagicLink } from "@/app/(auth)/login/actions";
import { APP_CONFIG } from "@/config/app";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "ログイン",
};

const ERROR_MESSAGES: Record<string, string> = {
  "not-configured": "Supabaseの環境変数がまだ設定されていません。",
  "invalid-email": "メールアドレスを確認してください。",
  "site-url": "認証後の戻り先URLを決定できませんでした。",
  "send-failed": "ログインメールを送信できませんでした。Supabaseの設定を確認してください。",
  "confirm-failed": "ログインリンクを確認できませんでした。もう一度送信してください。",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const sent = params.sent === "1";

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <header className="auth-card__header">
          <Image
            className="auth-card__icon"
            src="/icons/icon-192.png"
            width={88}
            height={88}
            alt="白猫のアイコン"
            priority
          />
          <h1>{APP_CONFIG.name}</h1>
          <p className="auth-card__lead">自分のメールへログインリンクを送ります。</p>
        </header>

        {sent ? (
          <p className="notice notice--success" role="status">
            ログインメールを送りました。同じ端末でリンクを開いてください。
          </p>
        ) : null}

        {errorCode ? (
          <p className="notice notice--error" role="alert">
            {ERROR_MESSAGES[errorCode] ?? "ログイン処理を完了できませんでした。"}
          </p>
        ) : null}

        {!configured ? (
          <p className="notice">
            Phase 1の画面確認は可能です。認証を有効にするには `.env.local`
            へHosted SupabaseのURLとpublishable keyを設定してください。
          </p>
        ) : null}

        <form action={sendMagicLink} className="auth-form">
          <label className="field-label">
            メールアドレス
            <input
              className="text-input"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
              disabled={!configured}
            />
          </label>
          <button className="primary-button" type="submit" disabled={!configured}>
            Magic Linkを送る
          </button>
        </form>
      </section>
    </main>
  );
}
