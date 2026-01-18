import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import MultiplayerMenu from './MultiplayerMenu';
import OnlineMenu from './OnlineMenu';
import networkManager from '../utils/NetworkManager';
import p2pManager from '../utils/P2PManager';

// Types
type Point = { x: number; y: number };
type GameState = 'menu' | 'playing' | 'win' | 'lose' | 'multiplayer' | 'online-p2p';
type GameMode = 'local' | 'online' | 'p2p';
type Difficulty = 'novice' | 'duelist' | 'grandmaster' | 'inferno';
type PlayerStyle = 'heavy' | 'light'; 

type AttackType = 'thrust' | 'slash';

type BladeObject = {
  type: AttackType;
  p1: Point; 
  p2: Point; 
  vector: Point;
  createdAt: number;
  duration: number;
  owner: 'player' | 'ai';
  id: number;
  active: boolean; 
  color: string;
};

type WallObject = {
    x: number;
    y: number;
    angle: number; // Perpendicular facing
    createdAt: number;
    duration: number;
    owner: 'player' | 'ai';
};

type GhostObject = {
    x: number;
    y: number;
    color: string;
    life: number; // 0 to 1
    createdAt: number;
};

// --- Sound System ---
const SoundSys = {
    ctx: null as AudioContext | null,
    muted: false,
    
    init: () => {
        if (!SoundSys.ctx) {
            SoundSys.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (SoundSys.ctx.state === 'suspended') SoundSys.ctx.resume();
    },

    playTone: (freq: number, type: OscillatorType, duration: number, vol: number = 0.1, rampTo: number = 0.01) => {
        if (!SoundSys.ctx || SoundSys.muted) return;
        const t = SoundSys.ctx.currentTime;
        const osc = SoundSys.ctx.createOscillator();
        const gain = SoundSys.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(rampTo, t + duration);
        
        osc.connect(gain).connect(SoundSys.ctx.destination);
        osc.start(t);
        osc.stop(t + duration);
    },

    playNoise: (duration: number, filterFreq: number = 3000, type: 'highpass' | 'lowpass' | 'bandpass' = 'bandpass') => {
        if (!SoundSys.ctx || SoundSys.muted) return;
        const t = SoundSys.ctx.currentTime;
        const bufferSize = SoundSys.ctx.sampleRate * duration;
        const buffer = SoundSys.ctx.createBuffer(1, bufferSize, SoundSys.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = SoundSys.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = SoundSys.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(filterFreq, t);
        if (type === 'bandpass') filter.Q.value = 0.5;

        const gain = SoundSys.ctx.createGain();
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(filter).connect(gain).connect(SoundSys.ctx.destination);
        noise.start(t);
    },

    sfx: {
        thrust: () => {
            if (!SoundSys.ctx || SoundSys.muted) return;
            SoundSys.playNoise(0.15, 4000, 'highpass');
            SoundSys.playTone(600, 'triangle', 0.1, 0.05); 
        },
        slash: () => {
             if (!SoundSys.ctx || SoundSys.muted) return;
             SoundSys.playNoise(0.2, 2500, 'highpass');
             SoundSys.playTone(400, 'sawtooth', 0.15, 0.03); 
        },
        clash: () => {
            if (!SoundSys.ctx || SoundSys.muted) return;
            const t = SoundSys.ctx.currentTime;
            const osc = SoundSys.ctx.createOscillator();
            const gain = SoundSys.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(2000 + Math.random() * 1000, t); 
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5); 
            osc.connect(gain).connect(SoundSys.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.5);
            SoundSys.playTone(800, 'square', 0.05, 0.1); 
            SoundSys.playNoise(0.05, 5000, 'highpass'); 
        },
        parrySuccess: () => {
             if (!SoundSys.ctx || SoundSys.muted) return;
             SoundSys.playTone(1500, 'square', 0.1, 0.1);
             SoundSys.playTone(3000, 'sine', 0.3, 0.1); 
        },
        hit: () => {
            if (!SoundSys.ctx || SoundSys.muted) return;
            SoundSys.playTone(100, 'sine', 0.3, 0.4);
            SoundSys.playNoise(0.1, 100, 'lowpass');
        },
        shieldBreak: () => {
            if (!SoundSys.ctx || SoundSys.muted) return;
            SoundSys.playTone(800, 'sawtooth', 0.1, 0.1);
            SoundSys.playNoise(0.1, 800, 'lowpass');
        },
        dash: () => {
            if (!SoundSys.ctx || SoundSys.muted) return;
            SoundSys.playNoise(0.2, 3000, 'bandpass');
        },
        wall: () => {
             if (!SoundSys.ctx || SoundSys.muted) return;
             SoundSys.playTone(3000, 'sawtooth', 0.1, 0.05);
        },
        win: () => {
            if (!SoundSys.ctx || SoundSys.muted) return;
            setTimeout(() => SoundSys.playTone(880, 'sine', 0.5, 0.1), 0);
            setTimeout(() => SoundSys.playTone(1108, 'sine', 0.5, 0.1), 100);
            setTimeout(() => SoundSys.playTone(1318, 'sine', 1.0, 0.1), 200);
        },
        start: () => {
             SoundSys.playTone(200, 'triangle', 0.5, 0.1);
        },
        focus: () => {
            if (!SoundSys.ctx || SoundSys.muted) return;
            SoundSys.playTone(100, 'sine', 1.0, 0.3); 
            SoundSys.playTone(2000, 'sine', 0.5, 0.05);
        }
    }
};


const FencingGame = () => {
  // --- Configuration ---
  const ARENA_WIDTH = 1200;
  const ARENA_HEIGHT = 800;
  const PLAYER_RADIUS = 20;
  
  const FRICTION = 0.85; 
  const MOVE_SPEED = 0.8;
  const SPRINT_MULTIPLIER = 1.7; 
  const DASH_FORCE = 35; 
  const RECOIL_FORCE = 12;
  
  const THRUST_RANGE = 230;
  const THRUST_DURATION = 350; 
  const THRUST_LUNGE_FORCE = 22; 
  
  const SLASH_RANGE = 130; 
  const SLASH_DURATION = 280; 
  
  const STAMINA_MAX = 150; 
  const STAMINA_REGEN = 0.5;
  const DASH_COST = 30;
  const DASH_DURATION_MS = 350; 
  
  // Q BUFF
  const WALL_COST = 30; 
  const WALL_DURATION = 12000; 
  
  const FOCUS_MAX = 100;

  // --- State ---
  const [gameState, setGameState] = useState<GameState>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('local');
  const [difficulty, setDifficulty] = useState<Difficulty>('duelist');
  const [playerStyle, setPlayerStyle] = useState<PlayerStyle>('heavy');
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [muted, setMuted] = useState(false);
  const [focusMode, setFocusMode] = useState(false); // React state for UI syncing
  const [scale, setScale] = useState(1);
  const [isHost, setIsHost] = useState(false); // 是否是房主

  // Theme State derived from Difficulty
  const isDarkTheme = difficulty === 'inferno';
  
  // --- Theme Colors (Dynamic) ---
  const theme = {
      bg: isDarkTheme ? '#0c0a09' : '#fafaf9', // Stone-950 (Void) vs Stone-50 (Paper)
      grid: isDarkTheme ? '#1c1917' : '#e7e5e4', // Subtle grid
      text: isDarkTheme ? '#e5e5e5' : '#1c1917', // Text color
      subtext: isDarkTheme ? '#78716c' : '#a8a29e', 
      
      p1: isDarkTheme ? '#e5e5e5' : '#1c1917', // Player: Silver in Dark, Ink in Light
      p1_blade: isDarkTheme ? '#fafafa' : '#000000',
      p1_accent: isDarkTheme ? '#22d3ee' : '#0ea5e9', // Cyan vs Sky Blue

      p2: isDarkTheme ? '#7f1d1d' : '#991b1b', // Enemy: Dark Red vs Cinnabar
      p2_blade: isDarkTheme ? '#dc2626' : '#b91c1c',
      p2_accent: isDarkTheme ? '#fbbf24' : '#d97706', // Gold vs Amber
  };

  const scoreRef = useRef({ player: 0, ai: 0 }); 
  const roundHits = useRef({ player: 0, ai: 0 }); 

  // Refs
  const playerPos = useRef<Point>({ x: 300, y: 400 });
  const aiPos = useRef<Point>({ x: 900, y: 400 });
  const playerVel = useRef<Point>({ x: 0, y: 0 });
  const aiVel = useRef<Point>({ x: 0, y: 0 });
  
  const camera = useRef({ x: 0, y: 0, zoom: 1 });

  const playerInvulnUntil = useRef(0);
  const aiInvulnUntil = useRef(0);

  const playerTrail = useRef<Point[]>([]);
  const aiTrail = useRef<Point[]>([]);
  const ghosts = useRef<GhostObject[]>([]); 

  const activeBlades = useRef<BladeObject[]>([]);
  const activeWalls = useRef<WallObject[]>([]);
  const particles = useRef<any[]>([]);
  const combatTexts = useRef<any[]>([]);
  
  const playerStamina = useRef(STAMINA_MAX);
  const aiStamina = useRef(STAMINA_MAX);
  
  const playerFocus = useRef(0);
  const focusActive = useRef(false);
  const focusTimer = useRef(0);
  
  const playerCooldown = useRef(0);
  const aiCooldown = useRef(0);
  const dashCooldown = useRef(0);
  const wallCooldown = useRef(0);
  
  const playerSlashCombo = useRef({ count: 0, lastTime: 0 });
  const aiSlashCombo = useRef({ count: 0, lastTime: 0 });
  
  const aiActionTimer = useRef(0); 
  const aiState = useRef<'neutral' | 'aggressive' | 'defensive' | 'feint'>('neutral');
  const aiTargetOffset = useRef<Point>({x: 0, y: 0}); 
  const aiStateChangeTimer = useRef(0);

  const mousePos = useRef<Point>({ x: 0, y: 0 });
  const keys = useRef<{ [key: string]: boolean }>({});
  
  const requestRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shake = useRef(0);
  const flash = useRef(0); // For screen flash effect
  const slowMoFactor = useRef(1.0);
  const roundActive = useRef(false);

  // 联机模式对手数据
  const opponentPos = useRef<Point>({ x: 900, y: 400 });
  const opponentVel = useRef<Point>({ x: 0, y: 0 });
  const lastSyncTime = useRef(0);

  // --- Utilities ---
  const getDist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  const getAngle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);

  // 获取敌人位置（根据游戏模式）
  const getEnemyPos = () => {
    if (gameMode === 'online' || gameMode === 'p2p') {
      return opponentPos.current;
    }
    return aiPos.current;
  };
  
  const getIntersection = (p0: Point, p1: Point, p2: Point, p3: Point): Point | null => {
    const s1_x = p1.x - p0.x; const s1_y = p1.y - p0.y;
    const s2_x = p3.x - p2.x; const s2_y = p3.y - p2.y;
    const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) return { x: p0.x + (t * s1_x), y: p0.y + (t * s1_y) };
    return null;
  };

  const distToSegment = (p: Point, v: Point, w: Point) => {
    const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return getDist(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return getDist(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
  };
  
  const willHit = (blade: BladeObject, targetPos: Point, radius: number = PLAYER_RADIUS + 10): boolean => {
      if (!blade.active) return false;
      const angleToTarget = getAngle(blade.p1, targetPos);
      const bladeAngle = Math.atan2(blade.vector.y, blade.vector.x);
      const angleDiff = Math.abs(angleToTarget - bladeAngle);
      if (angleDiff > 1.5) return false; 
      return distToSegment(targetPos, blade.p1, blade.p2) < radius;
  };

  const addFocus = (amount: number) => {
      if (playerStyle === 'light') return; 
      playerFocus.current = Math.min(FOCUS_MAX, playerFocus.current + amount);
  };

  // --- Actions ---
  const performDash = (who: 'player' | 'ai', moveVec: Point) => {
      const stamina = who === 'player' ? playerStamina : aiStamina;
      const vel = who === 'player' ? playerVel.current : aiVel.current;
      const cooldown = who === 'player' ? dashCooldown : { current: 0 }; 
      const invulnRef = who === 'player' ? playerInvulnUntil : aiInvulnUntil;

      if (who === 'player' && cooldown.current > 0) return;
      if (stamina.current < DASH_COST && who === 'player') return; 
      if (who === 'ai' && stamina.current < 10) return; 

      stamina.current -= DASH_COST;
      if (who === 'player') {
          cooldown.current = playerStyle === 'light' ? 300 : 800;
      }

      invulnRef.current = Date.now() + DASH_DURATION_MS;
      SoundSys.sfx.dash();

      const force = DASH_FORCE;
      let dx = moveVec.x;
      let dy = moveVec.y;
      
      if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
          if (who === 'player') {
            const ang = getAngle(playerPos.current, mousePos.current);
            dx = Math.cos(ang);
            dy = Math.sin(ang);
          } else {
             const ang = getAngle(playerPos.current, aiPos.current);
             dx = Math.cos(ang);
             dy = Math.sin(ang);
          }
      }

      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      dx /= len; dy /= len;

      vel.x += dx * force;
      vel.y += dy * force;

      const pos = who === 'player' ? playerPos.current : aiPos.current;
      const color = who === 'player' ? theme.p1 : theme.p2;
      for(let i=0; i<8; i++) {
          particles.current.push({
              x: pos.x, y: pos.y,
              vx: -dx * Math.random() * 8, vy: -dy * Math.random() * 8,
              life: 0.6, color: color, type: 'smoke'
          });
      }
      combatTexts.current.push({ x: pos.x, y: pos.y - 20, text: "残影", color: color, life: 0.5 });
  };

  const performWall = (who: 'player' | 'ai', target: Point) => {
      const stamina = who === 'player' ? playerStamina : aiStamina;
      const cooldown = who === 'player' ? wallCooldown : { current: 0 };
      
      if (who === 'player' && cooldown.current > 0) return;
      if (stamina.current < WALL_COST) return;

      stamina.current -= WALL_COST;
      if (who === 'player') {
          cooldown.current = playerStyle === 'light' ? 2500 : 5000;
      }
      
      SoundSys.sfx.wall();

      const pos = who === 'player' ? playerPos.current : aiPos.current;
      const angle = getAngle(pos, target);
      
      // Buffed: Wider wall spawn
      const WALL_DIST = 70; 
      const wx = pos.x + Math.cos(angle) * WALL_DIST;
      const wy = pos.y + Math.sin(angle) * WALL_DIST;

      activeWalls.current.push({
          x: wx,
          y: wy,
          angle: angle + Math.PI/2, 
          createdAt: Date.now(),
          duration: WALL_DURATION, 
          owner: who
      });
  };

  const performAttack = (who: 'player' | 'ai', type: AttackType, target: Point) => {
      // 在联机模式下，'ai' 实际上代表网络对手
      const pos = who === 'player' ? playerPos.current :
                  (gameMode === 'online' || gameMode === 'p2p') ? opponentPos.current : aiPos.current;
      const vel = who === 'player' ? playerVel.current :
                  (gameMode === 'online' || gameMode === 'p2p') ? opponentVel.current : aiVel.current;
      const stamina = who === 'player' ? playerStamina : aiStamina;
      const cooldown = who === 'player' ? playerCooldown : aiCooldown;
      const slashCombo = who === 'player' ? playerSlashCombo : aiSlashCombo;
      
      const cost = type === 'thrust' ? 25 : 15;
      if (stamina.current < cost || cooldown.current > 0) return;

      const angle = getAngle(pos, target);
      const vec = { x: Math.cos(angle), y: Math.sin(angle) };

      if (type === 'thrust') {
          slashCombo.current.count = 0;
          vel.x += vec.x * THRUST_LUNGE_FORCE;
          vel.y += vec.y * THRUST_LUNGE_FORCE;
          
          if (who === 'player') {
              cooldown.current = playerStyle === 'light' ? 200 : 500;
          } else {
              cooldown.current = 500;
          }
          
          SoundSys.sfx.thrust();
      } else {
          // --- SLASH COMBO LOGIC ---
          const now = Date.now();
          const COMBO_WINDOW = 800;
          
          if (now - slashCombo.current.lastTime < COMBO_WINDOW && slashCombo.current.count < 2) {
              slashCombo.current.count++;
          } else {
              slashCombo.current.count = 1;
          }
          slashCombo.current.lastTime = now;

          // Slash Physics
          vel.x -= vec.x * 3; 
          vel.y -= vec.y * 3;
          
          if (slashCombo.current.count >= 2) {
              if (who === 'player') {
                  cooldown.current = playerStyle === 'light' ? 200 : 500;
              } else {
                  cooldown.current = 500;
              }
          } else {
              if (who === 'player') {
                  cooldown.current = playerStyle === 'light' ? 100 : 150;
              } else {
                  cooldown.current = 150;
              }
          }

          SoundSys.sfx.slash();
      }
      stamina.current -= cost;

      let p1, p2;
      
      if (type === 'thrust') {
          p1 = { ...pos };
          p2 = { x: pos.x + vec.x * THRUST_RANGE, y: pos.y + vec.y * THRUST_RANGE };
      } else {
          const perpX = -vec.y * (SLASH_RANGE * 1.0);
          const perpY = vec.x * (SLASH_RANGE * 1.0);
          const centerX = pos.x + vec.x * 50; 
          const centerY = pos.y + vec.y * 50;

          if (slashCombo.current.count === 2) {
              p1 = { x: centerX + perpX, y: centerY + perpY };
              p2 = { x: centerX - perpX, y: centerY - perpY };
          } else {
              p1 = { x: centerX - perpX, y: centerY - perpY };
              p2 = { x: centerX + perpX, y: centerY + perpY };
          }
      }

      activeBlades.current.push({
          type,
          p1,
          p2,
          vector: vec,
          createdAt: Date.now(),
          duration: type === 'thrust' ? THRUST_DURATION : SLASH_DURATION,
          owner: who,
          id: Math.random(),
          active: true,
          color: who === 'player' ? theme.p1_blade : theme.p2_blade
      });
  };

  // --- Main Loop ---
  const update = useCallback(() => {
    if (gameState !== 'playing') return;
    const now = Date.now();
    
    // Check Focus State for UI sync
    if (focusActive.current !== focusMode) {
        setFocusMode(focusActive.current);
    }

    // Global Slow-mo recovery
    if (slowMoFactor.current < 1.0) slowMoFactor.current += 0.05;
    
    // Flash Decay
    if (flash.current > 0) flash.current -= 0.05;

    // --- FOCUS MODE LOGIC (The Zone) ---
    let globalDt = slowMoFactor.current;
    let playerDt = slowMoFactor.current; 

    if (focusActive.current) {
        focusTimer.current -= 16;
        if (focusTimer.current <= 0) {
            focusActive.current = false;
        } else {
            const ZONE_SPEED = 0.4;
            globalDt = ZONE_SPEED; 
            playerDt = ZONE_SPEED;
            
            playerStamina.current = STAMINA_MAX;
            if (playerCooldown.current > 0) playerCooldown.current -= 30; 
        }
    } else {
        addFocus(0.02);
    }
    
    // --- Camera Logic ---
    const enemyPos = getEnemyPos();
    const midpoint = {
        x: (playerPos.current.x + enemyPos.x) / 2,
        y: (playerPos.current.y + enemyPos.y) / 2
    };
    const dist = getDist(playerPos.current, enemyPos);
    const targetZoom = Math.max(0.7, Math.min(1.3, 1.0 + (600 - dist) * 0.0005));
    const lerp = 0.05;
    camera.current.x += (midpoint.x - camera.current.x) * lerp;
    camera.current.y += (midpoint.y - camera.current.y) * lerp;
    camera.current.zoom += (targetZoom - camera.current.zoom) * lerp;


    // 1. Player Input & Physics
    let playerMoveVec = { x: 0, y: 0 };
    if (roundActive.current) {
        const ax = (keys.current['d'] ? 1 : 0) - (keys.current['a'] ? 1 : 0);
        const ay = (keys.current['s'] ? 1 : 0) - (keys.current['w'] ? 1 : 0);
        playerMoveVec = { x: ax, y: ay };

        // Sprint Logic
        let speed = MOVE_SPEED;
        if (keys.current['shift'] && playerStamina.current > 0) {
            speed *= SPRINT_MULTIPLIER;
            if (!focusActive.current) playerStamina.current -= 0.3 * playerDt; 
        }

        if (ax !== 0 || ay !== 0) {
            const mag = Math.sqrt(ax*ax + ay*ay);
            playerVel.current.x += (ax/mag) * speed * playerDt;
            playerVel.current.y += (ay/mag) * speed * playerDt;
        }
    }

    const updatePhysics = (pos: Point, vel: Point, trail: Point[], dt: number) => {
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
        vel.x *= Math.pow(FRICTION, dt);
        vel.y *= Math.pow(FRICTION, dt);
        
        const speedSq = vel.x*vel.x + vel.y*vel.y;
        if (speedSq > 25) { 
            trail.push({ ...pos });
            if (trail.length > 8) trail.shift();
        } else {
            if (trail.length > 0) trail.shift();
        }
        
        // Bounds
        if (pos.x < PLAYER_RADIUS) { pos.x = PLAYER_RADIUS; vel.x *= -0.5; }
        if (pos.x > ARENA_WIDTH - PLAYER_RADIUS) { pos.x = ARENA_WIDTH - PLAYER_RADIUS; vel.x *= -0.5; }
        if (pos.y < PLAYER_RADIUS) { pos.y = PLAYER_RADIUS; vel.y *= -0.5; }
        if (pos.y > ARENA_HEIGHT - PLAYER_RADIUS) { pos.y = ARENA_HEIGHT - PLAYER_RADIUS; vel.y *= -0.5; }
    };

    updatePhysics(playerPos.current, playerVel.current, playerTrail.current, playerDt);

    // 联机模式下使用网络对手位置，单机模式使用 AI 位置
    if (gameMode === 'online' || gameMode === 'p2p') {
      // 在联机模式下，我们需要根据角色决定哪个是玩家位置
      const myPos = isHost ? playerPos.current : opponentPos.current;
      const enemyPos = isHost ? opponentPos.current : playerPos.current;

      // 同步自己的位置给对手 (节流，每 50ms 一次)
      if (now - lastSyncTime.current > 50) {
        const manager = gameMode === 'p2p' ? p2pManager : networkManager;
        manager.syncMove(playerPos.current, playerVel.current);
        lastSyncTime.current = now;
      }

      // 在联机模式下，对手位置由网络同步决定，不需要物理更新
      // 只有房主控制 player1（左侧），客人控制 player2（右侧）
    } else {
      updatePhysics(aiPos.current, aiVel.current, aiTrail.current, globalDt);
    }

    // --- Ghost Spawning Logic ---
    [playerPos.current, aiPos.current].forEach((pos, idx) => {
        const isPlayer = idx === 0;
        const dt = isPlayer ? playerDt : globalDt;
        const invulnUntil = isPlayer ? playerInvulnUntil.current : aiInvulnUntil.current;
        if (invulnUntil > now) {
            if (Math.random() < 0.4 * dt) { 
                ghosts.current.push({
                    x: pos.x,
                    y: pos.y,
                    color: isPlayer ? theme.p1 : theme.p2,
                    life: 1.0,
                    createdAt: now
                });
            }
        }
    });

    ghosts.current.forEach(g => g.life -= 0.04 * globalDt);
    ghosts.current = ghosts.current.filter(g => g.life > 0);

    // 2. Cooldowns & Stamina
    const tick = 16 * globalDt; 
    const playerTick = 16 * playerDt;

    if (!focusActive.current && playerCooldown.current > 0) playerCooldown.current -= playerTick;
    
    if (dashCooldown.current > 0) dashCooldown.current -= playerTick;
    if (wallCooldown.current > 0) wallCooldown.current -= playerTick;
    
    if (aiCooldown.current > 0) aiCooldown.current -= tick;
    if (aiActionTimer.current > 0) aiActionTimer.current -= tick;
    if (aiStateChangeTimer.current > 0) aiStateChangeTimer.current -= tick;
    
    const playerRegenMult = playerStyle === 'light' ? 1.2 : 1.0;
    if (!focusActive.current && !keys.current['shift'] && playerStamina.current < STAMINA_MAX) playerStamina.current += STAMINA_REGEN * playerDt * playerRegenMult;
    
    const aiStaminaRegenMult = difficulty === 'inferno' ? 1.5 : 1.0;
    if (aiStamina.current < STAMINA_MAX) aiStamina.current += STAMINA_REGEN * globalDt * aiStaminaRegenMult;

    // 3. Blade Updates
    activeBlades.current = activeBlades.current.filter(b => now - b.createdAt < b.duration / (focusActive.current ? 0.4 : 1.0));
    
    activeBlades.current.forEach(b => {
        if (b.type === 'thrust') {
             const ownerPos = b.owner === 'player' ? playerPos.current : aiPos.current;
             b.p1 = { ...ownerPos };
             b.p2 = { x: ownerPos.x + b.vector.x * THRUST_RANGE, y: ownerPos.y + b.vector.y * THRUST_RANGE };
        }
    });

    // 4. Wall Updates
    activeWalls.current = activeWalls.current.filter(w => now - w.createdAt < w.duration);

    // 5. Collision Logic
    activeWalls.current.forEach(wall => {
        const halfLen = 110; // Buffed Wall Width
        const wx = Math.cos(wall.angle);
        const wy = Math.sin(wall.angle);
        const p1 = { x: wall.x - wx*halfLen, y: wall.y - wy*halfLen };
        const p2 = { x: wall.x + wx*halfLen, y: wall.y + wy*halfLen };

        [playerPos.current, aiPos.current].forEach((pos, idx) => {
             const vel = idx === 0 ? playerVel.current : aiVel.current;
             if (distToSegment(pos, p1, p2) < PLAYER_RADIUS + 5) {
                 const pushForce = 2.5; // Slightly stronger wall push
                 const dx = pos.x - wall.x;
                 const dy = pos.y - wall.y;
                 const len = Math.sqrt(dx*dx + dy*dy) || 1;
                 vel.x += (dx/len) * pushForce;
                 vel.y += (dy/len) * pushForce;
                 pos.x += (dx/len) * pushForce;
                 pos.y += (dy/len) * pushForce;
             }
        });
    });

    // 5.2 Blade Collision
    const hitChecks = [...activeBlades.current];
    hitChecks.forEach(blade => {
        if (!blade.active) return;

        // Wall Blocking
        let blocked = false;
        activeWalls.current.forEach(wall => {
            if (blade.owner === wall.owner) return; 
            const halfLen = 110; 
            const wx = Math.cos(wall.angle); const wy = Math.sin(wall.angle);
            const w1 = { x: wall.x - wx*halfLen, y: wall.y - wy*halfLen };
            const w2 = { x: wall.x + wx*halfLen, y: wall.y + wy*halfLen };
            if (getIntersection(blade.p1, blade.p2, w1, w2)) blocked = true;
        });
        if (blocked) {
            blade.active = false;
            SoundSys.sfx.clash();
            for(let i=0; i<6; i++) particles.current.push({ x: (blade.p1.x + blade.p2.x)/2, y: (blade.p1.y + blade.p2.y)/2, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 0.6, color: '#a8a29e', type: 'spark' });
            return;
        }

        // A. BLADE vs BLADE
        hitChecks.forEach(other => {
            if (blade.owner === other.owner || !other.active) return;
            const intersect = getIntersection(blade.p1, blade.p2, other.p1, other.p2);
            if (intersect) {
                blade.active = false;
                other.active = false;
                let isParry = false;
                if (blade.type !== other.type) {
                     const parrier = blade.type === 'slash' ? blade.owner : other.owner;
                     if (parrier === 'player') {
                         isParry = true;
                         playerCooldown.current = 0; 
                         playerStamina.current = Math.min(STAMINA_MAX, playerStamina.current + 20);
                         addFocus(30); 
                         aiCooldown.current = 600;
                         combatTexts.current.push({ x: intersect.x, y: intersect.y - 50, text: "居合", color: theme.p1_accent, life: 1.0 });
                         SoundSys.sfx.parrySuccess();
                         flash.current = 0.8;
                     } else if (parrier === 'ai') {
                         isParry = true;
                         aiCooldown.current = 0;
                         
                         // AI Parry NERF for Duelist:
                         if (difficulty === 'duelist' || difficulty === 'novice') {
                             aiActionTimer.current = 300; // Delay reaction
                             playerCooldown.current = 400; // Reduced stun (Player can dash away)
                         } else {
                             playerCooldown.current = 600; // Hard punishment for high diff
                         }

                         SoundSys.sfx.parrySuccess();
                         combatTexts.current.push({ x: intersect.x, y: intersect.y - 50, text: "被破", color: theme.p2_accent, life: 1.0 });
                     }
                }
                if (!isParry) {
                     SoundSys.sfx.clash();
                     combatTexts.current.push({ x: intersect.x, y: intersect.y - 30, text: "交锋", color: '#a8a29e', life: 0.8 });
                }
                shake.current = 15; 
                slowMoFactor.current = 0.2; 
                for(let i=0; i<12; i++) particles.current.push({ x: intersect.x, y: intersect.y, vx: (Math.random()-0.5)*18, vy: (Math.random()-0.5)*18, life: 0.8, color: isParry ? (isDarkTheme ? '#fff' : '#000') : theme.p2_accent, type: 'spark' });
                const angle = getAngle(blade.p1, blade.p2); 
                const recoil = RECOIL_FORCE;
                if (blade.owner === 'player') {
                    playerVel.current.x -= Math.cos(angle) * recoil; playerVel.current.y -= Math.sin(angle) * recoil;
                    aiVel.current.x += Math.cos(angle) * recoil; aiVel.current.y += Math.sin(angle) * recoil;
                    if (!isParry) { 
                        const stun = playerStyle === 'light' ? 150 : 300;
                        playerCooldown.current = stun; 
                        aiCooldown.current = 300; 
                    }
                } else {
                    aiVel.current.x -= Math.cos(angle) * recoil; aiVel.current.y -= Math.sin(angle) * recoil;
                    playerVel.current.x += Math.cos(angle) * recoil; playerVel.current.y += Math.sin(angle) * recoil;
                    if (!isParry) { 
                        const stun = playerStyle === 'light' ? 150 : 300;
                        playerCooldown.current = stun; 
                        aiCooldown.current = 300; 
                    }
                }
            }
        });

        // B. BLADE vs BODY
        if (!blade.active) return;

        // 在联机模式下，需要特殊处理位置引用
        let targetPos: Point;
        let targetInvuln: number;
        let victim: 'player' | 'ai';
        let attackerPos: Point;

        if (gameMode === 'online' || gameMode === 'p2p') {
            // 联机模式：blade.owner 是攻击者，目标是对手
            if (blade.owner === 'player') {
                // 玩家攻击，目标是对手
                targetPos = opponentPos.current;
                targetInvuln = aiInvulnUntil.current; // 借用 aiInvuln 存储对手的无敌时间
                victim = 'ai'; // 标记为 ai，但实际上是网络对手
                attackerPos = playerPos.current;
            } else {
                // 对手攻击，目标是玩家
                targetPos = playerPos.current;
                targetInvuln = playerInvulnUntil.current;
                victim = 'player';
                attackerPos = opponentPos.current;
            }
        } else {
            // 单机模式：原有逻辑
            targetPos = blade.owner === 'player' ? aiPos.current : playerPos.current;
            targetInvuln = blade.owner === 'player' ? aiInvulnUntil.current : playerInvulnUntil.current;
            victim = blade.owner === 'player' ? 'ai' : 'player';
            attackerPos = blade.owner === 'player' ? playerPos.current : aiPos.current;
        }

        if (now < targetInvuln) return;

        if (distToSegment(targetPos, blade.p1, blade.p2) < PLAYER_RADIUS) {
            blade.active = false; // Disable blade on hit so it doesn't multi-hit
            registerHit(victim, attackerPos);
        }
    });

    // 6. AI Logic (Overhauled V6 - "Inferno")
    // 在联机模式下跳过 AI 逻辑
    if (roundActive.current && gameMode === 'local') {
        const dist = getDist(aiPos.current, playerPos.current);
        const angleToPlayer = getAngle(aiPos.current, playerPos.current);
        
        // Difficulty Tuning
        let parryChance = 0.0;
        let punishChance = 0.0;
        let spacingBuffer = 0;
        let reactionDelay = 150; // Delay after action

        if (difficulty === 'novice') {
            parryChance = 0.15;
            punishChance = 0.1;
            spacingBuffer = 100;
        } else if (difficulty === 'duelist') {
            // NERFED SIGNIFICANTLY
            parryChance = 0.20; // Was 0.35
            punishChance = 0.15; // Was 0.3
            spacingBuffer = 50; 
        } else if (difficulty === 'grandmaster') {
            parryChance = 0.95; 
            punishChance = 0.9;
            spacingBuffer = -50; 
            reactionDelay = 100;
        } else if (difficulty === 'inferno') {
            parryChance = 0.99; 
            punishChance = 1.0; 
            spacingBuffer = -80; 
            reactionDelay = 50; 
        }

        const incoming = activeBlades.current.find(b => 
            b.owner === 'player' && b.active && 
            willHit(b, aiPos.current, 100) 
        );

        // A. DEFENSIVE
        if (incoming && aiActionTimer.current <= 0) {
            const hasCooldown = aiCooldown.current > 0;
            const hasStamina = aiStamina.current > DASH_COST;
            
            if (!hasCooldown) {
                if (incoming.type === 'thrust' && Math.random() < parryChance) {
                    performAttack('ai', 'slash', playerPos.current); 
                    aiActionTimer.current = reactionDelay; 
                } 
                else if (hasStamina) {
                    const dodgeDir = Math.random() > 0.5 ? 1 : -1; 
                    const dodgeAngle = angleToPlayer + (Math.PI / 2 * dodgeDir);
                    performDash('ai', { x: Math.cos(dodgeAngle), y: Math.sin(dodgeAngle) });
                    aiActionTimer.current = reactionDelay * 2;
                }
            } else if (hasStamina) {
                 const escAngle = angleToPlayer + Math.PI; 
                 performDash('ai', { x: Math.cos(escAngle), y: Math.sin(escAngle) });
                 aiActionTimer.current = 400;
            }
        }

        // B. OFFENSIVE
        if (aiCooldown.current <= 0 && aiActionTimer.current <= 0) {
            const punishThreshold = difficulty === 'inferno' ? 50 : 200;
            
            if (playerCooldown.current > punishThreshold && dist < 400 && Math.random() < punishChance) {
                if (dist > THRUST_RANGE) {
                    const ang = getAngle(aiPos.current, playerPos.current);
                    if (aiStamina.current > DASH_COST) {
                        performDash('ai', { x: Math.cos(ang), y: Math.sin(ang) });
                        aiActionTimer.current = 50; 
                    }
                } else {
                    performAttack('ai', 'thrust', playerPos.current);
                }
            }
            else if (dist < THRUST_RANGE - 20) {
                 if (dist < 80 && Math.random() < 0.1) performAttack('ai', 'slash', playerPos.current);
                 else if (Math.random() < (difficulty === 'inferno' ? 0.15 : (difficulty === 'grandmaster' ? 0.08 : 0.03))) {
                     performAttack('ai', 'thrust', playerPos.current);
                 }
            }
        }
        
        // C. MOVEMENT
        let idealDist = 200 + spacingBuffer; 
        
        const moveTarget = {
            x: playerPos.current.x + aiTargetOffset.current.x * 0.2,
            y: playerPos.current.y + aiTargetOffset.current.y * 0.2
        };
        const angleToTarget = getAngle(aiPos.current, moveTarget);
        
        let mx = 0, my = 0;
        
        if (dist > idealDist + 100) { 
            mx += Math.cos(angleToPlayer); my += Math.sin(angleToPlayer); 
        } else if (dist < idealDist - 50) { 
            mx -= Math.cos(angleToPlayer); my -= Math.sin(angleToPlayer); 
        } else {
             const orbitDir = aiPos.current.x > 600 ? 1 : -1; 
             mx += Math.cos(angleToPlayer + Math.PI/2) * orbitDir * 0.5;
             my += Math.sin(angleToPlayer + Math.PI/2) * orbitDir * 0.5;
             const jit = Math.sin(now / 150) * 0.3;
             mx += Math.cos(angleToPlayer) * jit;
             my += Math.sin(angleToPlayer) * jit;
        }

        const len = Math.sqrt(mx*mx + my*my) || 1;
        const moveSpeed = difficulty === 'inferno' ? MOVE_SPEED * 1.15 : MOVE_SPEED;
        aiVel.current.x += (mx/len) * moveSpeed * globalDt;
        aiVel.current.y += (my/len) * moveSpeed * globalDt;
    }
  }, [gameState, difficulty, playerStyle, theme, focusMode]);

  // --- Render ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- MAP RENDERING (Simple Grid) ---
    // Clear
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    
    // Save context for camera transform
    ctx.save();
    
    // Apply Shake
    let sx = 0, sy = 0;
    if (shake.current > 0) {
        sx = (Math.random()-0.5)*shake.current; sy = (Math.random()-0.5)*shake.current;
        shake.current *= 0.9;
    }
    
    // Apply Camera Transform
    ctx.translate(ARENA_WIDTH/2 + sx, ARENA_HEIGHT/2 + sy);
    ctx.scale(camera.current.zoom, camera.current.zoom);
    ctx.translate(-camera.current.x, -camera.current.y);

    // Grid - Very Subtle
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<ARENA_WIDTH; i+=200) { ctx.moveTo(i,0); ctx.lineTo(i,ARENA_HEIGHT); }
    for(let i=0; i<ARENA_HEIGHT; i+=200) { ctx.moveTo(0,i); ctx.lineTo(ARENA_WIDTH,i); }
    ctx.stroke();

    // Ghost Trails
    ghosts.current.forEach(g => {
        ctx.save();
        ctx.globalAlpha = g.life * 0.2; 
        ctx.fillStyle = g.color;
        ctx.beginPath();
        ctx.arc(g.x, g.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    const drawTrail = (trail: Point[], color: string) => {
        if(trail.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineCap = 'butt'; // Sharp ends
        ctx.lineJoin = 'miter';
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for(let i=1; i<trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.globalAlpha = 0.1;
        ctx.lineWidth = PLAYER_RADIUS;
        ctx.stroke();
        ctx.globalAlpha = 1;
    };
    drawTrail(aiTrail.current, theme.p2);
    drawTrail(playerTrail.current, theme.p1);

    // Draw Walls - Calligraphy Brush style
    activeWalls.current.forEach(w => {
        const age = Date.now() - w.createdAt;
        const alpha = 1 - (age / w.duration);
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.angle);
        
        ctx.shadowBlur = 0;
        ctx.strokeStyle = w.owner === 'player' ? theme.p1 : theme.p2; 
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 4; // Thicker line for buff
        
        const len = 110; // Buffed length visual
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.quadraticCurveTo(0, -15, len, 0); 
        ctx.stroke();
        
        ctx.restore();
    });

    // Characters
    const drawChar = (pos: Point, color: string, stamina: number, isPlayer: boolean) => {
        const invuln = isPlayer ? playerInvulnUntil.current : aiInvulnUntil.current;
        const isGhost = invuln > Date.now();
        const maxHits = playerStyle === 'light' ? 2 : 1;
        const hitsTaken = isPlayer ? roundHits.current.player : roundHits.current.ai;
        const hp = maxHits - hitsTaken;

        // Shadow - Ink blob
        ctx.fillStyle = isDarkTheme ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.ellipse(pos.x, pos.y+15, 12, 4, 0, 0, Math.PI*2); ctx.fill();
        
        // Main Body - Simple Circle
        ctx.fillStyle = isGhost ? theme.text : color;
        ctx.globalAlpha = isGhost ? 0.6 : 1.0;
        
        ctx.beginPath(); ctx.arc(pos.x, pos.y, PLAYER_RADIUS, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
        
        // Stance Line - Very thin
        const aim = isPlayer ? mousePos.current : playerPos.current; 
        const ang = isPlayer ? getAngle(pos, aim) : getAngle(pos, playerPos.current);
        
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + Math.cos(ang) * 50, pos.y + Math.sin(ang) * 50);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Stamina - Thin ring
        ctx.strokeStyle = isDarkTheme ? '#44403c' : '#d6d3d1'; // dark grey vs light grey
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, PLAYER_RADIUS + 5, 0, Math.PI*2); ctx.stroke();
        
        if (stamina > 0) {
             ctx.strokeStyle = stamina > 30 ? (isDarkTheme ? '#d6d3d1' : '#78716c') : theme.p2_blade; 
             ctx.beginPath(); ctx.arc(pos.x, pos.y, PLAYER_RADIUS + 5, -Math.PI/2, -Math.PI/2 + (Math.PI*2 * (stamina/STAMINA_MAX))); ctx.stroke();
        }
        
        // HP Armor - Minimalist rectangles
        if (playerStyle === 'light') {
            const yOffset = 30;
            const width = 20;
            const height = 2;
            const gap = 2;
            
            for(let i=0; i<maxHits; i++) {
                const xOffset = (i - (maxHits-1)/2) * (width + gap);
                ctx.fillStyle = i < hp ? (isPlayer ? theme.p1_accent : theme.p2) : (isDarkTheme ? '#292524' : '#e7e5e4');
                ctx.fillRect(pos.x + xOffset - width/2, pos.y + yOffset, width, height);
            }
        }
    };

    const enemyPos = getEnemyPos();
    drawChar(enemyPos, theme.p2, aiStamina.current, false);
    drawChar(playerPos.current, theme.p1, playerStamina.current, true);

    // Blades
    activeBlades.current.forEach(b => {
        const age = Date.now() - b.createdAt;
        const duration = b.duration / (focusActive.current ? 0.4 : 1.0); 
        const alpha = 1 - (age / duration);
        
        ctx.lineWidth = b.type === 'thrust' ? 2 : 4; 
        ctx.lineCap = 'butt';
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = alpha;
        
        ctx.beginPath();
        ctx.moveTo(b.p1.x, b.p1.y);
        ctx.lineTo(b.p2.x, b.p2.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        if (b.type === 'slash') {
            ctx.fillStyle = b.color;
            ctx.globalAlpha = 0.1 * alpha;
            ctx.beginPath();
            ctx.moveTo(b.p1.x, b.p1.y);
            ctx.lineTo(b.p2.x, b.p2.y);
            ctx.lineTo(b.p2.x - b.vector.x*15, b.p2.y - b.vector.y*15);
            ctx.lineTo(b.p1.x - b.vector.x*15, b.p1.y - b.vector.y*15);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    });

    // Particles - Ink Splashes
    particles.current.forEach((p, i) => {
        p.x += p.vx * slowMoFactor.current;
        p.y += p.vy * slowMoFactor.current;
        p.life -= 0.05;
        
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        // Rectangular particles for "pixel/ink" feel
        const size = p.type === 'blood' ? 3 : 2;
        ctx.fillRect(p.x, p.y, size, size);
        if (p.life <= 0) particles.current.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    // Combat Text - Serif Font
    combatTexts.current.forEach((t, i) => {
        t.y -= 0.5;
        t.life -= 0.02;
        ctx.fillStyle = t.color;
        ctx.font = "20px serif"; 
        ctx.textAlign = "center";
        ctx.globalAlpha = Math.min(1, t.life);
        ctx.fillText(t.text, t.x, t.y);
        if (t.life <= 0) combatTexts.current.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    // Mouse Cursor
    if (gameState === 'playing' && roundActive.current) {
        ctx.fillStyle = theme.text;
        ctx.fillRect(mousePos.current.x - 2, mousePos.current.y - 2, 4, 4);
        
        if (dashCooldown.current > 0) {
            ctx.strokeStyle = theme.subtext;
            ctx.beginPath(); ctx.arc(mousePos.current.x, mousePos.current.y, 10, 0, Math.PI*2); ctx.stroke();
        } else if (playerStamina.current >= DASH_COST) {
             ctx.strokeStyle = theme.text;
             ctx.lineWidth = 1;
             ctx.beginPath(); ctx.arc(mousePos.current.x, mousePos.current.y, 10, 0, Math.PI*2); ctx.stroke();
        }
        
        if (wallCooldown.current <= 0 && playerStamina.current >= WALL_COST) {
            ctx.strokeStyle = theme.p1;
            ctx.lineWidth = 2;
            ctx.beginPath(); 
            ctx.moveTo(mousePos.current.x - 10, mousePos.current.y);
            ctx.quadraticCurveTo(mousePos.current.x, mousePos.current.y - 5, mousePos.current.x + 10, mousePos.current.y);
            ctx.stroke();
        }
    }
    
    ctx.restore();
    
    // Flash Overlay (Screen space, drawn last)
    if (flash.current > 0) {
        ctx.fillStyle = theme.p1_accent;
        ctx.globalAlpha = flash.current * 0.15;
        ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
        ctx.globalAlpha = 1;
    }
  }, [gameState, theme]);

  // --- Hit Registration ---
  const registerHit = (victim: 'player' | 'ai', attackerPos: Point) => {
      if (!roundActive.current) return;
      
      // Increment hit count
      if (victim === 'player') roundHits.current.player++;
      else roundHits.current.ai++;

      const maxHits = playerStyle === 'light' ? 2 : 1;
      const currentHits = victim === 'player' ? roundHits.current.player : roundHits.current.ai;
      
      if (currentHits >= maxHits) {
           // Fatal hit
           handleRoundEnd(victim === 'player' ? 'ai' : 'player');
      } else {
           // Non-fatal hit (Sabre first hit) - NO RESET, JUST FX & KNOCKBACK
           
           // Apply Knockback
           const pos = victim === 'player' ? playerPos.current : aiPos.current;
           const vel = victim === 'player' ? playerVel.current : aiVel.current;
           const angle = getAngle(attackerPos, pos);
           const KB_FORCE = 30; // Strong push back
           vel.x += Math.cos(angle) * KB_FORCE;
           vel.y += Math.sin(angle) * KB_FORCE;
           
           // Set I-Frames
           if (victim === 'player') playerInvulnUntil.current = Date.now() + 800;
           else aiInvulnUntil.current = Date.now() + 800;

           // Visuals
           SoundSys.sfx.shieldBreak(); // New sound for non-fatal hit
           shake.current = 10;
           for(let i=0; i<15; i++) {
                particles.current.push({
                    x: pos.x, y: pos.y,
                    vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15,
                    life: 0.8, color: theme.p2_accent, type: 'spark' // Gold/Sparks for shield hit
                });
           }
           combatTexts.current.push({ x: pos.x, y: pos.y - 40, text: "震荡", color: theme.p2_accent, life: 1.0 });
      }
  };

  const handleRoundEnd = (winner: 'player' | 'ai') => {
      if (!roundActive.current) return;
      roundActive.current = false;
      focusActive.current = false; 
      setFocusMode(false);
      
      shake.current = 25;
      slowMoFactor.current = 0.05; 
      
      const victim = winner === 'player' ? aiPos.current : playerPos.current;
      for(let i=0; i<30; i++) {
        particles.current.push({
            x: victim.x, y: victim.y,
            vx: (Math.random()-0.5)*25, vy: (Math.random()-0.5)*25,
            life: 2.0, color: winner === 'player' ? theme.p2 : '#000', type: 'blood'
        });
      }
      combatTexts.current.push({ x: victim.x, y: victim.y - 40, text: "胜负已分", color: theme.text, life: 2 });

      if (winner === 'player') scoreRef.current.player++;
      else scoreRef.current.ai++;
      setScore({...scoreRef.current});

      const winScore = 5;

      setTimeout(() => {
          if (scoreRef.current.player >= winScore || scoreRef.current.ai >= winScore) {
              setGameState(scoreRef.current.player >= winScore ? 'win' : 'lose');
              SoundSys.sfx.win();
              slowMoFactor.current = 1.0;
              return;
          }
          // Reset positions and Round Hits
          playerPos.current = { x: 300, y: 400 };
          aiPos.current = { x: 900, y: 400 };
          playerVel.current = {x:0,y:0};
          aiVel.current = {x:0,y:0};
          activeBlades.current = [];
          activeWalls.current = [];
          combatTexts.current = [];
          playerStamina.current = STAMINA_MAX;
          aiStamina.current = STAMINA_MAX;
          playerFocus.current = playerStyle === 'light' ? 0 : Math.min(FOCUS_MAX, playerFocus.current + 25);
          
          // Reset Hit Counters for new round
          roundHits.current = { player: 0, ai: 0 };
          
          roundActive.current = true;
          slowMoFactor.current = 1.0;
          playerInvulnUntil.current = 0;
          aiInvulnUntil.current = 0;
          aiActionTimer.current = 0; 
          
          camera.current = { x: 600, y: 400, zoom: 1 }; 
      }, 1000); 
  };

  const startGame = (diff: Difficulty) => {
      setDifficulty(diff);
      scoreRef.current = { player: 0, ai: 0 };
      setScore({ player: 0, ai: 0 });
      setGameState('playing');

      // 联机模式下根据是否是房主设置初始位置
      if (gameMode === 'online' || gameMode === 'p2p') {
          if (isHost) {
              // 房主在左侧
              playerPos.current = { x: 300, y: 400 };
              opponentPos.current = { x: 900, y: 400 };
          } else {
              // 客人在右侧
              playerPos.current = { x: 900, y: 400 };
              opponentPos.current = { x: 300, y: 400 };
          }
      } else {
          // 单机模式：玩家在左，AI在右
          playerPos.current = { x: 300, y: 400 };
          aiPos.current = { x: 900, y: 400 };
      }

      roundActive.current = true;
      slowMoFactor.current = 1.0;

      // Enforce style restriction
      let startStyle = playerStyle;
      if ((diff === 'novice' || diff === 'duelist') && playerStyle === 'light') {
          startStyle = 'heavy';
          setPlayerStyle('heavy');
      }

      playerFocus.current = startStyle === 'light' ? 0 : 50;
      focusActive.current = false;
      setFocusMode(false);
      roundHits.current = { player: 0, ai: 0 };

      // Init Audio
      SoundSys.init();
      SoundSys.sfx.start();
  };

  const toggleMute = () => {
      setMuted(!muted);
      SoundSys.muted = !muted;
      if (SoundSys.ctx && SoundSys.ctx.state === 'suspended') SoundSys.ctx.resume();
  }

  // 网络同步 useEffect
  useEffect(() => {
    if (gameMode !== 'online' && gameMode !== 'p2p') return;

    // 监听对手移动
    const handleOpponentMove = (data: any) => {
      opponentPos.current = data.position;
      opponentVel.current = data.velocity;
    };

    // 监听对手攻击
    const handleOpponentAttack = (data: any) => {
      const who: 'player' | 'ai' = isHost ? 'ai' : 'player';
      performAttack(who, data.attackType, data.target);
    };

    // 监听对手冲刺
    const handleOpponentDash = (data: any) => {
      const who: 'player' | 'ai' = isHost ? 'ai' : 'player';
      performDash(who, data.moveVec);
    };

    // 监听对手墙壁
    const handleOpponentWall = (data: any) => {
      const who: 'player' | 'ai' = isHost ? 'ai' : 'player';
      performWall(who, data.target);
    };

    // 根据游戏模式选择网络管理器
    const manager = gameMode === 'p2p' ? p2pManager : networkManager;

    manager.on('opponent-move', handleOpponentMove);
    manager.on('opponent-attack', handleOpponentAttack);
    manager.on('opponent-dash', handleOpponentDash);
    manager.on('opponent-wall', handleOpponentWall);

    return () => {
      manager.off('opponent-move', handleOpponentMove);
      manager.off('opponent-attack', handleOpponentAttack);
      manager.off('opponent-dash', handleOpponentDash);
      manager.off('opponent-wall', handleOpponentWall);
    };
  }, [gameMode, isHost]);

  // Handle Resize for Scale
  useEffect(() => {
    const handleResize = () => {
        const sx = window.innerWidth / ARENA_WIDTH;
        const sy = window.innerHeight / ARENA_HEIGHT;
        // Scale to fit, leave small margin
        setScale(Math.min(sx, sy) * 0.95);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loop = () => { update(); render(); requestRef.current = requestAnimationFrame(loop); };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update, render]);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
        const r = canvasRef.current?.getBoundingClientRect();
        if(r) {
            // Correct for CSS scaling
            // The canvas internal resolution is 1200x800.
            // r.width and r.height are the displayed size.
            // (e.clientX - r.left) is the pixel position on screen relative to canvas edge.
            
            const scaleX = ARENA_WIDTH / r.width; 
            const scaleY = ARENA_HEIGHT / r.height;

            const mx = (e.clientX - r.left) * scaleX;
            const my = (e.clientY - r.top) * scaleY;
            
            const cx = camera.current.x;
            const cy = camera.current.y;
            const z = camera.current.zoom;
            
            // Camera logic: (ScreenPos - ScreenCenter) / zoom + CameraCenter
            // ScreenCenter is ARENA_WIDTH/2, ARENA_HEIGHT/2 in canvas pixels
            mousePos.current = {
                x: (mx - ARENA_WIDTH/2) / z + cx,
                y: (my - ARENA_HEIGHT/2) / z + cy
            };
        }
    };
    const handleDown = (e: MouseEvent) => {
        if (!roundActive.current || gameState !== 'playing') return;
        const manager = gameMode === 'p2p' ? p2pManager : networkManager;
        if (e.button === 0) {
            performAttack('player', 'thrust', mousePos.current);
            if (gameMode === 'online' || gameMode === 'p2p') {
                manager.syncAttack({ attackType: 'thrust', target: mousePos.current });
            }
        }
        if (e.button === 2) {
            performAttack('player', 'slash', mousePos.current);
            if (gameMode === 'online' || gameMode === 'p2p') {
                manager.syncAttack({ attackType: 'slash', target: mousePos.current });
            }
        }
    };
    const handleKey = (e: KeyboardEvent, down: boolean) => {
        const k = e.key.toLowerCase();
        keys.current[k] = down;
        const manager = gameMode === 'p2p' ? p2pManager : networkManager;

        if (down && k === ' ') {
            e.preventDefault();
            const ax = (keys.current['d'] ? 1 : 0) - (keys.current['a'] ? 1 : 0);
            const ay = (keys.current['s'] ? 1 : 0) - (keys.current['w'] ? 1 : 0);
            performDash('player', {x: ax, y: ay});
            if (gameMode === 'online' || gameMode === 'p2p') {
                manager.syncDash({x: ax, y: ay});
            }
        }
        if (down && k === 'q') {
            performWall('player', mousePos.current);
            if (gameMode === 'online' || gameMode === 'p2p') {
                manager.syncWall(mousePos.current);
            }
        }
        if (down && k === 'e') {
            if (playerStyle !== 'light' && playerFocus.current >= 100 && !focusActive.current) {
                focusActive.current = true;
                playerFocus.current = 0;
                focusTimer.current = 2000; 
                SoundSys.sfx.focus();
            }
        }
    };
    const handleContext = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', e => handleKey(e, true));
    window.addEventListener('keyup', e => handleKey(e, false));
    window.addEventListener('contextmenu', handleContext);
    return () => {
        window.removeEventListener('mousemove', handleMouse);
        window.removeEventListener('mousedown', handleDown);
        window.removeEventListener('keydown', e => handleKey(e, true));
        window.removeEventListener('keyup', e => handleKey(e, false));
        window.removeEventListener('contextmenu', handleContext);
    }
  }, [gameState, playerStyle]);

  return (
    <div 
        className={`fixed inset-0 flex items-center justify-center font-serif select-none overflow-hidden tracking-widest transition-all duration-1000 
        ${isDarkTheme ? 'bg-stone-950 text-stone-300' : 'bg-[#fafaf9] text-stone-800'}
        ${focusMode ? 'grayscale contrast-125' : ''}
        `}
    >
        {/* Cinematic Bars (Overlay) */}
        <div className={`fixed top-0 left-0 w-full bg-black z-50 transition-all duration-700 ease-out pointer-events-none ${focusMode ? 'h-[12vh]' : 'h-0'}`}></div>
        <div className={`fixed bottom-0 left-0 w-full bg-black z-50 transition-all duration-700 ease-out pointer-events-none ${focusMode ? 'h-[12vh]' : 'h-0'}`}></div>
        
        {/* Scaled Content Container */}
        <div 
            className="relative origin-center"
            style={{ 
                width: ARENA_WIDTH, 
                height: ARENA_HEIGHT,
                transform: `scale(${scale})`
            }}
        >
            {/* HUD (Inside scaled container to maintain layout relative to game) */}
            <div className={`absolute top-10 w-full px-12 flex justify-between items-start z-10 pointer-events-none transition-opacity duration-500 ${focusMode ? 'opacity-30' : 'opacity-100'}`}>
                {/* Player Score */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-baseline gap-6">
                        <div className={`text-6xl font-light font-serif transition-colors ${isDarkTheme ? 'text-stone-100' : 'text-stone-900'}`}>{score.player}</div>
                        <div className="flex flex-col gap-1">
                            <span className={`text-xs uppercase tracking-[0.3em] ${isDarkTheme ? 'text-stone-500' : 'text-stone-400'}`}>Player</span>
                            <div className={`h-[1px] w-24 ${isDarkTheme ? 'bg-stone-700' : 'bg-stone-300'}`}></div>
                        </div>
                    </div>
                    
                    {/* FOCUS BAR */}
                    <div className="flex flex-col gap-1">
                        <div className={`w-48 h-[2px] ${isDarkTheme ? 'bg-stone-800' : 'bg-stone-200'}`}>
                            <div 
                                className={`h-full transition-all duration-300 ${playerStyle === 'light' ? 'bg-transparent' : (focusActive.current ? (isDarkTheme ? 'bg-stone-100' : 'bg-stone-800') : (isDarkTheme ? 'bg-stone-500' : 'bg-stone-400'))}`}
                                style={{ width: playerStyle === 'light' ? '0%' : `${(playerFocus.current / FOCUS_MAX) * 100}%` }}
                            />
                        </div>
                        <div className={`text-[10px] tracking-widest ${playerStyle === 'light' ? 'text-stone-400' : (playerFocus.current >= 100 ? (isDarkTheme ? 'text-stone-300 animate-pulse' : 'text-stone-900 animate-pulse') : (isDarkTheme ? 'text-stone-600' : 'text-stone-400'))}`}>
                            {playerStyle === 'light' ? '心流封' : (playerFocus.current >= 100 ? '心流 • 满' : '心流 • 聚')}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 mt-2">
                    <div className={`text-xs tracking-[0.5em] border-b pb-1 mb-1 transition-colors ${isDarkTheme ? 'text-stone-600 border-stone-800' : 'text-stone-400 border-stone-200'}`}>
                        {difficulty === 'novice' && '初入江湖'}
                        {difficulty === 'duelist' && '略有小成'}
                        {difficulty === 'grandmaster' && '一代宗师'}
                        {difficulty === 'inferno' && '剑圣'}
                    </div>
                    <button onClick={toggleMute} className={`pointer-events-auto transition-colors ${isDarkTheme ? 'text-stone-600 hover:text-stone-300' : 'text-stone-400 hover:text-stone-800'}`}>
                        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                </div>

                {/* AI Score */}
                <div className="flex flex-col items-end gap-4">
                    <div className="flex items-baseline gap-6 flex-row-reverse">
                        <div className={`text-6xl font-light font-serif transition-colors ${isDarkTheme ? 'text-red-900' : 'text-red-800'}`}>{score.ai}</div>
                        <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs uppercase tracking-[0.3em] ${isDarkTheme ? 'text-red-900/50' : 'text-red-900/30'}`}>Enemy</span>
                            <div className={`h-[1px] w-24 ${isDarkTheme ? 'bg-red-900/30' : 'bg-red-200'}`}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Canvas */}
            <canvas ref={canvasRef} width={1200} height={800} className="block cursor-crosshair" />

            {/* Menus (Overlay inside scaled container) */}
            {gameState === 'online-p2p' && (
                <OnlineMenu
                    isDarkTheme={isDarkTheme}
                    onBack={() => setGameState('menu')}
                    onGameStart={(mode) => {
                        setGameMode('p2p');
                        setIsHost(mode === 'host');
                        startGame('duelist'); // P2P 默认难度
                    }}
                />
            )}
            {gameState === 'multiplayer' && (
                <MultiplayerMenu
                    isDarkTheme={isDarkTheme}
                    onBack={() => setGameState('menu')}
                    onGameStart={(mode) => {
                        setGameMode('online');
                        setIsHost(mode === 'host');
                        startGame('duelist'); // 联机默认难度
                    }}
                />
            )}
            {gameState !== 'playing' && gameState !== 'multiplayer' && gameState !== 'online-p2p' && (
                <div className={`absolute inset-0 flex items-center justify-center z-20 transition-colors duration-1000 ${isDarkTheme ? 'bg-[#0c0a09]/90' : 'bg-[#fafaf9]/90'}`}>
                    <div className={`text-center p-12 border min-w-[500px] transition-colors duration-1000 ${isDarkTheme ? 'border-stone-800' : 'border-stone-300'}`}>
                        {gameState === 'menu' && (
                            <>
                                <h1 className={`text-7xl mb-4 tracking-[0.2em] font-serif font-light transition-colors ${isDarkTheme ? 'text-stone-100' : 'text-stone-900'}`}>剑 魄</h1>
                                <div className={`w-full h-[1px] my-6 transition-colors ${isDarkTheme ? 'bg-stone-800' : 'bg-stone-300'}`}></div>
                                <p className={`mb-10 text-sm tracking-[0.5em] transition-colors ${isDarkTheme ? 'text-stone-500' : 'text-stone-500'}`}>一 念 • 生 死</p>
                                
                                <div className="mb-10 flex justify-center gap-12 text-sm text-left">
                                    <button 
                                        onClick={() => setPlayerStyle('heavy')} 
                                        className={`pb-2 border-b transition-all duration-300 ${playerStyle === 'heavy' ? (isDarkTheme ? 'text-stone-100 border-stone-100' : 'text-stone-900 border-stone-900') : (isDarkTheme ? 'text-stone-600 border-transparent hover:text-stone-400' : 'text-stone-400 border-transparent hover:text-stone-600')}`}
                                    >
                                        <div className="text-lg mb-1">重剑无锋</div>
                                        <div className="text-[10px] opacity-70">一击 • 心流 • 守拙</div>
                                    </button>
                                    <button 
                                        onClick={() => setPlayerStyle('light')} 
                                        className={`pb-2 border-b transition-all duration-300 ${playerStyle === 'light' ? (isDarkTheme ? 'text-stone-100 border-stone-100' : 'text-stone-900 border-stone-900') : (isDarkTheme ? 'text-stone-600 border-transparent hover:text-stone-400' : 'text-stone-400 border-transparent hover:text-stone-600')}`}
                                    >
                                        <div className="text-lg mb-1">快剑绝影</div>
                                        <div className="text-[10px] opacity-70">双击 • 极速 • 唯快</div>
                                    </button>
                                </div>

                                <div className="space-y-3 flex flex-col items-center">
                                    <button
                                        onClick={() => setGameState('online-p2p')}
                                        className={`w-48 py-2 text-sm border transition-all duration-500 ${
                                            isDarkTheme
                                            ? 'border-emerald-800 text-emerald-400 hover:text-emerald-100 hover:border-emerald-500'
                                            : 'border-emerald-300 text-emerald-600 hover:text-emerald-900 hover:border-emerald-500'
                                        }`}
                                    >
                                        在线对战
                                    </button>
                                    <button
                                        onClick={() => setGameState('multiplayer')}
                                        className={`w-48 py-2 text-sm border transition-all duration-500 ${
                                            isDarkTheme
                                            ? 'border-cyan-800 text-cyan-400 hover:text-cyan-100 hover:border-cyan-500'
                                            : 'border-sky-300 text-sky-600 hover:text-sky-900 hover:border-sky-500'
                                        }`}
                                    >
                                        局域网对战
                                    </button>
                                    <button
                                        disabled={playerStyle === 'light'}
                                        onClick={() => startGame('novice')}
                                        className={`w-48 py-2 text-sm border transition-all duration-500 ${
                                            playerStyle === 'light'
                                            ? (isDarkTheme ? 'text-stone-800 border-stone-900' : 'text-stone-200 border-stone-100')
                                            : (isDarkTheme ? 'text-stone-400 border-stone-800 hover:text-stone-100 hover:border-stone-500' : 'text-stone-500 border-stone-300 hover:text-stone-900 hover:border-stone-500')
                                        }`}
                                    >
                                        初入江湖
                                    </button>
                                    <button 
                                        disabled={playerStyle === 'light'}
                                        onClick={() => startGame('duelist')} 
                                        className={`w-48 py-2 text-sm border transition-all duration-500 ${
                                            playerStyle === 'light' 
                                            ? (isDarkTheme ? 'text-stone-800 border-stone-900' : 'text-stone-200 border-stone-100') 
                                            : (isDarkTheme ? 'text-stone-400 border-stone-800 hover:text-stone-100 hover:border-stone-500' : 'text-stone-500 border-stone-300 hover:text-stone-900 hover:border-stone-500')
                                        }`}
                                    >
                                        略有小成
                                    </button>
                                    <button 
                                        onClick={() => startGame('grandmaster')} 
                                        className={`w-48 py-2 text-sm border transition-all duration-500 ${isDarkTheme ? 'text-stone-300 border-stone-700 hover:bg-stone-100 hover:text-stone-900' : 'text-stone-600 border-stone-400 hover:bg-stone-900 hover:text-stone-100'}`}
                                    >
                                        一代宗师
                                    </button>
                                    <button 
                                        onClick={() => startGame('inferno')} 
                                        className={`w-48 py-2 text-sm border transition-all duration-500 ${isDarkTheme ? 'text-red-900/70 border-red-900/30 hover:bg-red-950 hover:text-red-500 hover:border-red-900' : 'text-red-800/70 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300'}`}
                                    >
                                        剑圣
                                    </button>
                                </div>

                                <div className={`mt-12 text-[10px] space-y-1 font-mono tracking-widest transition-colors ${isDarkTheme ? 'text-stone-700' : 'text-stone-400'}`}>
                                    <p>左键 刺 | 右键 挡 | Q 阵</p>
                                    <p>空格 闪 | Shift 疾 | E 意</p>
                                </div>
                            </>
                        )}
                        {(gameState === 'win' || gameState === 'lose') && (
                            <div className="animate-in fade-in duration-700">
                                <h2 className={`text-5xl font-light mb-6 tracking-[0.2em] ${gameState === 'win' ? (isDarkTheme ? 'text-stone-100' : 'text-stone-900') : 'text-red-900'}`}>{gameState === 'win' ? '胜' : '败'}</h2>
                                <p className={`mb-12 text-sm tracking-[0.3em] ${isDarkTheme ? 'text-stone-500' : 'text-stone-500'}`}>{gameState === 'win' ? '技 惊 四 座' : '胜 败 常 事'}</p>
                                <button onClick={() => setGameState('menu')} className={`px-12 py-3 border text-sm tracking-[0.2em] transition-all duration-500 ${isDarkTheme ? 'border-stone-600 text-stone-400 hover:text-stone-100 hover:border-stone-300' : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-500'}`}>
                                    返 回
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default FencingGame;