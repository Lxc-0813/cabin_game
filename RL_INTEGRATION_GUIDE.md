# 🤖 强化学习 AI 集成指南

## 📋 系统概述

我已经为你创建了一个完整的深度强化学习（DQN）系统，可以训练游戏 AI。系统包含：

1. **`utils/RLAgent.ts`** - DQN 智能体，包含神经网络和训练逻辑
2. **`utils/RewardCalculator.ts`** - 奖励函数计算器
3. **`utils/ActionTranslator.ts`** - 动作转换器

## 🎯 状态空间（16维）

RL Agent 观察以下游戏状态：

```typescript
{
  aiX, aiY,           // AI 位置（归一化）
  aiVx, aiVy,         // AI 速度
  playerX, playerY,   // 玩家位置
  playerVx, playerVy, // 玩家速度
  distance,           // 双方距离
  angle,              // 相对角度
  aiStamina,          // AI 体力
  playerStamina,      // 玩家体力
  aiCooldown,         // AI 冷却时间
  playerCooldown,     // 玩家冷却时间
  playerAttacking,    // 玩家是否在攻击
  roundNumber         // 当前回合数
}
```

## 🎮 动作空间（13个动作）

- `0-7`: 8个方向移动（上下左右+对角线）
- `8`: 刺击（thrust）
- `9`: 挡击（slash）
- `10`: 冲刺（dash）
- `11`: 放墙（wall）
- `12`: 空闲（idle）

## 🏆 奖励函数

### 即时奖励（每帧）
- ✅ 击中对手：`+10`
- ❌ 被击中：`-10`
- 🛡️ 成功格挡：`+5`
- 被格挡：`-3`
- 📏 保持合适距离（180-280）：`+0.1`
- 距离太近（<100）：`-0.2`
- 距离太远（>500）：`-0.15`
- 💪 保持高体力（>100）：`+0.05`
- 体力消耗过快：`-0.5`

### 回合结束奖励
- 🎉 赢得回合：`+50`
- 😞 输掉回合：`-50`

## 🔧 集成到游戏

### 方法一：快速测试（推荐先尝试）

创建一个新的 AI 模式来测试 RL：

```typescript
// 在 FencingGame.tsx 中添加
import rlAgent, { GameState } from '../utils/RLAgent';
import RewardCalculator from '../utils/RewardCalculator';
import ActionTranslator from '../utils/ActionTranslator';

// 添加状态
const [useRLAI, setUseRLAI] = useState(false);
const rewardCalculator = useRef(new RewardCalculator());
const lastAction = useRef(12); // IDLE
const lastState = useRef<Float32Array | null>(null);

// 在 AI 逻辑部分（第 798行左右，roundActive.current && gameMode === 'local'）
if (useRLAI) {
  // 构建游戏状态
  const gameState: GameState = {
    aiX: aiPos.current.x,
    aiY: aiPos.current.y,
    aiVx: aiVel.current.x,
    aiVy: aiVel.current.y,
    playerX: playerPos.current.x,
    playerY: playerPos.current.y,
    playerVx: playerVel.current.x,
    playerVy: playerVel.current.y,
    distance: dist,
    angle: angleToPlayer,
    aiStamina: aiStamina.current,
    playerStamina: playerStamina.current,
    aiCooldown: aiCooldown.current,
    playerCooldown: playerCooldown.current,
    playerAttacking: playerCooldown.current > 0,
    roundNumber: scoreRef.current.player + scoreRef.current.ai,
  };

  const state = rlAgent.gameStateToVector(gameState);

  // 选择动作
  const action = rlAgent.selectAction(state);
  const gameAction = ActionTranslator.translate(action);

  // 执行动作
  if (gameAction.move.x !== 0 || gameAction.move.y !== 0) {
    const speed = MOVE_SPEED;
    aiVel.current.x += gameAction.move.x * speed * globalDt;
    aiVel.current.y += gameAction.move.y * speed * globalDt;
  }

  if (gameAction.attack && aiCooldown.current <= 0) {
    performAttack('ai', gameAction.attack, playerPos.current);
  }

  if (gameAction.dash && aiStamina.current >= DASH_COST) {
    performDash('ai', gameAction.move);
  }

  if (gameAction.wall && aiStamina.current >= WALL_COST) {
    performWall('ai', playerPos.current);
  }

  // 存储经验（如果在训练模式）
  if (rlAgent.isTraining() && lastState.current) {
    const reward = rewardCalculator.current.calculateStepReward(
      aiStamina.current,
      playerStamina.current,
      dist,
      false, // TODO: 检测 AI 是否击中
      false, // TODO: 检测玩家是否击中
      false,
      false
    );

    rlAgent.storeExperience(lastState.current, lastAction.current, reward, state, false);

    // 定期训练
    if (rlAgent.isTraining() && Math.random() < 0.1) {
      rlAgent.train();
    }
  }

  lastState.current = state;
  lastAction.current = action;
}
```

### 在回合结束时添加终止奖励

```typescript
// 在 handleRoundEnd 函数中
if (useRLAI && lastState.current) {
  const finalReward = rewardCalculator.current.calculateEpisodeReward(winner === 'ai');
  const finalState = rlAgent.gameStateToVector({...}); // 当前状态

  rlAgent.storeExperience(lastState.current, lastAction.current, finalReward, finalState, true);
  rlAgent.resetEpisode();
  rewardCalculator.current.reset();
  lastState.current = null;
}
```

## 🎛️ 训练控制界面

### 添加训练开关

在菜单中添加：

```typescript
<button
  onClick={() => {
    setUseRLAI(!useRLAI);
    if (!useRLAI) {
      rlAgent.setTrainingMode(true);
    }
  }}
  className="w-48 py-2 text-sm border"
>
  {useRLAI ? 'RL AI: ON' : 'RL AI: OFF'}
</button>

<button
  onClick={() => rlAgent.setTrainingMode(!rlAgent.isTraining())}
  className="w-48 py-2 text-sm border"
>
  训练模式: {rlAgent.isTraining() ? 'ON' : 'OFF'}
</button>
```

### 显示训练统计

```typescript
const [stats, setStats] = useState(rlAgent.getStats());

// 定期更新统计
useEffect(() => {
  if (useRLAI) {
    const interval = setInterval(() => {
      setStats(rlAgent.getStats());
    }, 1000);
    return () => clearInterval(interval);
  }
}, [useRLAI]);

// 在 HUD 中显示
<div className="text-xs">
  训练步数: {stats.trainingSteps}
  <br/>
  探索率: {(stats.epsilon * 100).toFixed(1)}%
  <br/>
  平均奖励: {stats.recentAvgReward.toFixed(2)}
</div>
```

## 💾 保存和加载模型

### 保存模型

```typescript
<button onClick={() => rlAgent.saveModel()}>
  保存 AI 模型
</button>
```

### 加载模型

```typescript
<button onClick={async () => {
  const loaded = await rlAgent.loadModel();
  if (loaded) {
    alert('模型加载成功！');
  }
}}>
  加载 AI 模型
</button>
```

## 🚀 训练流程

### 1. 开启训练模式

1. 启动游戏
2. 在菜单中开启 "RL AI: ON"
3. 开启 "训练模式: ON"
4. 选择难度 "初入江湖" 或 "略有小成"

### 2. 观察训练过程

- **初期（探索率 100%）**：AI 会随机行动，表现很差
- **中期（探索率 50%）**：AI 开始学习基本策略
- **后期（探索率 1%）**：AI 表现接近或超过原始 AI

### 3. 评估效果

- 关闭训练模式（探索率固定为 0）
- 观察 AI 的表现
- 查看平均奖励是否提升

### 4. 保存模型

训练满意后，保存模型供以后使用

## 📊 训练建议

### 超参数调整

在 `RLAgent.ts` 中可以调整：

```typescript
private epsilon: number = 1.0;        // 初始探索率
private epsilonMin: number = 0.01;    // 最小探索率
private epsilonDecay: number = 0.995; // 探索率衰减
private gamma: number = 0.99;         // 折扣因子
private learningRate: number = 0.001; // 学习率
private batchSize: number = 64;       // 批次大小
```

### 训练时长

- **快速测试**：100-200 回合
- **良好性能**：500-1000 回合
- **最优性能**：2000+ 回合

### 训练技巧

1. **从简单开始**：先在 "初入江湖" 难度训练
2. **渐进式训练**：训练好后，切换到更高难度继续训练
3. **定期保存**：每隔一段时间保存模型，防止训练崩溃
4. **监控奖励**：如果平均奖励不上升，可能需要调整超参数

## 🔬 离线训练

如果想要更快的训练速度，可以创建一个无 UI 的训练脚本：

```bash
# 创建 train.ts
npm run train
```

## ⚠️ 注意事项

1. **内存管理**：长时间训练可能占用大量内存，定期刷新页面
2. **模型持久化**：模型保存在 IndexedDB 中，清除浏览器数据会丢失
3. **性能影响**：训练模式会略微降低游戏帧率
4. **TensorFlow.js**：首次加载会下载 TensorFlow.js 库（~2MB）

## 🎯 预期效果

训练充分的 RL AI 应该能够：

- ✅ 保持合适的攻击距离
- ✅ 根据玩家状态选择攻击时机
- ✅ 合理使用冲刺和防御墙
- ✅ 有效管理体力
- ✅ 在 "略有小成" 难度下击败玩家

## 📚 进阶功能

### 多智能体训练

让两个 RL Agent 互相对战训练（自我对弈）

### 课程学习

从简单任务开始，逐步增加难度

### 迁移学习

在一个角色风格上训练，迁移到另一个风格

---

祝训练愉快！🎮🤖
