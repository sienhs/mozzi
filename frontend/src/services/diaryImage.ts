import { Platform, Share } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library/legacy';
import { formatDate } from '@/constants/date';
import type { DiaryEntry } from '@/types/diary';

// 그림일기 그림을 기기에 내려받아 사진 앱에 저장하거나 다른 앱으로 보낸다.
// 그림은 서버가 주는 공개 주소라 같은 날짜 파일은 덮어쓴다(캐시 폴더, 시스템이 알아서 비운다).
const types = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
} as const;
type Extension = keyof typeof types;

function extensionOf(url: string): Extension {
  const match = /\.(png|jpe?g|webp)(?:$|[?#])/i.exec(url);
  const ext = match?.[1].toLowerCase();
  return ext === 'jpeg' || ext === 'jpg'
    ? 'jpg'
    : ext === 'webp'
      ? 'webp'
      : 'png';
}

async function download(url: string, date: string) {
  const ext = extensionOf(url);
  const folder = new Directory(Paths.cache, 'diary-image');
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, `mozzi-${date}.${ext}`);
  const file = await File.downloadFileAsync(url, target, { idempotent: true });
  return { uri: file.uri, type: types[ext] };
}

export type SaveResult = 'saved' | 'denied' | 'blocked' | 'failed';
// Android 13 이상은 권한 없이 저장한다. 그 아래는 저장 권한을 한 번 묻는다.
export async function saveDiaryImage(
  url: string,
  date: string,
): Promise<SaveResult> {
  try {
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted)
      return permission.canAskAgain ? 'denied' : 'blocked';
    const { uri } = await download(url, date);
    await MediaLibrary.saveToLibraryAsync(uri);
    return 'saved';
  } catch {
    return 'failed';
  }
}

const shareText = (entry: DiaryEntry) =>
  `${formatDate(entry.date)} 모찌 그림일기\n${entry.memo || entry.title}`;

// 그림이 있으면 그림 파일을 보낸다. 그림이 없거나(그리지 않은 날) 파일 공유가 안 되는 곳은 글로 보낸다.
export async function shareDiary(entry: DiaryEntry): Promise<boolean> {
  const url = entry.generation === 'ready' ? entry.imageUrl : null;
  try {
    if (url && Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
      const { uri, type } = await download(url, entry.date);
      await Sharing.shareAsync(uri, {
        mimeType: type,
        dialogTitle: '그림일기 공유',
      });
      return true;
    }
    await Share.share(
      { message: shareText(entry) },
      { dialogTitle: '그림일기 공유' },
    );
    return true;
  } catch {
    return false;
  }
}
