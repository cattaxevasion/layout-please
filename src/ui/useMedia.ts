import { useEffect, useState } from 'preact/hooks';

/** 이 너비 이하에서는 열람 위주의 모바일 화면으로 바꾼다 */
export const MOBILE_QUERY = '(max-width: 768px)';

export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}
