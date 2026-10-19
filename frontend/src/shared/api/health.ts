import { appConfig } from '../config/appConfig';

export async function checkServerHealth(): Promise<void> {
  if (!appConfig.apiBaseUrl) {
    throw new Error('API 주소를 설정해 주세요.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    appConfig.requestTimeoutMs,
  );

  try {
    const response = await fetch(`${appConfig.apiBaseUrl}/actuator/health`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`서버 응답을 확인해 주세요. (${response.status})`);
    }

    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('status' in body) ||
      body.status !== 'UP'
    ) {
      throw new Error('서버가 아직 준비되지 않았어요.');
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        '연결 시간이 초과됐어요. 서버 실행 상태를 확인해 주세요.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
