/**
 * 초기 제공 카드 이미지 — 프로젝트의 로컬 이미지 폴더에서 불러옵니다.
 *
 * 📁 src/assets/cards/ 폴더에 카드 사진(JPG, JPEG, PNG, WEBP)을 넣으면
 *    빌드/개발 서버 실행 시 자동으로 카드 목록에 추가됩니다.
 *
 * 파일명 규칙(선택): "카드번호_카드이름.jpg" → 번호와 이름이 자동 입력됩니다.
 *   예) "AE01-001_반짝이는 리본 코디.jpg"
 * 규칙을 따르지 않으면 파일명 전체가 카드 이름이 됩니다.
 */
const modules = import.meta.glob<string>(
  '/src/assets/cards/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP}',
  { eager: true, query: '?url', import: 'default' },
);

export interface LocalCardFile {
  file: string;
  url: string;
}

export const localCardFiles: LocalCardFile[] = Object.entries(modules)
  .map(([path, url]) => ({ file: decodeURIComponent(path.split('/').pop() ?? path), url }))
  .sort((a, b) => a.file.localeCompare(b.file, 'ko', { numeric: true }));

export const localCardUrlByFile = new Map(localCardFiles.map((f) => [f.file, f.url]));
