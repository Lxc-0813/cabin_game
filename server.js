const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 房间管理
const rooms = new Map();

// 生成房间 ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 房间数据结构
class Room {
  constructor(id, hostId) {
    this.id = id;
    this.hostId = hostId;
    this.players = new Map(); // socketId -> playerData
    this.gameState = 'waiting'; // waiting, playing, finished
    this.difficulty = 'duelist';
    this.playerStyle = 'heavy';
  }

  addPlayer(socketId, playerData) {
    if (this.players.size >= 2) return false;
    this.players.set(socketId, playerData);
    return true;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  getPlayerRole(socketId) {
    const keys = Array.from(this.players.keys());
    return keys.indexOf(socketId) === 0 ? 'player1' : 'player2';
  }

  isFull() {
    return this.players.size >= 2;
  }

  isEmpty() {
    return this.players.size === 0;
  }
}

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  // 创建房间
  socket.on('create-room', (callback) => {
    const roomId = generateRoomId();
    const room = new Room(roomId, socket.id);

    room.addPlayer(socket.id, {
      id: socket.id,
      role: 'player1',
      ready: false
    });

    rooms.set(roomId, room);
    socket.join(roomId);

    console.log(`房间创建: ${roomId} by ${socket.id}`);
    callback({ success: true, roomId, role: 'player1' });
  });

  // 加入房间
  socket.on('join-room', (roomId, callback) => {
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, message: '房间不存在' });
      return;
    }

    if (room.isFull()) {
      callback({ success: false, message: '房间已满' });
      return;
    }

    const success = room.addPlayer(socket.id, {
      id: socket.id,
      role: 'player2',
      ready: false
    });

    if (success) {
      socket.join(roomId);
      console.log(`玩家加入房间: ${socket.id} -> ${roomId}`);

      // 通知房主有新玩家加入
      socket.to(roomId).emit('player-joined', {
        playerId: socket.id,
        role: 'player2'
      });

      callback({
        success: true,
        roomId,
        role: 'player2',
        hostId: room.hostId
      });
    } else {
      callback({ success: false, message: '加入房间失败' });
    }
  });

  // 获取房间列表
  socket.on('get-rooms', (callback) => {
    const availableRooms = Array.from(rooms.values())
      .filter(room => !room.isFull() && room.gameState === 'waiting')
      .map(room => ({
        id: room.id,
        players: room.players.size,
        maxPlayers: 2
      }));

    callback(availableRooms);
  });

  // 玩家准备
  socket.on('player-ready', (data) => {
    const { roomId } = data;
    const room = rooms.get(roomId);

    if (room && room.players.has(socket.id)) {
      const player = room.players.get(socket.id);
      player.ready = true;

      // 检查所有玩家是否都准备好了
      const allReady = Array.from(room.players.values()).every(p => p.ready);

      socket.to(roomId).emit('player-ready', { playerId: socket.id });

      if (allReady && room.players.size === 2) {
        room.gameState = 'playing';
        io.to(roomId).emit('game-start', {
          difficulty: room.difficulty,
          playerStyle: room.playerStyle
        });
      }
    }
  });

  // 游戏状态同步
  socket.on('game-state', (data) => {
    const { roomId, state } = data;
    const room = rooms.get(roomId);

    if (room) {
      // 广播给房间内其他玩家
      socket.to(roomId).emit('opponent-state', {
        playerId: socket.id,
        state
      });
    }
  });

  // 攻击动作同步
  socket.on('attack', (data) => {
    const { roomId, attackType, target } = data;
    const room = rooms.get(roomId);

    if (room) {
      socket.to(roomId).emit('opponent-attack', {
        playerId: socket.id,
        attackType,
        target
      });
    }
  });

  // 移动同步
  socket.on('move', (data) => {
    const { roomId, position, velocity } = data;
    const room = rooms.get(roomId);

    if (room) {
      socket.to(roomId).emit('opponent-move', {
        playerId: socket.id,
        position,
        velocity
      });
    }
  });

  // 冲刺同步
  socket.on('dash', (data) => {
    const { roomId, moveVec } = data;
    const room = rooms.get(roomId);

    if (room) {
      socket.to(roomId).emit('opponent-dash', {
        playerId: socket.id,
        moveVec
      });
    }
  });

  // 墙壁同步
  socket.on('wall', (data) => {
    const { roomId, target } = data;
    const room = rooms.get(roomId);

    if (room) {
      socket.to(roomId).emit('opponent-wall', {
        playerId: socket.id,
        target
      });
    }
  });

  // 击中同步
  socket.on('hit', (data) => {
    const { roomId, victim } = data;
    const room = rooms.get(roomId);

    if (room) {
      io.to(roomId).emit('player-hit', {
        attacker: socket.id,
        victim
      });
    }
  });

  // 回合结束
  socket.on('round-end', (data) => {
    const { roomId, winner } = data;
    const room = rooms.get(roomId);

    if (room) {
      io.to(roomId).emit('round-ended', {
        winner
      });
    }
  });

  // 离开房间
  socket.on('leave-room', (roomId) => {
    leaveRoom(socket, roomId);
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);

    // 从所有房间中移除该玩家
    rooms.forEach((room, roomId) => {
      if (room.players.has(socket.id)) {
        leaveRoom(socket, roomId);
      }
    });
  });
});

function leaveRoom(socket, roomId) {
  const room = rooms.get(roomId);

  if (room) {
    room.removePlayer(socket.id);
    socket.leave(roomId);

    // 通知房间内其他玩家
    socket.to(roomId).emit('player-left', { playerId: socket.id });

    // 如果房间为空，删除房间
    if (room.isEmpty()) {
      rooms.delete(roomId);
      console.log(`房间删除: ${roomId}`);
    }
  }
}

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`WebSocket 服务器运行在端口 ${PORT}`);
  console.log(`局域网地址: http://YOUR_LOCAL_IP:${PORT}`);
});
