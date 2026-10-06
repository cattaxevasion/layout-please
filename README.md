# 가구 배치 시뮬레이터

집의 가구 배치를 실제로 옮기지 않고 가상으로 시험해 보는 정적 웹앱입니다. 2D 평면도와 3D 뷰가 같은 데이터를 보여 주므로, 어느 쪽에서 옮겨도 양쪽에 바로 반영됩니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173/layout-please/
npm test         # 단위 테스트 (Vitest)
npm run build    # dist/ 에 정적 파일 생성
```

## 기술 선택

- Vite + TypeScript + Preact(UI 패널) + three.js(3D, 기본 도형만 사용)
- **2D는 SVG**: 요소마다 클릭 판정과 이벤트가 바로 되고, 치수선·글자를 그리기 쉬우며, 팬/줌은 viewBox만 바꾸면 되기 때문입니다. 가구 수십 개 규모에서는 Canvas보다 성능 손해가 없습니다.
- 상태: 자체 store(`src/store`) + 스냅샷 Undo/Redo. 뷰는 store를 구독하고 `actions`만 호출합니다.

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `src/model` | 데이터 타입, 프리셋, 샘플 집, 문서 조작 순수 함수, 마이그레이션 |
| `src/geometry` | 벡터, 회전 사각형, 다각형, 반직선 (순수 함수) |
| `src/logic` | 스냅, 벽까지 거리, 벽 자동 생성, 문/창 위치 계산 (순수 함수) |
| `src/store` | store, Undo 기록, 액션, 셀렉터 |
| `src/view2d` | SVG 평면도 |
| `src/ui` | 툴바, 패널 |

모든 길이는 cm, 평면도 좌표는 x가 오른쪽·y가 아래, 회전은 시계방향(도)입니다.

## 배포

(g) 단계에서 GitHub Actions → GitHub Pages 절차를 정리합니다.
