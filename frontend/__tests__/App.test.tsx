import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { HomeScreen } from '../src/features/home/HomeScreen';
import { checkServerHealth } from '../src/shared/api/health';

jest.mock('../src/shared/api/health', () => ({
  checkServerHealth: jest.fn(),
}));

const mockedCheckServerHealth = jest.mocked(checkServerHealth);

afterEach(() => {
  jest.clearAllMocks();
});

test('checks the server connection from the start screen', async () => {
  mockedCheckServerHealth.mockResolvedValue(undefined);
  await render(<HomeScreen />);

  await fireEvent.press(screen.getByRole('button', { name: '서버 연결 확인' }));

  expect(mockedCheckServerHealth).toHaveBeenCalledTimes(1);
  expect(
    await screen.findByText('서버에 정상적으로 연결됐어요.'),
  ).toBeOnTheScreen();
});

test('shows connection errors and allows another attempt', async () => {
  mockedCheckServerHealth.mockRejectedValue(new Error('연결 실패'));
  await render(<HomeScreen />);

  await fireEvent.press(screen.getByRole('button', { name: '서버 연결 확인' }));

  expect(await screen.findByText('연결 실패')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: '서버 연결 확인' })).toBeEnabled();
});
