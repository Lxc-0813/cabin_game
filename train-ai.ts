#!/usr/bin/env ts-node

/**
 * 离线 AI 训练脚本
 *
 * 使用方法：
 * 1. npm install -g ts-node (如果还没安装)
 * 2. npm run train:ai
 *
 * 训练将在无 UI 环境中进行，速度更快
 */

import rlAgent, { GameState } from './utils/RLAgent';
import RewardCalculator from './utils/RewardCalculator';
import ActionTranslator from './utils/ActionTranslator';

// 简化的游戏模拟器
class GameSimulator {
  private aiX: number = 300;
  private aiY: number = 400;
  private aiVx: number = 0;
  private aiVy: number = 0;
  private aiStamina: number = 150;
  private aiCooldown: number = 0;

  private playerX: number = 900;
  private playerY: number = 400;
  private playerVx: number = 0;
  private playerVy: number = 0;
  private playerStamina: number = 150;
  private playerCooldown: number = 0;

  private roundNumber: number = 0;
  private aiScore: number = 0;
  private playerScore: number = 0;

  private readonly ARENA_WIDTH = 1200;
  private readonly ARENA_HEIGHT = 800;
  private readonly MOVE_SPEED = 0.8;
  private readonly FRICTION = 0.85;
  private readonly STAMINA_REGEN = 0.5;

  // 获取当前状态
  public getState(): GameState {
    const distance = this.getDistance();
    const angle = this.getAngle();

    return {
      aiX: this.aiX,
      aiY: this.aiY,
      aiVx: this.aiVx,
      aiVy: this.aiVy,
      playerX: this.playerX,
      playerY: this.playerY,
      playerVx: this.playerVx,
      playerVy: this.playerVy,
      distance,
      angle,
      aiStamina: this.aiStamina,
      playerStamina: this.playerStamina,
      aiCooldown: this.aiCooldown,
      playerCooldown: this.playerCooldown,
      playerAttacking: this.playerCooldown > 0,
      roundNumber: this.roundNumber,
    };
  }

  // 执行一帧更新
  public step(action: number): { reward: number; done: boolean } {
    // AI 执行动作
    const gameAction = ActionTranslator.translate(action);

    if (gameAction.move.x !== 0 || gameAction.move.y !== 0) {
      this.aiVx += gameAction.move.x * this.MOVE_SPEED;
      this.aiVy += gameAction.move.y * this.MOVE_SPEED;
    }

    // 简化的攻击逻辑
    if (gameAction.attack && this.aiCooldown <= 0) {
      this.aiCooldown = 500;
      this.aiStamina -= 25;

      // 简化的命中检测
      const distance = this.getDistance();
      if (distance < 230 && Math.random() < 0.3) {
        this.playerStamina -= 20;
        if (this.playerStamina <= 0) {
          this.aiScore++;
          return { reward: 50, done: true };
        }
        return { reward: 10, done: false };
      }
    }

    // 简化的玩家 AI（随机行为）
    if (this.playerCooldown <= 0 && Math.random() < 0.05) {
      this.playerCooldown = 500;
      this.playerStamina -= 25;

      const distance = this.getDistance();
      if (distance < 230 && Math.random() < 0.2) {
        this.aiStamina -= 20;
        if (this.aiStamina <= 0) {
          this.playerScore++;
          return { reward: -50, done: true };
        }
        return { reward: -10, done: false };
      }
    }

    // 更新物理
    this.updatePhysics();

    // 计算奖励
    const reward = this.calculateReward();

    return { reward, done: false };
  }

  private updatePhysics() {
    // 更新位置
    this.aiX += this.aiVx;
    this.aiY += this.aiVy;
    this.playerX += this.playerVx;
    this.playerY += this.playerVy;

    // 摩擦力
    this.aiVx *= this.FRICTION;
    this.aiVy *= this.FRICTION;
    this.playerVx *= this.FRICTION;
    this.playerVy *= this.FRICTION;

    // 边界碰撞
    this.aiX = Math.max(20, Math.min(this.ARENA_WIDTH - 20, this.aiX));
    this.aiY = Math.max(20, Math.min(this.ARENA_HEIGHT - 20, this.aiY));

    // 体力恢复
    this.aiStamina = Math.min(150, this.aiStamina + this.STAMINA_REGEN);
    this.playerStamina = Math.min(150, this.playerStamina + this.STAMINA_REGEN);

    // 冷却时间
    this.aiCooldown = Math.max(0, this.aiCooldown - 16);
    this.playerCooldown = Math.max(0, this.playerCooldown - 16);
  }

  private calculateReward(): number {
    let reward = 0;

    const distance = this.getDistance();

    // 距离奖励
    if (distance >= 180 && distance <= 280) {
      reward += 0.1;
    } else if (distance < 100) {
      reward -= 0.2;
    } else if (distance > 500) {
      reward -= 0.15;
    }

    // 体力奖励
    if (this.aiStamina > 100) {
      reward += 0.05;
    }

    return reward;
  }

  private getDistance(): number {
    const dx = this.aiX - this.playerX;
    const dy = this.aiY - this.playerY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getAngle(): number {
    return Math.atan2(this.playerY - this.aiY, this.playerX - this.aiX);
  }

  public reset() {
    this.aiX = 300;
    this.aiY = 400;
    this.aiVx = 0;
    this.aiVy = 0;
    this.aiStamina = 150;
    this.aiCooldown = 0;

    this.playerX = 900;
    this.playerY = 400;
    this.playerVx = 0;
    this.playerVy = 0;
    this.playerStamina = 150;
    this.playerCooldown = 0;

    this.roundNumber++;
  }
}

// 训练循环
async function train() {
  console.log('🤖 开始训练 AI...\n');

  rlAgent.setTrainingMode(true);

  const simulator = new GameSimulator();
  const numEpisodes = 1000; // 训练回合数
  const maxSteps = 1000; // 每回合最大步数

  for (let episode = 0; episode < numEpisodes; episode++) {
    simulator.reset();
    let state = rlAgent.gameStateToVector(simulator.getState());
    let totalReward = 0;

    for (let step = 0; step < maxSteps; step++) {
      // 选择动作
      const action = rlAgent.selectAction(state);

      // 执行动作
      const { reward, done } = simulator.step(action);
      totalReward += reward;

      // 获取新状态
      const nextState = rlAgent.gameStateToVector(simulator.getState());

      // 存储经验
      rlAgent.storeExperience(state, action, reward, nextState, done);

      // 训练
      if (step % 4 === 0) {
        await rlAgent.train();
      }

      state = nextState;

      if (done) {
        break;
      }
    }

    rlAgent.resetEpisode();

    // 打印进度
    if ((episode + 1) % 10 === 0) {
      const stats = rlAgent.getStats();
      console.log(
        `Episode ${episode + 1}/${numEpisodes} | ` +
          `ε=${(stats.epsilon * 100).toFixed(1)}% | ` +
          `Avg Reward=${stats.recentAvgReward.toFixed(2)} | ` +
          `Buffer=${stats.bufferSize}`
      );
    }

    // 定期保存
    if ((episode + 1) % 100 === 0) {
      await rlAgent.saveModel();
      console.log(`✅ 模型已保存 (Episode ${episode + 1})\n`);
    }
  }

  // 最终保存
  await rlAgent.saveModel();
  console.log('\n✨ 训练完成！模型已保存。');

  const finalStats = rlAgent.getStats();
  console.log('\n📊 最终统计:');
  console.log(`  总训练步数: ${finalStats.trainingSteps}`);
  console.log(`  总回合数: ${finalStats.totalEpisodes}`);
  console.log(`  平均奖励: ${finalStats.avgReward.toFixed(2)}`);
  console.log(`  最近100回合平均: ${finalStats.recentAvgReward.toFixed(2)}`);
  console.log(`  探索率: ${(finalStats.epsilon * 100).toFixed(2)}%`);
}

// 如果直接运行此脚本
if (require.main === module) {
  train().catch(console.error);
}

export { train };
