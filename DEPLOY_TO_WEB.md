# 🌐 发布到网页 - 超简单教程

按照这个教程，你就能让游戏像这样在线玩：`https://你的用户名.github.io/cabin_game/`

## 📝 准备工作

### 1. 注册 GitHub 账号（如果还没有）

1. 打开 https://github.com
2. 点击右上角的 "Sign up"（注册）
3. 填写：
   - Email（邮箱）
   - Password（密码）
   - Username（用户名）- **记住这个，后面要用**
4. 完成邮箱验证

### 2. 安装 Git（如果还没有）

1. 下载 Git：https://git-scm.com/download/win
2. 双击安装，一路点 "Next"
3. 安装完成

### 3. 验证 Git 是否安装成功

1. 按 `Win + R`，输入 `cmd`，按回车
2. 输入 `git --version`
3. 如果显示版本号，说明安装成功

## 🚀 开始部署（5 步搞定）

### 第 1 步：在 GitHub 创建仓库

1. 登录 GitHub
2. 点击右上角的 "+" 号
3. 选择 "New repository"
4. 填写：
   - Repository name：`cabin_game`（必须这样写，因为代码里配置的是这个名字）
   - 选择 "Public"（公开）
   - **不要**勾选 "Add a README file"
5. 点击 "Create repository"

### 第 2 步：配置 Git（第一次使用需要）

在游戏文件夹打开命令提示符，输入：

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub邮箱"
```

### 第 3 步：上传代码到 GitHub

还是在游戏文件夹的命令提示符中，**一行一行**输入下面的命令：

```bash
git init
```
按回车，等待完成

```bash
git add .
```
按回车，等待完成

```bash
git commit -m "初始提交"
```
按回车，等待完成

```bash
git branch -M main
```
按回车，等待完成

```bash
git remote add origin https://github.com/你的用户名/cabin_game.git
```
**注意：把 `你的用户名` 替换成你自己的 GitHub 用户名**
按回车，等待完成

```bash
git push -u origin main
```
按回车，可能需要输入 GitHub 账号和密码（或 token）

### 第 4 步：启用 GitHub Pages

1. 打开你的仓库页面：`https://github.com/你的用户名/cabin_game`
2. 点击上方的 "Settings"（设置）
3. 在左侧菜单找到 "Pages"
4. 在 "Build and deployment" 下：
   - Source 选择：**GitHub Actions**
5. 不要点其他的，直接关闭页面

### 第 5 步：等待部署完成

1. 回到仓库首页
2. 点击上方的 "Actions" 标签
3. 你会看到一个正在运行的工作流（黄色圆圈）
4. 等待变成绿色的勾（大约 2-3 分钟）
5. 部署成功！

## 🎮 访问你的游戏

打开浏览器，输入：

```
https://你的用户名.github.io/cabin_game/
```

**把 `你的用户名` 替换成你的 GitHub 用户名**

游戏就可以玩了！🎉

## 📤 分享给朋友

直接把这个网址发给朋友：

```
https://你的用户名.github.io/cabin_game/
```

他们打开就能玩，不需要下载任何东西！

## 🔄 更新游戏（修改代码后）

如果你修改了游戏代码，想更新网页版：

```bash
git add .
git commit -m "更新游戏"
git push
```

等待几分钟，网页版就自动更新了！

## ⚠️ 重要提示

### 网页版只能单机玩

网页版**不支持局域网联机**，因为：
- GitHub Pages 只能托管静态网页
- 不能运行 WebSocket 服务器

如果要联机，必须按照 `BEGINNER_GUIDE.md` 里的方法在本地运行。

### 修改仓库名会导致无法访问

如果你的仓库名不是 `cabin_game`，需要修改 `vite.config.ts` 文件：

找到这一行：
```typescript
base: mode === 'production' ? '/cabin_game/' : '/',
```

把 `/cabin_game/` 改成 `/你的仓库名/`

## 🆘 常见问题

### Q1: 输入 git push 要求输入密码？

**A:** GitHub 现在不支持密码登录，需要使用 Personal Access Token（个人访问令牌）

1. 登录 GitHub
2. 点击右上角头像 → Settings
3. 左侧最下面 → Developer settings
4. Personal access tokens → Tokens (classic)
5. Generate new token → Generate new token (classic)
6. 填写 Note（随便写），选择 Expiration（有效期）
7. 勾选 "repo" 权限
8. 点击最下面的 "Generate token"
9. **复制生成的 token**（只显示一次）
10. 在 git push 时，密码处粘贴这个 token

### Q2: 网页打开后是 404 Not Found？

**A:** 检查：
1. 等待是否超过 5 分钟（第一次部署可能比较慢）
2. 仓库名是否是 `cabin_game`
3. GitHub Pages 是否选择了 "GitHub Actions"
4. Actions 标签页里的部署是否成功（绿色勾）

### Q3: 游戏打开了但是是空白页？

**A:** 按 F12 打开浏览器开发者工具，看 Console 有没有错误。通常是：
- 资源加载失败 → 检查 vite.config.ts 的 base 路径是否正确
- 刷新浏览器缓存（Ctrl + F5）

### Q4: 想要自定义域名（不用 github.io）？

**A:**
1. 购买一个域名（阿里云、腾讯云等）
2. 在 GitHub 仓库的 Settings → Pages → Custom domain 输入你的域名
3. 在域名服务商添加 DNS 记录指向 GitHub

## 🎯 快速命令参考

第一次部署：
```bash
git init
git add .
git commit -m "初始提交"
git branch -M main
git remote add origin https://github.com/你的用户名/cabin_game.git
git push -u origin main
```

以后更新：
```bash
git add .
git commit -m "更新说明"
git push
```

---

完成这些步骤后，你的游戏就在互联网上了，世界各地的人都能访问！🌍
