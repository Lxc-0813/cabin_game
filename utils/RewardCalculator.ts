// 奖励计算器
export class RewardCalculator {
  private lastAiStamina: number = 150;
  private lastPlayerStamina: number = 150;
  private lastDistance: number = 0;

  // 计算回合内的即时奖励
  public calculateStepReward(
    aiStamina: number,
    playerStamina: number,
    distance: number,
    aiHit: boolean,
    playerHit: boolean,
    aiParried: boolean,
    playerParried: boolean
  ): number {
    let reward = 0;

    // 1. 攻击奖励
    if (aiHit) {
      reward += 10; // 击中对手
    }

    if (playerHit) {
      reward -= 10; // 被对手击中
    }

    // 2. 格挡奖励
    if (aiParried) {
      reward += 5; // 成功格挡
    }

    if (playerParried) {
      reward -= 3; // 被对手格挡
    }

    // 3. 距离奖励（保持合适距离）
    const optimalMinDist = 180;
    const optimalMaxDist = 280;

    if (distance >= optimalMinDist && distance <= optimalMaxDist) {
      reward += 0.1; // 保持合适距离
    } else if (distance < 100) {
      reward -= 0.2; // 距离太近
    } else if (distance > 500) {
      reward -= 0.15; // 距离太远
    }

    // 4. 体力管理奖励
    const staminaDelta = aiStamina - this.lastAiStamina;
    if (staminaDelta < -30) {
      reward -= 0.5; // 体力消耗过快惩罚
    } else if (aiStamina > 100) {
      reward += 0.05; // 保持高体力奖励
    }

    // 5. 对手体力奖励
    const opponentStaminaDelta = playerStamina - this.lastPlayerStamina;
    if (opponentStaminaDelta < -20) {
      reward += 0.3; // 消耗对手体力
    }

    // 更新状态
    this.lastAiStamina = aiStamina;
    this.lastPlayerStamina = playerStamina;
    this.lastDistance = distance;

    return reward;
  }

  // 计算回合结束奖励
  public calculateEpisodeReward(aiWon: boolean): number {
    if (aiWon) {
      return 50; // 赢得回合大奖励
    } else {
      return -50; // 输掉回合大惩罚
    }
  }

  // 重置状态
  public reset() {
    this.lastAiStamina = 150;
    this.lastPlayerStamina = 150;
    this.lastDistance = 0;
  }
}

export default RewardCalculator;
