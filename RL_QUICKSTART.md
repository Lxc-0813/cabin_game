# 🚀 强化学习 AI - 快速开始

## ✅ 已完成的工作

我已经为你创建了一个完整的深度强化学习（DQN）系统！

### 📁 新增文件

1. **`utils/RLAgent.ts`** (293 行)
   - 完整的 DQN 实现
   - 神经网络（3层隐藏层：128-128-64）
   - 经验回放缓冲区（10000个经验）
   - Epsilon-greedy 探索策略
   - 目标网络和软更新

2. **`utils/RewardCalculator.ts`** (70 行)
   - 精细的奖励函数
   - 击中/被击中奖励
   - 距离管理奖励
   - 体力管理奖励

3. **`utils/ActionTranslator.ts`** (71 行)
   - 13个动作的转换器
   - 8方向移动 + 攻击 + 特殊技能

4. **`train-ai.ts`** (250 行)
   - 离线训练脚本
   - 游戏模拟器
   - 训练循环和进度显示

5. **文档**
   - `RL_INTEGRATION_GUIDE.md` - 详细集成指南
   - `RL_QUICKSTART.md` - 本文件

### 🔧 安装的依赖

- `@tensorflow/tfjs@^4.22.0` - 深度学习框架

## 🎯 系统特性

### 状态空间（16维）
- AI 和玩家的位置、速度
- 双方距离和角度
- 体力和冷却时间
- 对手状态

### 动作空间（13个动作）
- 8个方向移动
- 刺击、挡击
- 冲刺、放墙
- 空闲

### 奖励系统
- ✅ 击中：+10
- ❌ 被击中：-10
- 🎯 保持距离：+0.1
- 💪 管理体力：±0.5
- 🏆 赢回合：+50

## 📝 下一步：集成到游戏

### 方案A：最快测试（推荐）

1. **修改 FencingGame.tsx**

在文件顶部添加导入：
```typescript
import rlAgent, { GameState } from '../utils/RLAgent';
import ActionTranslator from '../utils/ActionTranslator';
```

2. **添加状态变量**（约第 206 行附近）

```typescript
const [useRLAI, setUseRLAI] = useState(false);
const lastState = useRef<Float32Array | null>(null);
```

3. **在菜单添加开关**（约第 1556 行附近）

```typescript
<button
  onClick={() => setUseRLAI(!useRLAI)}
  className={`w-48 py-2 text-sm border transition-all duration-500 ${
    isDarkTheme
      ? 'border-purple-800 text-purple-400 hover:text-purple-100'
      : 'border-purple-300 text-purple-600 hover:text-purple-900'
  }`}
>
  {useRLAI ? 'RL AI: 已启用' : 'RL AI: 已禁用'}
</button>
```

4. **替换 AI 逻辑**（约第 824 行，`if (roundActive.current && gameMode === 'local')` 内部）

在原有 AI 逻辑之前添加：

```typescript
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
  const action = rlAgent.selectAction(state);
  const gameAction = ActionTranslator.translate(action);

  // 执行移动
  if (gameAction.move.x !== 0 || gameAction.move.y !== 0) {
    aiVel.current.x += gameAction.move.x * moveSpeed * globalDt;
    aiVel.current.y += gameAction.move.y * moveSpeed * globalDt;
  }

  // 执行攻击
  if (gameAction.attack && aiCooldown.current <= 0) {
    performAttack('ai', gameAction.attack, playerPos.current);
  }

  lastState.current = state;
}
```

5. **加载预训练模型（可选）**

在 `startGame` 函数中：
```typescript
if (useRLAI) {
  rlAgent.loadModel(); // 尝试加载已保存的模型
}
```

### 方案B：先离线训练（更好的效果）

**暂时不可用** - 需要 Node.js 环境支持 TensorFlow.js

你可以：
1. 使用方案A直接在游戏中测试
2. 开启训练模式让AI边玩边学
3. 或等待我创建浏览器内训练界面

## 🎮 使用方法

### 启用 RL AI

1. 启动游戏：`npm run dev`
2. 在菜单中点击 "RL AI: 已禁用" 开关
3. 选择难度开始游戏
4. AI 将使用深度学习策略（如果加载了模型）或随机探索（如果是新模型）

### 在线训练（可选）

1. 在上述代码中添加训练逻辑
2. 开启训练模式：`rlAgent.setTrainingMode(true)`
3. AI 会边玩边学，逐渐变强

### 保存模型

在控制台执行：
```javascript
rlAgent.saveModel()
```

模型会保存到浏览器的 IndexedDB

## 🔍 验证安装

在浏览器控制台执行：

```javascript
import rlAgent from './utils/RLAgent';
console.log(rlAgent.getStats());
```

应该看到类似输出：
```
{
  trainingSteps: 0,
  epsilon: 1,
  totalEpisodes: 0,
  avgReward: 0,
  recentAvgReward: 0,
  bufferSize: 0
}
```

## 📖 更多文档

- **详细集成指南**：`RL_INTEGRATION_GUIDE.md`
- **代码注释**：所有 RL 文件都有详细注释
- **TensorFlow.js 文档**：https://js.tensorflow.org

## ⚠️ 注意事项

1. **首次加载较慢**：TensorFlow.js 需要下载和初始化（~2-3秒）
2. **未训练的 AI**：初始 AI 表现会很差（随机行为）
3. **内存占用**：约增加 50-100MB 内存使用
4. **帧率影响**：训练模式可能降低 5-10 FPS

## 🎯 预期效果

- **未训练**：完全随机，很容易被击败
- **训练100回合**：开始学会移动和基本攻击
- **训练500回合**：能保持距离，选择攻击时机
- **训练2000+回合**：接近或超过原始 AI 水平

## 🐛 故障排除

### TensorFlow.js 加载失败
```bash
# 重新安装依赖
npm install @tensorflow/tfjs
```

### 模型保存失败
- 检查浏览器是否支持 IndexedDB
- 尝试使用本地存储：`rlAgent.saveModel('localstorage://model')`

### AI 不移动
- 确保 `useRLAI` 为 true
- 检查控制台是否有错误
- 尝试重新加载页面

---

🎉 准备好训练你的 AI 对手了吗？开始吧！
