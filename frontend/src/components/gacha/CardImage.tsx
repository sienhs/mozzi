import { useState } from 'react';
import { Image, type ImageProps } from 'expo-image';

// 카드 원본은 S3 `GACHA/<이름>.png`(1024px, 약 1.5MB)다. 같은 이름의 512px WebP 썸네일을
// `GACHA/thumb/<이름>.webp`(약 50KB)에 따로 올려 두었다. 규칙에 맞지 않는 주소는 썸네일이 없다.
export function cardThumbUrl(url: string): string | null {
  const match = /^(.*\/GACHA\/)([^/?#]+)\.png$/i.exec(url);
  return match ? `${match[1]}thumb/${match[2]}.webp` : null;
}

// 모찌 카드 그림. 작은 자리는 썸네일만 받고, 큰 자리(full)는 썸네일을 먼저 띄운 뒤 원본으로 바꾼다.
// 썸네일이 없으면(나중에 추가된 카드) 원본으로 돌아간다.
export function CardImage({
  uri,
  full = false,
  ...props
}: Omit<ImageProps, 'source' | 'placeholder'> & {
  uri: string;
  full?: boolean;
}) {
  const thumb = cardThumbUrl(uri);
  const [missing, setMissing] = useState<string | null>(null);
  const useThumb = !!thumb && missing !== thumb;
  return (
    <Image
      contentFit="contain"
      cachePolicy="memory-disk"
      {...props}
      source={{ uri: useThumb && !full ? thumb : uri }}
      placeholder={full && useThumb ? { uri: thumb } : undefined}
      placeholderContentFit={props.contentFit ?? 'contain'}
      onError={event => {
        if (useThumb && !full) setMissing(thumb);
        props.onError?.(event);
      }}
    />
  );
}

// 미리 받을 때도 화면이 실제로 쓰는 주소를 받는다.
export const cardImageUrls = (uri: string, full = false) => {
  const thumb = cardThumbUrl(uri);
  return full || !thumb ? [uri, ...(thumb ? [thumb] : [])] : [thumb];
};
