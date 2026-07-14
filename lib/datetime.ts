// 날짜/시간은 항상 한국 표준시(서울)로 표시한다.
// 서버 컴포넌트는 Vercel(UTC)에서 렌더링되므로 timeZone을 명시하지 않으면 UTC로 표시된다.
const KST = "Asia/Seoul";

export function formatKstDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("ko-KR", { timeZone: KST });
}

export function formatKstDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("ko-KR", { timeZone: KST });
}
