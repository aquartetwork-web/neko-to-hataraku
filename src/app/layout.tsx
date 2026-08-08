import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/dotgothic16/400.css";

import { APP_CONFIG } from "@/config/app";
import { WORK_TIMER_BROWSER_SCRIPT } from "@/lib/work-timer/browser-clock";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: APP_CONFIG.name,
  title: {
    default: APP_CONFIG.name,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_CONFIG.shortName,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: APP_CONFIG.themeColor,
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: WORK_TIMER_BROWSER_SCRIPT }} />
      </body>
    </html>
  );
}
