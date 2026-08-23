export function getJudgmentTimeBounds(now: Date, cohortStartDateStr: string) {
  // cohortStartDateStr is like "2026-08-01"
  // If we run at 2026-08-24 12:05 KST, we are judging records for 2026-08-23.
  const kstFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
  const kstTodayStr = kstFmt.format(now);
  
  // Parse KST Today to get yesterday's date
  const [y, m, d] = kstTodayStr.split("-").map(Number);
  const kstToday = new Date(Date.UTC(y, m - 1, d, 0, 0, 0)); // Treat as UTC just for day math
  const kstYesterday = new Date(kstToday.getTime() - 24 * 60 * 60 * 1000);
  
  const yesterdayStr = kstYesterday.toISOString().split("T")[0]; // e.g. "2026-08-23"
  
  // Calculate Day Number
  const [sy, sm, sd] = cohortStartDateStr.split("-").map(Number);
  const startDay = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0));
  const diffTime = kstYesterday.getTime() - startDay.getTime();
  const dayNumber = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  // Deadlines in UTC (which represent KST boundaries)
  // KST is UTC+9. So 23:59:59 KST = 14:59:59 UTC same day.
  // We'll construct the UTC string.
  
  // On-time deadline: yesterdayStr 23:59:59 KST -> yesterdayStr 14:59:59 UTC
  const onTimeDeadline = new Date(Date.UTC(kstYesterday.getUTCFullYear(), kstYesterday.getUTCMonth(), kstYesterday.getUTCDate(), 14, 59, 59));
  
  // Late deadline: todayStr 12:00:00 KST -> todayStr 03:00:00 UTC
  const lateDeadline = new Date(Date.UTC(kstToday.getUTCFullYear(), kstToday.getUTCMonth(), kstToday.getUTCDate(), 3, 0, 0));
  
  return {
    targetDateStr: yesterdayStr,
    dayNumber,
    onTimeDeadline,
    lateDeadline
  };
}

export function evaluateRecord(post: any, bounds: ReturnType<typeof getJudgmentTimeBounds>) {
  if (post.is_author_seed) {
    return { status: "failed", reason: "저자 시드 기록은 판정 제외" };
  }
  
  if (post.challenge_day_number !== bounds.dayNumber) {
    return { status: "failed", reason: `제출된 Day(${post.challenge_day_number})가 현재 일정(${bounds.dayNumber})과 다름` };
  }
  
  if (!post.body_text || post.body_text.trim().length < 30) {
    return { status: "failed", reason: "본문 길이 30자 미만" };
  }
  
  if (post.body_text.includes("만원") || post.body_text.includes("억") || post.body_text.includes("천원")) {
    return { status: "failed", reason: "금칙어(절대금액) 포함" };
  }
  
  const submittedAt = new Date(post.created_at);
  if (submittedAt > bounds.lateDeadline) {
    return { status: "failed", reason: "마감 시각 초과 (지각 인정 시간 초과)" };
  }
  
  if (submittedAt > bounds.onTimeDeadline) {
    return { status: "late", reason: null };
  }
  
  return { status: "on_time", reason: null };
}

// TODO: Replace with real MTA call when ready
export async function sendChallengeAlert(participant: any, alertType: "failed" | "warning_2_days", message: string) {
  console.log(`[ALERT] Would send email to ${participant.email}: type=${alertType}, msg=${message}`);
}
