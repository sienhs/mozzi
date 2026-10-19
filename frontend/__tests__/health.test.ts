import { checkServerHealth } from '../src/shared/api/health';

const originalFetch = globalThis.fetch;
const mockedFetch = jest.fn();

beforeEach(() => {
  globalThis.fetch = mockedFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.resetAllMocks();
});

test('accepts the Spring Boot health response', async () => {
  mockedFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'UP' }),
  });

  await expect(checkServerHealth()).resolves.toBeUndefined();
  expect(mockedFetch).toHaveBeenCalledWith(
    expect.stringContaining('/actuator/health'),
    expect.objectContaining({ signal: expect.anything() }),
  );
});

test('rejects unavailable servers', async () => {
  mockedFetch.mockResolvedValue({ ok: false, status: 503 });

  await expect(checkServerHealth()).rejects.toThrow('503');
});

test('rejects a successful HTTP response with an invalid health payload', async () => {
  mockedFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'DOWN' }),
  });

  await expect(checkServerHealth()).rejects.toThrow(
    '서버가 아직 준비되지 않았어요.',
  );
});
