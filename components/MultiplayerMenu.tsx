import React, { useState, useEffect } from 'react';
import networkManager from '../utils/NetworkManager';

interface MultiplayerMenuProps {
  isDarkTheme: boolean;
  onBack: () => void;
  onGameStart: (mode: 'host' | 'guest') => void;
}

const MultiplayerMenu: React.FC<MultiplayerMenuProps> = ({ isDarkTheme, onBack, onGameStart }) => {
  const [view, setView] = useState<'main' | 'create' | 'join'>('main');
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:3001');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // 监听连接状态
    networkManager.on('connected', () => {
      setIsConnected(true);
      setIsConnecting(false);
    });

    networkManager.on('disconnected', () => {
      setIsConnected(false);
      setIsWaiting(false);
    });

    networkManager.on('player-joined', () => {
      // 有玩家加入，等待准备
      setIsWaiting(false);
    });

    networkManager.on('game-start', () => {
      // 游戏开始
      const role = networkManager.getPlayerRole();
      onGameStart(role === 'player1' ? 'host' : 'guest');
    });

    return () => {
      networkManager.off('connected');
      networkManager.off('disconnected');
      networkManager.off('player-joined');
      networkManager.off('game-start');
    };
  }, [onGameStart]);

  const handleConnect = () => {
    setIsConnecting(true);
    setError('');
    networkManager.connect(serverUrl);
  };

  const handleCreateRoom = async () => {
    setError('');
    const result = await networkManager.createRoom();

    if (result.success && result.roomId) {
      setRoomId(result.roomId);
      setView('create');
      setIsWaiting(true);
    } else {
      setError(result.message || '创建房间失败');
    }
  };

  const handleJoinRoom = async () => {
    if (!inputRoomId.trim()) {
      setError('请输入房间 ID');
      return;
    }

    setError('');
    const result = await networkManager.joinRoom(inputRoomId.toUpperCase());

    if (result.success) {
      setRoomId(result.roomId || '');
      setView('join');
      // 自动准备
      networkManager.playerReady();
      setIsWaiting(true);
    } else {
      setError(result.message || '加入房间失败');
    }
  };

  const handleReady = () => {
    networkManager.playerReady();
    setIsWaiting(true);
  };

  const handleBack = () => {
    if (roomId) {
      networkManager.leaveRoom();
    }
    if (isConnected) {
      networkManager.disconnect();
    }
    setView('main');
    setRoomId('');
    setInputRoomId('');
    setIsWaiting(false);
    setIsConnected(false);
    setError('');
    onBack();
  };

  return (
    <div className={`absolute inset-0 flex items-center justify-center z-20 transition-colors duration-1000 ${isDarkTheme ? 'bg-[#0c0a09]/90' : 'bg-[#fafaf9]/90'}`}>
      <div className={`text-center p-12 border min-w-[500px] transition-colors duration-1000 ${isDarkTheme ? 'border-stone-800' : 'border-stone-300'}`}>
        <h2 className={`text-5xl mb-4 tracking-[0.2em] font-serif font-light transition-colors ${isDarkTheme ? 'text-stone-100' : 'text-stone-900'}`}>
          局域网联机
        </h2>
        <div className={`w-full h-[1px] my-6 transition-colors ${isDarkTheme ? 'bg-stone-800' : 'bg-stone-300'}`}></div>

        {!isConnected && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3">
              <label className={`text-sm tracking-wider ${isDarkTheme ? 'text-stone-400' : 'text-stone-600'}`}>
                服务器地址
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://192.168.1.100:3001"
                className={`px-4 py-2 border text-center tracking-wider ${
                  isDarkTheme
                    ? 'bg-stone-900 border-stone-700 text-stone-300 placeholder-stone-600'
                    : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'
                }`}
              />
              <p className={`text-xs ${isDarkTheme ? 'text-stone-600' : 'text-stone-400'}`}>
                提示：在局域网内使用服务器的 IP 地址
              </p>
            </div>

            <button
              onClick={handleConnect}
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
              {isConnecting ? '连接中...' : '连接服务器'}
            </button>
          </div>
        )}

        {isConnected && view === 'main' && (
          <div className="space-y-4">
            <button
              onClick={handleCreateRoom}
              className={`w-full py-3 border text-sm tracking-[0.2em] transition-all duration-500 ${
                isDarkTheme
                  ? 'border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-300'
                  : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-500'
              }`}
            >
              创建房间
            </button>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                placeholder="输入房间 ID"
                maxLength={6}
                className={`px-4 py-2 border text-center tracking-wider ${
                  isDarkTheme
                    ? 'bg-stone-900 border-stone-700 text-stone-300 placeholder-stone-600'
                    : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'
                }`}
              />
              <button
                onClick={handleJoinRoom}
                className={`w-full py-3 border text-sm tracking-[0.2em] transition-all duration-500 ${
                  isDarkTheme
                    ? 'border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-300'
                    : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-500'
                }`}
              >
                加入房间
              </button>
            </div>
          </div>
        )}

        {isConnected && view === 'create' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className={`text-sm tracking-wider ${isDarkTheme ? 'text-stone-400' : 'text-stone-600'}`}>
                房间 ID
              </p>
              <p className={`text-4xl tracking-[0.3em] font-mono ${isDarkTheme ? 'text-stone-100' : 'text-stone-900'}`}>
                {roomId}
              </p>
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
                准备
              </button>
            )}
          </div>
        )}

        {isConnected && view === 'join' && (
          <div className="space-y-6">
            <p className={`text-sm tracking-wider ${isDarkTheme ? 'text-stone-400' : 'text-stone-600'}`}>
              已加入房间: {roomId}
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

export default MultiplayerMenu;
