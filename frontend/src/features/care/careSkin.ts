import type { ImageSource } from 'expo-image';
import { cardThumbUrl } from '@/components/gacha/CardImage';
import { DEFAULT_COMPANION_NAME } from '@/constants/companions';
import { emotions } from '@/constants/emotions';
import type { Companion } from '@/types/companion';
import type { Emotion } from '@/types/diary';
import { careExpressionSources, careShapes } from './careAssets.generated';
import type {
  ExpressionClip,
  ExpressionId,
  SkinExpressionSet,
} from './careExpressions';
import type { RasterGeometry, Rect } from './careModel';

// [aspect, x, y, width, height, ...24 × (left, right)] — 이미지의 1/1000 단위(x는 너비, y는 높이 기준).
export type CareShapeRow = readonly number[];
// 0..1 좌표의 표정 레이어(assets/care/<key>/manifest.json에서 생성).
export type CareExpressionSource = {
  mouth: Rect;
  layers: readonly {
    id: string;
    source: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  expressions: Partial<Record<ExpressionId, ExpressionClip>>;
};

export type CareSkin = {
  // 카드 이미지 파일명(GACHA/<key>.png) 또는 basic-<emotion>.
  key: string;
  name: string;
  source: ImageSource | number;
  // 썸네일을 받지 못했을 때 쓰는 원본.
  fallbackSource?: ImageSource;
  geometry: RasterGeometry;
  expressions: SkinExpressionSet | null;
};

const UNIT = 1000;
const BASIC = /\/basic\/(happy|calm|neutral|sad|angry)\.png(?:[?#].*)?$/i;
const CARD = /\/GACHA\/(?:thumb\/)?([^/?#]+)\.(?:png|webp)(?:[?#].*)?$/i;

// 카드 그림 주소의 파일명이 돌보기 에셋의 키다.
export function careKeyFromUrl(url: string): string | null {
  const basic = BASIC.exec(url);
  if (basic) return `basic-${basic[1]!.toLowerCase()}`;
  return CARD.exec(url)?.[1] ?? null;
}

function canvasOf(row: CareShapeRow) {
  const aspect = row[0]! > 0 ? row[0]! : 1;
  return { width: UNIT, height: UNIT / aspect };
}

function geometryOf(row: CareShapeRow): RasterGeometry {
  const canvas = canvasOf(row);
  const sy = canvas.height / UNIT;
  const profile: ([number, number] | null)[] = [];
  for (let i = 5; i + 1 < row.length; i += 2)
    profile.push(row[i]! < 0 ? null : [row[i]!, row[i + 1]!]);
  return {
    ...canvas,
    bounds: {
      x: row[1]!,
      y: row[2]! * sy,
      width: row[3]!,
      height: row[4]! * sy,
    },
    profile,
  };
}

// 표에 없는 새 카드: 카드들의 중앙값 경계를 쓴다(실루엣 프로필은 없어 사각형으로 접촉한다).
let typical: RasterGeometry | null = null;
function typicalGeometry(): RasterGeometry {
  if (typical) return typical;
  const rows = Object.entries(careShapes)
    .filter(([key]) => !key.startsWith('basic-'))
    .map(([, row]) => row);
  const median = (index: number) => {
    const values = rows.map(row => row[index]!).sort((a, b) => a - b);
    return values.length
      ? values[Math.floor(values.length / 2)]!
      : [0, 80, 80, 840, 840][index]!;
  };
  typical = {
    width: UNIT,
    height: UNIT,
    bounds: { x: median(1), y: median(2), width: median(3), height: median(4) },
  };
  return typical;
}

function expressionsOf(
  key: string,
  geometry: RasterGeometry,
): SkinExpressionSet | null {
  const source = careExpressionSources[key];
  if (!source) return null;
  const { width, height } = geometry;
  const scale = (r: Rect) => ({
    x: r.x * width,
    y: r.y * height,
    width: r.width * width,
    height: r.height * height,
  });
  return {
    canvas: { width, height },
    anchors: { mouth: scale(source.mouth) },
    layers: source.layers.map(layer => ({ ...layer, ...scale(layer) })),
    expressions: source.expressions,
  };
}

function basicSkin(emotion: Emotion): CareSkin {
  const key = `basic-${emotion}`;
  const row = careShapes[key];
  const geometry = row ? geometryOf(row) : typicalGeometry();
  return {
    key,
    name: DEFAULT_COMPANION_NAME,
    source: emotions[emotion].source,
    geometry,
    expressions: expressionsOf(key, geometry),
  };
}

// 고른 모찌(카드)나, 고르지 않은 감정의 기본 모찌를 돌보기 화면용으로 바꾼다.
export function resolveCareSkin(
  companion: Pick<Companion, 'name' | 'imageUrl'> | null | undefined,
  emotion: Emotion,
): CareSkin {
  if (!companion?.imageUrl) return basicSkin(emotion);
  const key = careKeyFromUrl(companion.imageUrl);
  if (key?.startsWith('basic-'))
    return { ...basicSkin(key.slice(6) as Emotion), name: companion.name };
  const row = key ? careShapes[key] : undefined;
  const geometry = row ? geometryOf(row) : typicalGeometry();
  const thumb = cardThumbUrl(companion.imageUrl);
  return {
    key: key ?? companion.imageUrl,
    name: companion.name,
    source: { uri: thumb ?? companion.imageUrl },
    fallbackSource: thumb ? { uri: companion.imageUrl } : undefined,
    geometry,
    expressions: row && key ? expressionsOf(key, geometry) : null,
  };
}
