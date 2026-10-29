import Constants from 'expo-constants';
import { SEMVER } from '@/types/server';

export type UpdateRequirement = 'none' | 'recommended' | 'required';

// 설치 앱 버전. 이 프로젝트는 OTA 업데이트(expo-updates)를 쓰지 않아 빌드에 들어간 app.json version이
// Android versionName과 같다. 네이티브 값을 직접 읽으려면 expo-application(의존성 추가·재빌드 필요)이 대안이다.
export function installedAppVersion(): string | null {
  const version = Constants.expoConfig?.version?.trim();
  return version && SEMVER.test(version) ? version : null;
}

// 업데이트 받을 곳. 스토어 등록·배포 경로가 아직 정해지지 않아 기본값을 두지 않는다.
// 비어 있으면 안내만 하고 링크 버튼은 숨긴다 (frontend/.env.example 참고).
export function appUpdateUrl(): string | null {
  const value = process.env.EXPO_PUBLIC_APP_UPDATE_URL?.trim();
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

// major·minor·patch를 각각 숫자로 비교한다 (1.10.0 > 1.9.0).
export function compareVersions(a: string, b: string) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++)
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  return 0;
}

// 강제 업데이트를 먼저 확인한다. 설치 버전을 알 수 없으면 막지 않고 정상 진입한다(서버 판단 근거가 없다).
export function updateRequirement(
  installed: string | null,
  meta: { minSupportedVersion: string; latestVersion: string },
): UpdateRequirement {
  if (!installed || !SEMVER.test(installed)) return 'none';
  if (compareVersions(installed, meta.minSupportedVersion) < 0)
    return 'required';
  if (compareVersions(installed, meta.latestVersion) < 0) return 'recommended';
  return 'none';
}
