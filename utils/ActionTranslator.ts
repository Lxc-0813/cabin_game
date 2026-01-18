import { Action } from './RLAgent';

// 动作转换器 - 将 RL 动作转换为游戏操作
export interface GameAction {
  move: { x: number; y: number }; // 移动向量
  attack: 'thrust' | 'slash' | null; // 攻击类型
  dash: boolean; // 是否冲刺
  wall: boolean; // 是否放墙
}

export class ActionTranslator {
  // 将 RL 动作转换为游戏动作
  public static translate(action: Action): GameAction {
    const gameAction: GameAction = {
      move: { x: 0, y: 0 },
      attack: null,
      dash: false,
      wall: false,
    };

    switch (action) {
      // 移动动作
      case Action.MOVE_UP:
        gameAction.move = { x: 0, y: -1 };
        break;
      case Action.MOVE_DOWN:
        gameAction.move = { x: 0, y: 1 };
        break;
      case Action.MOVE_LEFT:
        gameAction.move = { x: -1, y: 0 };
        break;
      case Action.MOVE_RIGHT:
        gameAction.move = { x: 1, y: 0 };
        break;
      case Action.MOVE_UP_LEFT:
        gameAction.move = { x: -0.707, y: -0.707 };
        break;
      case Action.MOVE_UP_RIGHT:
        gameAction.move = { x: 0.707, y: -0.707 };
        break;
      case Action.MOVE_DOWN_LEFT:
        gameAction.move = { x: -0.707, y: 0.707 };
        break;
      case Action.MOVE_DOWN_RIGHT:
        gameAction.move = { x: 0.707, y: 0.707 };
        break;

      // 攻击动作
      case Action.ATTACK_THRUST:
        gameAction.attack = 'thrust';
        break;
      case Action.ATTACK_SLASH:
        gameAction.attack = 'slash';
        break;

      // 特殊动作
      case Action.DASH:
        gameAction.dash = true;
        break;
      case Action.WALL:
        gameAction.wall = true;
        break;

      // 空闲
      case Action.IDLE:
        // 什么都不做
        break;
    }

    return gameAction;
  }
}

export default ActionTranslator;
