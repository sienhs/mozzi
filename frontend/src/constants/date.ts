export function todayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
// 서버는 오늘(서울)만 받고, 00~03시에는 전날도 받는다 (backend RecordDatePolicy).
// 전날 시작한 초안을 03시 이후에 보내면 오늘 기록으로 보낸다.
export const RECORD_GRACE_HOUR = 3;
export function allowedRecordDate(started: string | null, now = new Date()) {
  const today = todayKey(now);
  if (!started || started === today) return today;
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now),
  );
  const yesterday = todayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return started === yesterday && hour < RECORD_GRACE_HOUR ? started : today;
}
export function formatDate(key: string, weekday = true): string {
  const [year, month, day] = key.split('-').map(Number);
  const name = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(year, month - 1, day).getDay()
  ];
  return `${month}월 ${day}일${weekday ? ` ${name}요일` : ''}`;
}
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}
export function monthCells(year: number, month: number): (string | null)[] {
  const offset = new Date(year, month - 1, 1).getDay();
  const length = new Date(year, month, 0).getDate();
  return Array.from(
    { length: Math.ceil((offset + length) / 7) * 7 },
    (_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > length
        ? null
        : `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    },
  );
}
