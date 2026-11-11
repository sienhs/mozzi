// 모찌 돌보기의 공통 타입과 규칙. 보상 지급은 서버(POST /rewards/care)가 정한다.
export type Rect = { x: number; y: number; width: number; height: number };
// 알파 경계를 가로로 나눈 띠마다 보이는 픽셀의 [왼쪽, 오른쪽 + 1]. 빈 띠는 null.
export type SilhouetteProfile = readonly (readonly [number, number] | null)[];
export type RasterGeometry = {
  width: number;
  height: number;
  bounds?: Rect;
  profile?: SilhouetteProfile;
};
export type CareAction = 'pet' | 'feed' | 'play';
export type MotionPhase = 'idle' | 'pet' | 'feed' | 'play' | 'reward';
export type CareProgress = {
  durationMs: number;
  distancePx: number;
  moveCount: number;
};

// 화면 안내용 값. 실제 지급 장수는 서버 응답을 따른다(backend docs/api/gacha.md "돌보기 보상").
export const CARE_POLICY = {
  pet: { tickets: 5, durationMs: 1600, distancePx: 130, moves: 6 },
  feed: { tickets: 5 },
  play: { tickets: 10, targetHits: 3 },
} as const;

// 톡 치기, 가만히 누르기, 아주 짧은 문지르기로는 채워지지 않는다.
export function petProgress(progress: CareProgress): number {
  return Math.max(
    0,
    Math.min(
      1,
      progress.durationMs / CARE_POLICY.pet.durationMs,
      progress.distancePx / CARE_POLICY.pet.distancePx,
      progress.moveCount / CARE_POLICY.pet.moves,
    ),
  );
}
