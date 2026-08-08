import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BottomNavigation } from "@/components/layout/bottom-navigation";
import { APP_CONFIG } from "@/config/app";

type AppShellProps = {
  children: ReactNode;
  isConnected: boolean;
};

export function AppShell({ children, isConnected }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__inner">
        <header className="app-header">
          <Link className="app-brand" href="/" aria-label={`${APP_CONFIG.name} ホーム`}>
            <Image
              className="app-brand__icon"
              src="/icons/icon-192.png"
              width={44}
              height={44}
              alt="白猫のアイコン"
              priority
            />
            <p className="app-brand__name">{APP_CONFIG.name}</p>
          </Link>
          <span className={`connection-chip${isConnected ? "" : " connection-chip--setup"}`}>
            {isConnected ? "同期準備済み" : "接続設定待ち"}
          </span>
        </header>
        <main className="app-main">{children}</main>
      </div>
      <BottomNavigation />
    </div>
  );
}
