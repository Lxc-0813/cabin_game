import Peer, { DataConnection } from 'peerjs';

export type P2PRole = 'host' | 'guest';

export interface GameStateData {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  stamina: number;
}

export interface AttackData {
  attackType: 'thrust' | 'slash';
  target: { x: number; y: number };
}

export interface DashData {
  moveVec: { x: number; y: number };
}

export interface WallData {
  target: { x: number; y: number };
}

class P2PManager {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private role: P2PRole | null = null;
  private peerId: string | null = null;
  private isConnected: boolean = false;

  // 事件监听器
  private listeners: Map<string, Function[]> = new Map();

  constructor() {}

  // 初始化 Peer（创建房间）
  async createRoom(): Promise<{ success: boolean; roomId?: string; message?: string }> {
    return new Promise((resolve) => {
      try {
        console.log('开始创建 Peer 连接...');

        // 使用免费的 PeerJS 云服务器，配置多个备用 STUN 服务器
        this.peer = new Peer({
          // 使用默认的免费 PeerJS 云服务器
          host: '0.peerjs.com',
          port: 443,
          path: '/',
          secure: true,
          config: {
            iceServers: [
              // Google 公共 STUN 服务器
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              // Twilio STUN 服务器
              { urls: 'stun:global.stun.twilio.com:3478' },
              // Mozilla STUN 服务器
              { urls: 'stun:stun.services.mozilla.com' }
            ]
          },
          debug: 2 // 开启调试日志
        });

        let resolved = false;

        this.peer.on('open', (id) => {
          this.peerId = id;
          this.role = 'host';
          console.log('房间创建成功，ID:', id);

          // 立即返回成功，不等待玩家加入
          if (!resolved) {
            resolved = true;
            resolve({ success: true, roomId: id });
          }

          // 监听连接
          this.peer!.on('connection', (conn) => {
            this.handleConnection(conn);
          });
        });

        this.peer.on('error', (err) => {
          console.error('Peer 错误:', err);
          console.error('错误类型:', err.type);
          if (!resolved) {
            resolved = true;
            let errorMsg = `连接失败: ${err.message}`;

            // 根据错误类型提供更友好的提示
            if (err.type === 'network') {
              errorMsg = '网络错误，无法连接到服务器。请检查网络连接或尝试刷新页面。';
            } else if (err.type === 'server-error') {
              errorMsg = '服务器错误，请稍后重试。';
            } else if (err.type === 'unavailable-id') {
              errorMsg = '房间 ID 已被占用，请刷新页面重试。';
            }

            resolve({ success: false, message: errorMsg });
          }
        });

        // 超时处理（增加到 15 秒，因为有时服务器响应较慢）
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.error('创建房间超时');
            resolve({
              success: false,
              message: '连接超时。可能原因：\n1. 网络连接问题\n2. 防火墙阻止连接\n3. 请尝试刷新页面重试'
            });
          }
        }, 15000);
      } catch (err: any) {
        resolve({ success: false, message: `创建失败: ${err.message}` });
      }
    });
  }

  // 加入房间
  async joinRoom(roomId: string): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      try {
        console.log('开始连接到房间:', roomId);

        // 创建自己的 Peer，使用相同配置
        this.peer = new Peer({
          host: '0.peerjs.com',
          port: 443,
          path: '/',
          secure: true,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
              { urls: 'stun:stun.services.mozilla.com' }
            ]
          },
          debug: 2
        });

        let resolved = false;

        this.peer.on('open', (id) => {
          this.peerId = id;
          this.role = 'guest';
          console.log('正在连接到房间:', roomId);

          // 连接到房主
          const conn = this.peer!.connect(roomId, {
            reliable: true
          });

          this.handleConnection(conn);

          conn.on('open', () => {
            console.log('成功连接到房间');
            if (!resolved) {
              resolved = true;
              resolve({ success: true });
            }
          });

          conn.on('error', (err) => {
            console.error('连接错误:', err);
            if (!resolved) {
              resolved = true;
              resolve({ success: false, message: `连接失败: ${err}` });
            }
          });

          // 超时处理
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve({ success: false, message: '连接超时，请检查房间ID是否正确' });
            }
          }, 10000);
        });

        this.peer.on('error', (err) => {
          console.error('Peer 错误:', err);
          console.error('错误类型:', err.type);
          if (!resolved) {
            resolved = true;
            let errorMsg = `连接失败: ${err.message}`;

            if (err.type === 'network') {
              errorMsg = '网络错误，请检查网络连接。';
            } else if (err.type === 'peer-unavailable') {
              errorMsg = '房间不存在或已关闭，请检查房间 ID。';
            } else if (err.type === 'server-error') {
              errorMsg = '服务器错误，请稍后重试。';
            }

            resolve({ success: false, message: errorMsg });
          }
        });
      } catch (err: any) {
        resolve({ success: false, message: `加入失败: ${err.message}` });
      }
    });
  }

  // 处理连接
  private handleConnection(conn: DataConnection) {
    this.connection = conn;

    conn.on('open', () => {
      this.isConnected = true;
      console.log('P2P 连接已建立');
      this.emit('connected', { peerId: conn.peer });

      // 如果是房主，通知游戏可以开始
      if (this.role === 'host') {
        this.emit('player-joined', { peerId: conn.peer });
      }
    });

    conn.on('data', (data: any) => {
      this.handleMessage(data);
    });

    conn.on('close', () => {
      this.isConnected = false;
      console.log('P2P 连接已关闭');
      this.emit('disconnected', {});
    });

    conn.on('error', (err) => {
      console.error('连接错误:', err);
      this.emit('error', { error: err });
    });
  }

  // 处理接收到的消息
  private handleMessage(data: any) {
    const { type, payload } = data;

    switch (type) {
      case 'game-start':
        this.emit('game-start', payload);
        break;
      case 'player-ready':
        this.emit('player-ready', payload);
        break;
      case 'game-state':
        this.emit('opponent-state', payload);
        break;
      case 'attack':
        this.emit('opponent-attack', payload);
        break;
      case 'move':
        this.emit('opponent-move', payload);
        break;
      case 'dash':
        this.emit('opponent-dash', payload);
        break;
      case 'wall':
        this.emit('opponent-wall', payload);
        break;
      case 'hit':
        this.emit('player-hit', payload);
        break;
      case 'round-end':
        this.emit('round-ended', payload);
        break;
      case 'score-update':
        this.emit('score-update', payload);
        break;
    }
  }

  // 发送消息
  private send(type: string, payload: any = {}) {
    if (this.connection && this.connection.open) {
      this.connection.send({ type, payload });
    }
  }

  // 玩家准备
  playerReady() {
    if (this.role === 'host') {
      // 房主准备后直接开始游戏
      this.send('game-start', {
        difficulty: 'duelist',
        playerStyle: 'heavy'
      });
      this.emit('game-start', {
        difficulty: 'duelist',
        playerStyle: 'heavy'
      });
    } else {
      // 客人准备后通知房主
      this.send('player-ready', {});
    }
  }

  // 同步游戏状态
  syncGameState(state: GameStateData) {
    this.send('game-state', { state });
  }

  // 同步攻击
  syncAttack(attackData: AttackData) {
    this.send('attack', attackData);
  }

  // 同步移动
  syncMove(position: { x: number; y: number }, velocity: { x: number; y: number }) {
    this.send('move', { position, velocity });
  }

  // 同步冲刺
  syncDash(moveVec: { x: number; y: number }) {
    this.send('dash', { moveVec });
  }

  // 同步墙壁
  syncWall(target: { x: number; y: number }) {
    this.send('wall', { target });
  }

  // 同步击中
  syncHit(victim: string) {
    this.send('hit', { victim });
  }

  // 同步回合结束
  syncRoundEnd(winner: string) {
    this.send('round-end', { winner });
  }

  // 同步比分
  syncScore(score: { player: number; ai: number }) {
    this.send('score-update', { score });
  }

  // 断开连接
  disconnect() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isConnected = false;
    this.peerId = null;
    this.role = null;
  }

  // 监听事件
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  // 移除监听
  off(event: string, callback?: Function) {
    if (!callback) {
      this.listeners.delete(event);
    } else {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  // 触发事件
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Getters
  getPeerId() {
    return this.peerId;
  }

  getRole() {
    return this.role;
  }

  getIsConnected() {
    return this.isConnected;
  }
}

// 单例模式
const p2pManager = new P2PManager();
export default p2pManager;
