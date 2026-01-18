import * as tf from '@tensorflow/tfjs';

// 动作空间定义
export enum Action {
  MOVE_UP = 0,
  MOVE_DOWN = 1,
  MOVE_LEFT = 2,
  MOVE_RIGHT = 3,
  MOVE_UP_LEFT = 4,
  MOVE_UP_RIGHT = 5,
  MOVE_DOWN_LEFT = 6,
  MOVE_DOWN_RIGHT = 7,
  ATTACK_THRUST = 8,
  ATTACK_SLASH = 9,
  DASH = 10,
  WALL = 11,
  IDLE = 12,
}

export const NUM_ACTIONS = 13;

// 状态向量大小
export const STATE_SIZE = 16;

// 游戏状态接口
export interface GameState {
  // AI 位置和速度
  aiX: number;
  aiY: number;
  aiVx: number;
  aiVy: number;

  // 玩家位置和速度
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;

  // 相对信息
  distance: number;
  angle: number;

  // 资源
  aiStamina: number;
  playerStamina: number;

  // 冷却时间
  aiCooldown: number;
  playerCooldown: number;

  // 玩家是否在攻击
  playerAttacking: boolean;

  // 当前回合数
  roundNumber: number;
}

// 经验元组
interface Experience {
  state: Float32Array;
  action: number;
  reward: number;
  nextState: Float32Array;
  done: boolean;
}

// DQN 智能体类
export class RLAgent {
  private qNetwork: tf.LayersModel;
  private targetNetwork: tf.LayersModel;
  private optimizer: tf.Optimizer;

  // 超参数
  private epsilon: number = 1.0; // 探索率
  private epsilonMin: number = 0.01;
  private epsilonDecay: number = 0.995;
  private gamma: number = 0.99; // 折扣因子
  private learningRate: number = 0.001;
  private batchSize: number = 64;
  private targetUpdateFreq: number = 100; // 目标网络更新频率

  // 经验回放缓冲区
  private replayBuffer: Experience[] = [];
  private bufferSize: number = 10000;

  // 训练统计
  private trainingSteps: number = 0;
  private totalReward: number = 0;
  private episodeRewards: number[] = [];

  // 训练模式
  private trainingMode: boolean = false;

  constructor() {
    this.qNetwork = this.buildNetwork();
    this.targetNetwork = this.buildNetwork();
    this.optimizer = tf.train.adam(this.learningRate);
    this.syncTargetNetwork();
  }

  // 构建神经网络
  private buildNetwork(): tf.LayersModel {
    const model = tf.sequential();

    // 输入层 + 隐藏层1
    model.add(
      tf.layers.dense({
        inputShape: [STATE_SIZE],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal',
      })
    );

    // 隐藏层2
    model.add(
      tf.layers.dense({
        units: 128,
        activation: 'relu',
        kernelInitializer: 'heNormal',
      })
    );

    // 隐藏层3
    model.add(
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal',
      })
    );

    // 输出层（Q值）
    model.add(
      tf.layers.dense({
        units: NUM_ACTIONS,
        activation: 'linear',
      })
    );

    return model;
  }

  // 将游戏状态转换为状态向量
  public gameStateToVector(gameState: GameState): Float32Array {
    // 归一化位置（假设游戏区域是 1200x800）
    const state = new Float32Array(STATE_SIZE);
    state[0] = gameState.aiX / 1200;
    state[1] = gameState.aiY / 800;
    state[2] = gameState.aiVx / 50; // 归一化速度
    state[3] = gameState.aiVy / 50;

    state[4] = gameState.playerX / 1200;
    state[5] = gameState.playerY / 800;
    state[6] = gameState.playerVx / 50;
    state[7] = gameState.playerVy / 50;

    state[8] = gameState.distance / 1200; // 归一化距离
    state[9] = gameState.angle / (2 * Math.PI); // 归一化角度

    state[10] = gameState.aiStamina / 150; // 归一化体力
    state[11] = gameState.playerStamina / 150;

    state[12] = gameState.aiCooldown / 500; // 归一化冷却时间
    state[13] = gameState.playerCooldown / 500;

    state[14] = gameState.playerAttacking ? 1 : 0;
    state[15] = gameState.roundNumber / 10; // 归一化回合数

    return state;
  }

  // 选择动作（epsilon-greedy）
  public selectAction(state: Float32Array): number {
    if (this.trainingMode && Math.random() < this.epsilon) {
      // 探索：随机动作
      return Math.floor(Math.random() * NUM_ACTIONS);
    }

    // 利用：选择Q值最大的动作
    return tf.tidy(() => {
      const stateTensor = tf.tensor2d([Array.from(state)]);
      const qValues = this.qNetwork.predict(stateTensor) as tf.Tensor;
      const action = qValues.argMax(1).dataSync()[0];
      return action;
    });
  }

  // 存储经验
  public storeExperience(
    state: Float32Array,
    action: number,
    reward: number,
    nextState: Float32Array,
    done: boolean
  ) {
    const experience: Experience = {
      state,
      action,
      reward,
      nextState,
      done,
    };

    this.replayBuffer.push(experience);

    // 限制缓冲区大小
    if (this.replayBuffer.length > this.bufferSize) {
      this.replayBuffer.shift();
    }

    this.totalReward += reward;
  }

  // 训练一步
  public async train(): Promise<number | null> {
    if (this.replayBuffer.length < this.batchSize) {
      return null; // 经验不足，不训练
    }

    // 随机采样经验
    const batch = this.sampleBatch(this.batchSize);

    const loss = await tf.tidy(() => {
      // 准备批次数据
      const states = tf.tensor2d(batch.map((e) => Array.from(e.state)));
      const actions = tf.tensor1d(batch.map((e) => e.action), 'int32');
      const rewards = tf.tensor1d(batch.map((e) => e.reward));
      const nextStates = tf.tensor2d(batch.map((e) => Array.from(e.nextState)));
      const dones = tf.tensor1d(batch.map((e) => (e.done ? 1 : 0)));

      // 计算目标 Q 值
      const nextQValues = this.targetNetwork.predict(nextStates) as tf.Tensor;
      const maxNextQValues = nextQValues.max(1);
      const targetQValues = rewards.add(
        maxNextQValues.mul(tf.scalar(this.gamma)).mul(tf.scalar(1).sub(dones))
      );

      // 计算当前 Q 值
      const currentQValues = this.qNetwork.predict(states) as tf.Tensor;

      // 使用梯度下降更新网络
      const loss = this.optimizer.minimize(() => {
        const qValuesForActions = currentQValues
          .mul(tf.oneHot(actions, NUM_ACTIONS))
          .sum(1);
        return tf.losses.meanSquaredError(targetQValues, qValuesForActions);
      });

      return loss;
    });

    this.trainingSteps++;

    // 定期更新目标网络
    if (this.trainingSteps % this.targetUpdateFreq === 0) {
      this.syncTargetNetwork();
    }

    // 衰减探索率
    if (this.epsilon > this.epsilonMin) {
      this.epsilon *= this.epsilonDecay;
    }

    const lossValue = await loss.data();
    loss.dispose();

    return lossValue[0];
  }

  // 随机采样批次
  private sampleBatch(batchSize: number): Experience[] {
    const batch: Experience[] = [];
    for (let i = 0; i < batchSize; i++) {
      const index = Math.floor(Math.random() * this.replayBuffer.length);
      batch.push(this.replayBuffer[index]);
    }
    return batch;
  }

  // 同步目标网络
  private syncTargetNetwork() {
    const weights = this.qNetwork.getWeights();
    this.targetNetwork.setWeights(weights);
  }

  // 保存模型
  public async saveModel(path: string = 'indexeddb://fencing-ai-model') {
    await this.qNetwork.save(path);
    console.log(`模型已保存到: ${path}`);
  }

  // 加载模型
  public async loadModel(path: string = 'indexeddb://fencing-ai-model') {
    try {
      this.qNetwork = await tf.loadLayersModel(path);
      this.syncTargetNetwork();
      console.log(`模型已加载: ${path}`);
      return true;
    } catch (error) {
      console.warn('加载模型失败:', error);
      return false;
    }
  }

  // 重置回合
  public resetEpisode() {
    if (this.totalReward !== 0) {
      this.episodeRewards.push(this.totalReward);
    }
    this.totalReward = 0;
  }

  // 获取训练统计
  public getStats() {
    const avgReward =
      this.episodeRewards.length > 0
        ? this.episodeRewards.reduce((a, b) => a + b, 0) / this.episodeRewards.length
        : 0;

    const recentRewards = this.episodeRewards.slice(-100);
    const recentAvgReward =
      recentRewards.length > 0
        ? recentRewards.reduce((a, b) => a + b, 0) / recentRewards.length
        : 0;

    return {
      trainingSteps: this.trainingSteps,
      epsilon: this.epsilon,
      totalEpisodes: this.episodeRewards.length,
      avgReward: avgReward,
      recentAvgReward: recentAvgReward,
      bufferSize: this.replayBuffer.length,
    };
  }

  // 设置训练模式
  public setTrainingMode(enabled: boolean) {
    this.trainingMode = enabled;
  }

  // 获取训练模式
  public isTraining(): boolean {
    return this.trainingMode;
  }

  // 清空经验缓冲区
  public clearBuffer() {
    this.replayBuffer = [];
  }

  // 销毁模型（释放内存）
  public dispose() {
    this.qNetwork.dispose();
    this.targetNetwork.dispose();
  }
}

// 单例模式
const rlAgent = new RLAgent();
export default rlAgent;
