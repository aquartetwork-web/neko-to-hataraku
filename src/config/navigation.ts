import type { LucideIcon } from "lucide-react";
import { CalendarDays, Cat, ClipboardList, Home, Settings } from "lucide-react";

export type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/week", label: "週", icon: Cat },
  { href: "/month", label: "月", icon: CalendarDays },
  { href: "/records", label: "記録", icon: ClipboardList },
  { href: "/settings", label: "設定", icon: Settings },
];
