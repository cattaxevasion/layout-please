import { useEffect } from 'preact/hooks';
import { actions, useApp } from '../store';
import { closeShare, importShare } from './fileActions';

/** 공유 링크로 열었을 때 맨 위에 보이는 안내 */
export function ShareBanner() {
  const readOnly = useApp((s) => s.ui.readOnly);
  const name = useApp((s) => s.history.present.layouts[0]?.name);
  if (!readOnly) return null;
  return (
    <div class="share-banner">
      <span>
        공유받은 배치안 <strong>'{name}'</strong>을(를) 보고 있습니다 (열람 전용).
      </span>
      <div class="share-banner-actions">
        <button class="primary" onClick={importShare}>
          내 저장소로 가져오기
        </button>
        <button onClick={closeShare}>닫고 내 배치로</button>
      </div>
    </div>
  );
}

/** 화면 아래 잠깐 뜨는 안내 문구 */
export function Toast() {
  const notice = useApp((s) => s.ui.notice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => actions.notify(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  if (!notice) return null;
  return (
    <div class="toast" role="status" onClick={() => actions.notify(null)}>
      {notice}
    </div>
  );
}
