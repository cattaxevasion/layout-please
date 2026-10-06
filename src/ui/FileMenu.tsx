import { useEffect, useRef, useState } from 'preact/hooks';
import { buildShareUrl, shareSizeLevel, SHARE_WARN_LENGTH } from '../logic/share';
import { getActiveLayout } from '../model/ops';
import { actions, store, useApp } from '../store';
import { exportJson, importJson, resetHouseToSample, resetToSample } from './fileActions';

export function FileMenu() {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div class="menu" ref={ref}>
      <button class={open ? 'active' : ''} onClick={() => setOpen(!open)}>
        파일 ▾
      </button>
      {open && (
        <div class="menu-list">
          <button
            onClick={run(() => {
              const d = store.getState().history.present;
              setShare(buildShareUrl(location.origin + location.pathname, d.house, getActiveLayout(d)));
            })}
          >
            공유 링크 만들기
          </button>
          <button onClick={run(() => exportJson())}>JSON 내보내기</button>
          <button onClick={run(importJson)}>JSON 불러오기</button>
          <hr />
          <button onClick={run(resetHouseToSample)}>집 구조만 최신 샘플로</button>
          <button class="danger" onClick={run(resetToSample)}>
            처음 샘플로 초기화
          </button>
        </div>
      )}
      {share && <ShareDialog url={share} onClose={() => setShare(null)} />}
    </div>
  );
}

function ShareDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const layoutName = useApp((s) => getActiveLayout(s.history.present).name);
  const level = shareSizeLevel(url);
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // 클립보드 권한이 없으면 선택만 해 두고 직접 복사하게 한다
      textRef.current?.select();
      actions.notify('Ctrl+C로 복사해 주세요.');
    }
  }

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" role="dialog" aria-label="공유 링크">
        <h3>공유 링크 — {layoutName}</h3>
        <p class="hint">
          집 구조와 지금 보고 있는 배치안이 링크 안에 들어 있습니다. 서버에 올라가지 않으며, 링크를 연 사람은 열람만 하고 원하면
          자기 저장소로 가져갈 수 있습니다.
        </p>
        <textarea ref={textRef} readOnly rows={4} value={url} onFocus={(e) => e.currentTarget.select()} />
        <p class={`share-size ${level}`}>
          링크 길이 {url.length.toLocaleString()}자
          {level === 'warn' && ` — ${SHARE_WARN_LENGTH.toLocaleString()}자를 넘어서 일부 메신저나 게시판에서 잘릴 수 있습니다.`}
          {level === 'danger' && ' — 너무 길어서 열리지 않을 수 있습니다. JSON 내보내기로 파일을 보내는 것을 권장합니다.'}
        </p>
        <div class="modal-actions">
          <button class="primary" onClick={copy}>
            {copied ? '복사했습니다 ✓' : '링크 복사'}
          </button>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
