import React, { useState, useEffect } from 'react';
import p2pManager from '../utils/P2PManager';

interface OnlineMenuProps {
  isDarkTheme: boolean;
  onBack: () => void;
  onGameStart: (mode: 'host' | 'guest') => void;
}

const OnlineMenu: React.FC<OnlineMenuProps> = ({ isDarkTheme, onBack, onGameStart }) => {
  const [view, setView] = useState<'main' | 'create' | 'join'>('main');
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // 监听连接状态
    const handleConnected = () => {
      setIsConnecting(false);
    };

    const handleDisconnected = () => {
      setIsWaiting(false);
      setError('对手已断开连接');
    };

    const handlePlayerJoined = () => {
      // 有玩家加入，等待准备
      setIsWaiting(false);
    };

    const handleGameStart = () => {
      // 游戏开始
      const role = p2pManager.getRole();
      onGameStart(role === 'host' ? 'host' : 'guest');
    };

    const handlePlayerReady = () => {
      // 客人准备好了，房主可以开始游戏
      setIsWaiting(false);
    };

    p2pManager.on('connected', handleConnected);
    p2pManager.on('disconnected', handleDisconnected);
    p2pManager.on('player-joined', handlePlayerJoined);
    p2pManager.on('game-start', handleGameStart);
    p2pManager.on('player-ready', handlePlayerReady);

    return () => {
      p2pManager.off('connected', handleConnected);
      p2pManager.off('disconnected', handleDisconnected);
      p2pManager.off('player-joined', handlePlayerJoined);
      p2pManager.off('game-start', handleGameStart);
      p2pManager.off('player-ready', handlePlayerReady);
    };
  }, [onGameStart]);

  const handleCreateRoom = async () => {
    setError('');
    setIsConnecting(true);
    const result = await p2pManager.createRoom();

    if (result.success && result.roomId) {
      setRoomId(result.roomId);
      setView('create');
      setIsWaiting(true);
      setIsConnecting(false);
    } else {
      setError(result.message || '创建房间失败');
      setIsConnecting(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!inputRoomId.trim()) {
      setError('请输入房间 ID');
      return;
    }

    setError('');
    setIsConnecting(true);
    const result = await p2pManager.joinRoom(inputRoomId.trim());

    if (result.success) {
      setRoomId(inputRoomId.trim());
      setView('join');
      // 自动准备
      p2pManager.playerReady();
      setIsWaiting(true);
    } else {
      setError(result.message || '加入房间失败');
      setIsConnecting(false);
    }
  };

  const handleReady = () => {
    p2pManager.playerReady();
    setIsWaiting(true);
  };

  const handleBack = () => {
    p2pManager.disconnect();
    setView('main');
    setRoomId('');
    setInputRoomId('');
    setIsWaiting(false);
    setError('');
    onBack();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    // 可以添加一个提示
  };

  return (
    <div className={`absolute inset-0 flex items-center justify-center z-20 transition-colors duration-1000 ${isDarkTheme ? 'bg-[#0c0a09]/90' : 'bg-[#fafaf9]/90'}`}>
      <div className={`text-center p-12 border min-w-[500px] transition-colors duration-1000 ${isDarkTheme ? 'border-stone-800' : 'border-stone-300'}`}>
        <h2 className={`text-5xl mb-4 tracking-[0.2em] font-serif font-light transition-colors ${isDarkTheme ? 'text-stone-100' : 'text-stone-900'}`}>
          在线对战
        </h2>
        <div className={`w-full h-[1px] my-6 transition-colors ${isDarkTheme ? 'bg-stone-800' : 'bg-stone-300'}`}></div>

        <p className={`text-xs mb-6 ${isDarkTheme ? 'text-stone-600' : 'text-stone-400'}`}>
          🌐 使用 P2P 技术，直接连接对手
        </p>

        {view === 'main' && (
          <div className="space-y-4">
            <button
              onClick={handleCreateRoom}
              disabled={isConnecting}
              className={`w-full py-3 border text-sm tracking-[0.2em] transition-all duration-500 ${
                isConnecting
                  ? isDarkTheme
                    ? 'border-stone-800 text-stone-700'
                    : 'border-stone-200 text-stone-300'
                  : isDarkTheme
                  ? 'border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-300'
                  : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-500'
              }`}
            >
              {isConnecting ? '创建中...' : '创建房间'}
            </button>

            <div className={`w-full h-[1px] my-4 transition-colors ${isDarkTheme ? 'bg-stone-800' : 'bg-stone-300'}`}></div>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                placeholder="输入房间 ID"
                className={`px-4 py-2 border text-center tracking-wider font-mono ${
                  isDarkTheme
                    ? 'bg-stone-900 border-stone-700 text-stone-300 placeholder-stone-600'
                    : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'
                }`}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinRoom();
                  }
                }}
              />
              <button
                onClick={handleJoinRoom}
                disabled={isConnecting}
                className={`w-full py-3 border text-sm tracking-[0.2em] transition-all duration-500 ${
                  isConnecting
                    ? isDarkTheme
                      ? 'border-stone-800 text-stone-700'
                      : 'border-stone-200 text-stone-300'
                    : isDarkTheme
                    ? 'border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-300'
                    : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-500'
                }`}
              >
                {isConnecting ? '连接中...' : '加入房间'}
              </button>
            </div>
          </div>
        )}

        {view === 'create' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className={`text-sm tracking-wider ${isDarkTheme ? 'text-stone-400' : 'text-stone-600'}`}>
                房间 ID
              </p>
              <div className="relative">
                <p className={`text-3xl tracking-[0.3em] font-mono ${isDarkTheme ? 'text-stone-100' : 'text-stone-900'}`}>
                  {roomId}
                </p>
                <button
                  onClick={copyRoomId}
                  className={`mt-2 text-xs ${isDarkTheme ? 'text-stone-500 hover:text-stone-300' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  📋 点击复制
                </button>
              </div>
              <p className={`text-xs ${isDarkTheme ? 'text-stone-600' : 'text-stone-400'}`}>
                将此 ID 分享给你的朋友
              </p>
            </div>

            {isWaiting ? (
              <p className={`text-sm animate-pulse ${isDarkTheme ? 'text-stone-500' : 'text-stone-500'}`}>
                等待对手加入...
              </p>
            ) : (
              <button
                onClick={handleReady}
                className={`w-full py-3 border text-sm tracking-[0.2em] transition-all duration-500 ${
                  isDarkTheme
                    ? 'border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-300'
                    : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-500'
                }`}
              >
                准备开始
              </button>
            )}
          </div>
        )}

        {view === 'join' && (
          <div className="space-y-6">
            <p className={`text-sm tracking-wider ${isDarkTheme ? 'text-stone-400' : 'text-stone-600'}`}>
              已连接到房间
            </p>

            <p className={`text-3xl tracking-[0.3em] font-mono ${isDarkTheme ? 'text-stone-100' : 'text-stone-900'}`}>
              {roomId}
            </p>

            <p className={`text-sm animate-pulse ${isDarkTheme ? 'text-stone-500' : 'text-stone-500'}`}>
              等待房主开始游戏...
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className={`mt-8 pt-6 border-t ${isDarkTheme ? 'border-stone-800' : 'border-stone-300'}`}>
          <button
            onClick={handleBack}
            className={`px-12 py-3 border text-sm tracking-[0.2em] transition-all duration-500 ${
              isDarkTheme
                ? 'border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-300'
                : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-500'
            }`}
          >
            返回
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnlineMenu;
