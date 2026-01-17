# 使用 Render.com 部署在线对战服务器

## 🌟 为什么选择 Render？

- ✅ **比 Railway 更稳定** - 服务器更可靠
- ✅ **免费套餐** - 每月 750 小时免费（足够玩了）
- ✅ **自动部署** - 推送代码自动更新
- ✅ **全球节点** - 延迟低
- ✅ **支持 WebSocket** - 完美支持游戏联机

## 📋 部署步骤

### 第 1 步：注册 Render 账号

1. 访问 https://render.com
2. 点击 "Get Started" 或 "Sign Up"
3. 使用 GitHub 账号登录（推荐）

### 第 2 步：创建 Web Service

1. 登录后，点击 "New +" 按钮
2. 选择 "Web Service"
3. 连接你的 GitHub 仓库：
   - 点击 "Connect account" 连接 GitHub
   - 找到并选择 `cabin_game` 仓库
   - 点击 "Connect"

### 第 3 步：配置服务

填写以下信息：

**基本设置：**
- **Name**: `cabin-game-server`（或任何你喜欢的名字）
- **Region**: 选择 `Singapore`（对中国用户延迟最低）
- **Branch**: `main`（或你的主分支）
- **Root Directory**: 留空
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

**实例设置：**
- **Instance Type**: 选择 `Free`（免费套餐）

### 第 4 步：添加环境变量（可选）

在 "Environment" 部分，可以添加：
- `PORT`: Render 会自动设置，不需要手动添加
- `NODE_ENV`: `production`

### 第 5 步：部署

1. 点击底部的 "Create Web Service"
2. 等待部署完成（大约 2-3 分钟）
3. 部署成功后，你会看到：
   ```
   ✓ Live
   Your service is live at https://cabin-game-server-xxxx.onrender.com
   ```
4. **复制这个 URL**（你的服务器地址）

## 🎮 修改游戏代码连接到云服务器

### 方法一：修改默认服务器地址（推荐）

打开 `components/MultiplayerMenu.tsx`，找到第 13 行左右：

```typescript
const [serverUrl, setServerUrl] = useState('http://localhost:3001');
```

修改为你的 Render 服务器地址：

```typescript
const [serverUrl, setServerUrl] = useState('https://cabin-game-server-xxxx.onrender.com');
```

**注意**：
- 把 `cabin-game-server-xxxx.onrender.com` 替换成你的实际地址
- 使用 `https://`（不是 `http://`）
- **不要**在末尾加 `/` 或端口号

### 方法二：玩家手动输入（更灵活）

保持代码不变，玩家在游戏中输入你的 Render 服务器地址：
```
https://cabin-game-server-xxxx.onrender.com
```

## 🔍 验证部署

### 测试服务器是否运行

在浏览器访问：
```
https://cabin-game-server-xxxx.onrender.com
```

应该看到：
```
WebSocket server is running
```

### 测试游戏连接

1. 启动游戏：`npm run dev`
2. 点击 "局域网对战"
3. 输入服务器地址（或使用默认的云地址）
4. 点击 "连接服务器"
5. 应该显示 "✓ 已连接到服务器"

## ⚠️ 重要提示

### 免费套餐限制

- ✅ 每月 750 小时免费（约 31 天）
- ⚠️ **闲置 15 分钟后自动休眠**
- ⚠️ 休眠后首次访问需要等待 30-60 秒唤醒
- ✅ 内存 512MB（足够用）

### 避免休眠的方法

**方法 1：使用 Uptime Robot 监控（推荐）**

1. 访问 https://uptimerobot.com
2. 注册免费账号
3. 添加监控：
   - Monitor Type: `HTTP(s)`
   - URL: `https://cabin-game-server-xxxx.onrender.com`
   - Monitoring Interval: `5 minutes`
4. 这样每 5 分钟会自动访问一次，保持服务器唤醒

**方法 2：升级到付费套餐**

- 价格：$7/月
- 好处：不休眠、更多资源、更快速度

## 🔧 常见问题

### Q1: 部署失败怎么办？

**检查：**
1. server.js 文件是否在仓库根目录
2. package.json 中是否有所有依赖
3. 查看 Render 的 "Logs" 标签页看错误信息

**解决：**
```bash
# 确保 server.js 使用环境变量的端口
const PORT = process.env.PORT || 3001;
```

### Q2: 游戏连接不上服务器？

**检查：**
1. 服务器是否显示 "Live"（绿色）
2. URL 是否正确（https:// 开头）
3. 服务器是否刚刚休眠（等待 30-60 秒）

**解决：**
- 在浏览器先访问服务器 URL 唤醒它
- 然后再在游戏中连接

### Q3: 延迟很高怎么办？

**优化建议：**
1. 确保 Region 选择了 `Singapore`（对中国用户最快）
2. 可以考虑升级到付费套餐获得更好性能
3. 或者改用国内云服务器（阿里云/腾讯云）

### Q4: 服务器地址改了，GitHub Pages 上的游戏怎么办？

**两个方法：**

**方法 1：修改代码重新部署**
1. 修改 MultiplayerMenu.tsx 的默认服务器地址
2. 提交推送到 main 分支
3. GitHub Actions 会自动重新部署

**方法 2：不改代码**
- 让玩家手动输入服务器地址
- 在游戏页面或 README 中告诉玩家服务器地址

## 📊 部署后的三种联机方式对比

| 方式 | 服务器 | 网络要求 | 延迟 | 费用 |
|------|--------|---------|------|------|
| P2P 在线对战 | 免费 PeerJS | 互联网 | 20-100ms | 免费 |
| 云服务器对战 | Render.com | 互联网 | 30-150ms | 免费/付费 |
| 局域网对战 | 本地 | 同一 WiFi | 5-20ms | 免费 |

## 🎯 推荐使用场景

**使用 P2P 在线对战（当前实现）：**
- ✅ 临时和朋友玩几局
- ✅ 不想花钱
- ✅ 网络环境好

**使用 Render 云服务器：**
- ✅ 想要更稳定的连接
- ✅ 多人同时在线
- ✅ 不介意 15 分钟休眠

**使用局域网对战：**
- ✅ 同一 WiFi 下
- ✅ 追求最低延迟
- ✅ 线下聚会

## 🚀 快速命令

**本地测试服务器：**
```bash
npm run server
```

**检查服务器运行：**
```bash
curl https://cabin-game-server-xxxx.onrender.com
```

**查看服务器日志：**
- 在 Render 控制台的 "Logs" 标签页

---

## 💡 下一步

1. ✅ 在 Render 部署服务器
2. ✅ 获取服务器 URL
3. ⚠️ 修改游戏代码（可选）
4. ⚠️ 推送到 GitHub 触发重新部署
5. ⚠️ 测试在线对战

**如果遇到问题**，查看 Render 的 "Logs" 标签，或者在 GitHub 提 Issue！

祝你部署成功！🎮⚔️
