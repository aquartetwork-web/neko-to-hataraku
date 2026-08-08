export type CatMessageKey =
  | "notWorking"
  | "started"
  | "working"
  | "resting"
  | "goalReached"
  | "clockedOut";

export const CAT_MESSAGES: Record<CatMessageKey, readonly string[]> = {
  notWorking: ["猫、労働の準備中です。"],
  started: ["猫、労働を開始しました。"],
  working: ["いい感じです。"],
  resting: ["そろそろ魚が必要です。"],
  goalReached: ["今日もよく働きました。"],
  clockedOut: ["本日の労働、おしまい。"],
};
