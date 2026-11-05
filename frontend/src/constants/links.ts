import * as Linking from 'expo-linking';

// 원스토어 상세 페이지. 원스토어 앱이 있으면 앱으로, 없으면 모바일 웹으로 열린다.
export const ONESTORE_URL = 'https://onesto.re/0001011793';
// 사용자 의견 설문(구글 폼).
export const FEEDBACK_URL = 'https://forms.gle/oqMwyWtbtD1s5QRE6';

// 바깥 링크를 연다. 열지 못하면 false.
export async function openLink(url: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
