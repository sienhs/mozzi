import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { checkServerHealth } from '../src/shared/api/health';

jest.mock('../src/shared/api/health', () => ({
  checkServerHealth: jest.fn(),
}));

const mockedCheckServerHealth = jest.mocked(checkServerHealth);

function findConnectionButton(app: ReactTestRenderer.ReactTestRenderer) {
  return app.root.find(
    node =>
      node.props.accessibilityRole === 'button' &&
      typeof node.props.onPress === 'function',
  );
}

afterEach(() => {
  jest.clearAllMocks();
});

test('checks the server connection from the start screen', async () => {
  mockedCheckServerHealth.mockResolvedValue(undefined);
  let app: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(async () => {
    await findConnectionButton(app).props.onPress();
  });

  expect(mockedCheckServerHealth).toHaveBeenCalledTimes(1);
  expect(
    app!.root.findAllByProps({ children: '서버에 정상적으로 연결됐어요.' }),
  ).not.toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    app.unmount();
  });
});

test('shows connection errors and allows another attempt', async () => {
  mockedCheckServerHealth.mockRejectedValue(new Error('연결 실패'));
  let app: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(async () => {
    await findConnectionButton(app).props.onPress();
  });

  expect(app!.root.findAllByProps({ children: '연결 실패' })).not.toHaveLength(
    0,
  );
  expect(findConnectionButton(app!).props.disabled).toBe(false);

  await ReactTestRenderer.act(async () => {
    app.unmount();
  });
});
