import { io, Socket } from 'socket.io-client';

export type GameMode = 'local' | 'online';
export type PlayerRole = 'player1' | 'player2';

export interface NetworkState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  stamina: number;
}

export interface AttackData {
  attackType: 'thrust' | 'slash';
  target: { x: number; y: number };
}

class NetworkManager {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private playerRole: PlayerRole | null = null;
  private isConnected: boolean = false;
  private serverUrl: string = 'http://localhost:3001';

  // 事件监听器
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    // 不在构造函数中连接，等待手动调用
  }

  // 连接到服务器
  connect(url?: string) {
    if (url) {
      this.serverUrl = url;
    }

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  // 设置事件监听
  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('已连接到服务器:', this.socket?.id);
      this.isConnected = true;
      this.emit('connected', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', () => {
      console.log('已断开连接');
      this.isConnected = false;
      this.emit('disconnected', {});
    });

    this.socket.on('player-joined', (data) => {
      console.log('玩家加入:', data);
      this.emit('player-joined', data);
    });

    this.socket.on('player-left', (data) => {
      console.log('玩家离开:', data);
      this.emit('player-left', data);
    });

    this.socket.on('player-ready', (data) => {
      console.log('玩家准备:', data);
      this.emit('player-ready', data);
    });

    this.socket.on('game-start', (data) => {
      console.log('游戏开始:', data);
      this.emit('game-start', data);
    });

    this.socket.on('opponent-state', (data) => {
      this.emit('opponent-state', data);
    });

    this.socket.on('opponent-attack', (data) => {
      this.emit('opponent-attack', data);
    });

    this.socket.on('opponent-move', (data) => {
      this.emit('opponent-move', data);
    });

    this.socket.on('opponent-dash', (data) => {
      this.emit('opponent-dash', data);
    });

    this.socket.on('opponent-wall', (data) => {
      this.emit('opponent-wall', data);
    });

    this.socket.on('player-hit', (data) => {
      this.emit('player-hit', data);
    });

    this.socket.on('round-ended', (data) => {
      this.emit('round-ended', data);
    });

    this.socket.on('score-update', (data) => {
      this.emit('score-update', data);
    });
  }

  // 创建房间
  createRoom(): Promise<{ success: boolean; roomId?: string; role?: PlayerRole; message?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, message: '未连接到服务器' });
        return;
      }

      this.socket.emit('create-room', (response: any) => {
        if (response.success) {
          this.roomId = response.roomId;
          this.playerRole = response.role;
        }
        resolve(response);
      });
    });
  }

  // 加入房间
  joinRoom(roomId: string): Promise<{ success: boolean; roomId?: string; role?: PlayerRole; message?: string }> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ success: false, message: '未连接到服务器' });
        return;
      }

      this.socket.emit('join-room', roomId, (response: any) => {
        if (response.success) {
          this.roomId = response.roomId;
          this.playerRole = response.role;
        }
        resolve(response);
      });
    });
  }

  // 获取房间列表
  getRooms(): Promise<any[]> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve([]);
        return;
      }

      this.socket.emit('get-rooms', (rooms: any[]) => {
        resolve(rooms);
      });
    });
  }

  // 玩家准备
  playerReady() {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('player-ready', {
      roomId: this.roomId
    });
  }

  // 同步游戏状态
  syncGameState(state: NetworkState) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('game-state', {
      roomId: this.roomId,
      state
    });
  }

  // 同步攻击
  syncAttack(attackData: AttackData) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('attack', {
      roomId: this.roomId,
      ...attackData
    });
  }

  // 同步移动
  syncMove(position: { x: number; y: number }, velocity: { x: number; y: number }) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('move', {
      roomId: this.roomId,
      position,
      velocity
    });
  }

  // 同步冲刺
  syncDash(moveVec: { x: number; y: number }) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('dash', {
      roomId: this.roomId,
      moveVec
    });
  }

  // 同步墙壁
  syncWall(target: { x: number; y: number }) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('wall', {
      roomId: this.roomId,
      target
    });
  }

  // 同步击中
  syncHit(victim: string) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('hit', {
      roomId: this.roomId,
      victim
    });
  }

  // 同步比分
  syncScore(score: { player: number; ai: number }) {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('score-update', {
      roomId: this.roomId,
      score
    });
  }

  // 离开房间
  leaveRoom() {
    if (!this.socket || !this.roomId) return;

    this.socket.emit('leave-room', this.roomId);
    this.roomId = null;
    this.playerRole = null;
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.roomId = null;
      this.playerRole = null;
    }
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
  getSocket() {
    return this.socket;
  }

  getRoomId() {
    return this.roomId;
  }

  getPlayerRole() {
    return this.playerRole;
  }

  getIsConnected() {
    return this.isConnected;
  }
}

// 单例模式
const networkManager = new NetworkManager();
export default networkManager;
