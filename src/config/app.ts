export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "ねことはたらく",
  shortName: "ねこ労働",
  description: "猫と一緒に、今日の仕事を始め、記録し、振り返るアプリ。",
  timezone: "Asia/Tokyo",
  themeColor: "#0c6170",
  backgroundColor: "#f3fbfd",
} as const;
