import { useEffect, useRef, useState } from 'preact/hooks';
import { formatCm } from '../logic/measure';

interface Props {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  disabled?: boolean;
}

/**
 * 숫자 입력칸. 타이핑하는 동안에는 반영하지 않고 Enter나 포커스 이동 때 한 번만 반영해서
 * Undo 기록이 한 글자마다 쌓이지 않게 한다. Esc는 입력 취소.
 */
export function NumberField({ label, value, onCommit, unit = 'cm', step = 1, min, disabled }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  /** 사용자가 실제로 타이핑했는지 (state보다 먼저 갱신되도록 ref로) */
  const dirty = useRef(false);

  // 바깥에서 값이 바뀌면(드래그 등) 편집 중이 아닐 때만 따라간다
  useEffect(() => {
    setDraft(null);
  }, [value]);

  // draft 상태가 아직 렌더링에 반영되지 않았을 수 있으므로 입력칸의 현재 값을 직접 읽는다
  function commit(el: HTMLInputElement) {
    setDraft(null);
    if (!dirty.current) return;
    dirty.current = false;
    if (el.value.trim() === '') return;
    const v = Number(el.value.replace(',', '.'));
    if (!Number.isFinite(v) || v === value) return;
    onCommit(min !== undefined ? Math.max(min, v) : v);
  }

  return (
    <label class="field">
      <span class="field-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        disabled={disabled}
        value={draft ?? formatCm(value)}
        onInput={(e) => {
          dirty.current = true;
          setDraft(e.currentTarget.value);
        }}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if (e.key === 'Enter') {
            el.blur(); // blur에서 commit
          } else if (e.key === 'Escape') {
            dirty.current = false;
            el.value = formatCm(value);
            el.blur();
          }
        }}
      />
      {unit && <span class="field-unit">{unit}</span>}
    </label>
  );
}
