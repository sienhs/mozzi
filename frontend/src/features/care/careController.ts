import type { CareAction, MotionPhase } from './careModel';
import { CARE_POLICY } from './careModel';
import { SCENE_DURATION } from './careChoreography';

/**
 * 돌보기 상호작용 상태 기계. React·타이머와 무관하다.
 *
 * 시작하는 장면마다 새 interactionId를 받고, 장면 완료는 그 id를 인용해야 한다. 모드 변경,
 * 앱 이탈, 동작 줄이기 변경, 화면 이탈은 id를 올려서, 늦게 온 타이머나 중복 완료가 보상을
 * 요청하거나 라운드를 세지 못하게 한다.
 */
export const ASSISTED_PET_DURATION = 2400;

export type CareState = {
  mode: CareAction;
  phase: MotionPhase;
  interactionId: number;
  // 키보드·스크린리더 쓰다듬기: 손이 스스로 움직인다.
  assisted: boolean;
  // 이번 세트에서 끝낸 공놀이 라운드 수.
  round: number;
  progress: number;
};

export type CareEvent =
  | { type: 'mode'; mode: CareAction }
  | { type: 'cancel' }
  | { type: 'pet-start' }
  | { type: 'pet-progress'; value: number }
  | { type: 'pet-end'; completed: boolean }
  | { type: 'pet-assist' }
  | { type: 'feed' }
  | { type: 'throw' }
  | { type: 'scene-end'; interactionId: number };

export type CareEffect =
  | { type: 'complete'; action: CareAction }
  | { type: 'timer'; interactionId: number; ms: number };

export function initialCareState(mode: CareAction = 'pet'): CareState {
  return {
    mode,
    phase: 'idle',
    interactionId: 0,
    assisted: false,
    round: 0,
    progress: 0,
  };
}

// 아무 장면도 진행 중이지 않을 때만 입력을 받는다.
export function acceptsInput(state: CareState, action: CareAction) {
  return (
    state.mode === action &&
    state.phase === 'idle' &&
    (action !== 'play' || state.round < CARE_POLICY.play.targetHits)
  );
}

const none: CareEffect[] = [];

function start(
  state: CareState,
  phase: MotionPhase,
  ms: number,
  extra: Partial<CareState> = {},
) {
  const id = state.interactionId + 1;
  return {
    state: { ...state, ...extra, phase, interactionId: id },
    effects: [{ type: 'timer', interactionId: id, ms }] as CareEffect[],
  };
}

function reward(state: CareState, action: CareAction) {
  const next = start(state, 'reward', SCENE_DURATION.reward, {
    progress: 1,
    assisted: false,
  });
  return {
    state: next.state,
    effects: [{ type: 'complete', action } as CareEffect, ...next.effects],
  };
}

function cancelled(state: CareState): CareState {
  return {
    ...state,
    phase: 'idle',
    interactionId: state.interactionId + 1,
    assisted: false,
    round: 0,
    progress: 0,
  };
}

export function reduceCare(
  state: CareState,
  event: CareEvent,
): { state: CareState; effects: CareEffect[] } {
  switch (event.type) {
    case 'mode':
      return {
        state: { ...cancelled(state), mode: event.mode },
        effects: none,
      };
    case 'cancel':
      return { state: cancelled(state), effects: none };
    case 'pet-start':
      if (!acceptsInput(state, 'pet')) return { state, effects: none };
      return {
        state: {
          ...state,
          phase: 'pet',
          interactionId: state.interactionId + 1,
          progress: 0,
        },
        effects: none,
      };
    case 'pet-progress':
      if (state.phase !== 'pet' || state.assisted)
        return { state, effects: none };
      return {
        state: { ...state, progress: Math.max(0, Math.min(1, event.value)) },
        effects: none,
      };
    case 'pet-end':
      if (state.phase !== 'pet' || state.assisted)
        return { state, effects: none };
      if (!event.completed)
        return {
          state: { ...state, phase: 'idle', progress: 0 },
          effects: none,
        };
      return reward(state, 'pet');
    case 'pet-assist':
      if (!acceptsInput(state, 'pet')) return { state, effects: none };
      return start(state, 'pet', ASSISTED_PET_DURATION, {
        assisted: true,
        progress: 0,
      });
    case 'feed':
      if (!acceptsInput(state, 'feed')) return { state, effects: none };
      return start(state, 'feed', SCENE_DURATION.feed, { progress: 0 });
    case 'throw':
      if (!acceptsInput(state, 'play')) return { state, effects: none };
      return start(state, 'play', SCENE_DURATION.play);
    case 'scene-end': {
      if (event.interactionId !== state.interactionId)
        return { state, effects: none };
      if (state.phase === 'reward')
        return {
          state: {
            ...state,
            phase: 'idle',
            progress: 0,
            round: state.mode === 'play' ? 0 : state.round,
          },
          effects: none,
        };
      if (state.phase === 'feed') return reward(state, 'feed');
      if (state.phase === 'pet' && state.assisted) return reward(state, 'pet');
      if (state.phase === 'play') {
        const round = state.round + 1;
        const progress = round / CARE_POLICY.play.targetHits;
        if (round < CARE_POLICY.play.targetHits)
          // 라운드 종료: id를 넘겨서 같은 완료가 다시 세어지지 않게 한다.
          return {
            state: {
              ...state,
              phase: 'idle',
              round,
              progress,
              interactionId: state.interactionId + 1,
            },
            effects: none,
          };
        return reward({ ...state, round }, 'play');
      }
      return { state, effects: none };
    }
  }
}
