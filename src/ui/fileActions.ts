// 파일·공유 관련 화면 동작 (다운로드, 파일 선택, 확인 창 등 브라우저 기능을 쓰는 부분).

import { DocError } from '../model/migrate';
import { createSampleDoc, createSampleHouse } from '../model/sample';
import type { ProjectDoc } from '../model/types';
import {
  cloneLayoutFresh,
  docFromShare,
  exportDocJson,
  exportFileName,
  importDocJson,
  mergeShareIntoDoc,
} from '../logic/serialize';
import { actions, sharedPayload, storage, store } from '../store';
import { loadDoc, saveDoc } from '../store/persistence';

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJson(doc: ProjectDoc = store.getState().history.present) {
  downloadText(exportFileName(), exportDocJson(doc));
}

export function importJson() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const doc = importDocJson(await file.text());
      if (!confirm(`'${file.name}'을(를) 불러와 지금 데이터를 바꿀까요?\n(되돌리기로 취소할 수 있습니다)`)) return;
      actions.replaceDoc(doc);
      actions.notify(`'${file.name}'을(를) 불러왔습니다.`);
    } catch (e) {
      actions.notify(e instanceof DocError ? e.message : '파일을 읽지 못했습니다.');
    }
  };
  input.click();
}

export function resetToSample() {
  if (!confirm('집 구조와 모든 배치안을 처음 샘플로 바꿀까요?\n(되돌리기로 취소할 수 있습니다)')) return;
  actions.replaceDoc(createSampleDoc());
}

/** 배치안과 내 프리셋은 그대로 두고 집 구조만 최신 샘플로 바꾼다 (샘플 집을 고친 뒤 반영할 때) */
export function resetHouseToSample() {
  if (!confirm('집 구조(방·벽·문·창·설비)만 최신 샘플로 바꿀까요?\n배치안과 가구는 그대로 둡니다. (되돌리기로 취소할 수 있습니다)')) {
    return;
  }
  const doc = store.getState().history.present;
  // 이전 버전에서 배치안마다 자동으로 넣었던 냉장고 가구(카운터 옆 기본 자리)는 붙박이와 겹치므로 뺀다
  const layouts = doc.layouts.map((l) => {
    const furniture = l.furniture.filter(
      (f) => !(f.presetId === 'my-fridge-microwave' && Math.abs(f.x - 30) < 1 && Math.abs(f.y - 199.8) < 1),
    );
    return furniture.length === l.furniture.length ? l : { ...l, furniture };
  });
  actions.replaceDoc({ ...doc, house: createSampleHouse(), layouts });
  actions.notify('집 구조를 최신 샘플로 바꿨습니다.');
}

/** 공유 링크 열람을 마치고 내 데이터로 돌아간다 */
function leaveShare(doc: ProjectDoc) {
  history.replaceState(null, '', location.pathname + location.search);
  actions.openDoc(doc);
  saveDoc(storage, doc);
}

export function closeShare() {
  leaveShare(loadDoc(storage).doc ?? createSampleDoc());
}

/**
 * 공유받은 배치안을 내 저장소로 가져온다.
 * - 저장된 데이터가 없으면 공유받은 집과 배치안으로 시작
 * - 집 구조가 같으면 배치안만 추가
 * - 다르면 확인 후 내 데이터를 JSON으로 백업하고 공유받은 집으로 교체 (사용자 프리셋은 유지)
 */
export function importShare() {
  const share = sharedPayload;
  if (!share) return;
  const mine = loadDoc(storage).doc;
  const fresh = () => {
    const layout = cloneLayoutFresh(share.layout);
    return { ...docFromShare({ ...share, layout }, mine?.userPresets ?? []) };
  };
  if (!mine) {
    leaveShare(fresh());
    actions.notify('공유받은 배치안을 내 저장소에 저장했습니다.');
    return;
  }
  const merged = mergeShareIntoDoc(mine, share);
  if (merged) {
    leaveShare(merged);
    actions.notify(`'${share.layout.name}' 배치안을 내 배치안 목록에 추가했습니다.`);
    return;
  }
  const ok = confirm(
    '이 링크의 집 구조가 내 저장된 집과 다릅니다.\n' +
      '내 저장소를 이 집으로 바꿀까요?\n\n' +
      '바꾸기 전에 지금 내 데이터를 JSON 파일로 내려받아 백업합니다.',
  );
  if (!ok) return;
  exportJson(mine);
  leaveShare(fresh());
  actions.notify('공유받은 집과 배치안으로 바꿨습니다. 이전 데이터는 JSON으로 백업했습니다.');
}
