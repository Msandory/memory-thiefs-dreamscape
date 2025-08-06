import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Howl } from "howler";
import orbCollect from '@/assets/audio/orb-collect.mp3';
import guardianAlert from '@/assets/audio/guardian-alert.mp3';
import gameOver from '@/assets/audio/game-over.mp3';
import victory from '@/assets/audio/victory.mp3';
import backgroundMusic from '@/assets/audio/background-music.mp3';
import spriteSheet from '@/assets/sprites/player-sprite-sheet.png';
import leftImage from '@/assets/sprites/left.png';
import rightImage from '@/assets/sprites/right.png';
import guardSpriteSheet from '@/assets/sprites/guard-sprite-sheet.png';

// --- Map and Wall Configuration ---
const TILE_SIZE = 40;
const MAP_COLS = 20; // Canvas Width (800) / TILE_SIZE
const MAP_ROWS = 15; // Canvas Height (600) / TILE_SIZE

// 0 = Empty Floor, 1 = Wall
const level1Map = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1],
  [1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

// --- NEW: Difficulty-based and common game configurations ---
const difficultyConfigs = {
  easy: {
    baseTimer: 45,
    timerIncrement: 3,
    baseGuardSpeed: 0.2,
    speedIncrement: 0.2,
    initialGuards: 1,
    guardsPerLevel: 0.5, // Add a guard every 2 levels
  },
  medium: {
    baseTimer: 30,
    timerIncrement: 2,
    baseGuardSpeed: 1,
    speedIncrement: 0.5,
    initialGuards: 1,
    guardsPerLevel: 1,
  },
  hard: {
    baseTimer: 20,
    timerIncrement: 1,
    baseGuardSpeed: 1.3,
    speedIncrement: 0.6,
    initialGuards: 2,
    guardsPerLevel: 1,
  },
};

const commonConfig = {
  MAX_LEVELS: 10,
  initialOrbs: 2,
  orbsPerLevel: 1,
  safeDistance: 100,
  guardianVisionRange: 100,
  guardianVisionAngle: Math.PI / 3,
};

interface GameCanvasProps {
  isActive: boolean;
  onGameStateChange: (state: 'playing' | 'paused' | 'gameOver' | 'victory') => void;
  memoriesCollected: number;
  onMemoryCollected: () => void;
  playerName: string;
  onPlayerNameLoaded: (name: string) => void;
  muted: boolean;
  onTimerUpdate?: (time: number) => void;
  onTimerActive?: (isActive: boolean) => void;
  onLevelChange?: (level: number) => void;
  mobileDirection?: { up: boolean; down: boolean; left: boolean; right: boolean };
  difficulty: 'easy' | 'medium' | 'hard'; // NEW: Difficulty prop
}

interface Guardian {
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  alert: boolean;
}

interface SavedGameState {
  player: { x: number; y: number; size: number };
  memoryOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[];
  guardians: Guardian[];
  memoriesCollected: number;
  playerName: string;
  currentLevel: number;
  timeRemaining: number;
}

// NEW: Confetti particle interface for victory celebration
interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  opacity: number;
}

export const GameCanvas = forwardRef<any, GameCanvasProps>(({
  isActive,
  onGameStateChange,
  onMemoryCollected,
  playerName,
  onPlayerNameLoaded,
  muted,
  onTimerUpdate,
  onTimerActive,
  onLevelChange,
  mobileDirection = { up: false, down: false, left: false, right: false },
  difficulty, // NEW: Destructure difficulty
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const soundsRef = useRef<{ orbCollect: Howl; guardianAlert: Howl; gameOver: Howl; victory: Howl; background: Howl; } | null>(null);
  const firstRender = useRef(true);
  const timerStarted = useRef(false);
  const player = useRef({ x: 0, y: 0, size: 20 });
  const memoryOrbs = useRef<{ x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]>([]);
  const guardians = useRef<Guardian[]>([]);
  const previousMemoryCount = useRef(0);
  const alertedGuardians = useRef<Set<number>>(new Set());
  
  // NEW: Refs for victory celebration to avoid stale closures in render loop
  const isCelebrating = useRef(false);
  const confettiParticles = useRef<ConfettiParticle[]>([]);

  // MODIFIED: getLevelConfig now uses the difficulty prop
  const getLevelConfig = (level: number) => {
    const diffConfig = difficultyConfigs[difficulty];
    return {
      orbs: commonConfig.initialOrbs + (level - 1) * commonConfig.orbsPerLevel,
      guards: diffConfig.initialGuards + Math.floor((level - 1) * diffConfig.guardsPerLevel),
      guardSpeed: diffConfig.baseGuardSpeed + (level - 1) * diffConfig.speedIncrement,
      timer: diffConfig.baseTimer + (level - 1) * diffConfig.timerIncrement,
    };
  };

  const isCollidingWithWall = (x: number, y: number, size: number) => {
    const halfSize = size / 2;
    const corners = [
      { x: x - halfSize, y: y - halfSize }, { x: x + halfSize, y: y - halfSize },
      { x: x - halfSize, y: y + halfSize }, { x: x + halfSize, y: y + halfSize },
    ];
    for (const corner of corners) {
      const col = Math.floor(corner.x / TILE_SIZE);
      const row = Math.floor(corner.y / TILE_SIZE);
      if (level1Map[row] && level1Map[row][col] === 1) {
        return true;
      }
    }
    return false;
  };
  
  const getRandomSafePosition = () => {
    let pos;
    let attempts = 0;
    do {
      const randCol = Math.floor(Math.random() * MAP_COLS);
      const randRow = Math.floor(Math.random() * MAP_ROWS);
      if (level1Map[randRow][randCol] === 0) {
        pos = {
          x: randCol * TILE_SIZE + TILE_SIZE / 2,
          y: randRow * TILE_SIZE + TILE_SIZE / 2,
        };
      }
      attempts++;
    } while (!pos && attempts < 100);
    return pos || { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 };
  };

  const isSafeDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }) => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy) >= commonConfig.safeDistance;
  };

  useEffect(() => {
    soundsRef.current = {
      orbCollect: new Howl({ src: [orbCollect], volume: 0.5 }),
      guardianAlert: new Howl({ src: [guardianAlert], volume: 0.6 }),
      gameOver: new Howl({ src: [gameOver], volume: 0.7 }),
      victory: new Howl({ src: [victory], volume: 0.7 }),
      background: new Howl({ src: [backgroundMusic], loop: true, volume: 0.3 }),
    };
    return () => { if (soundsRef.current) Object.values(soundsRef.current).forEach(sound => sound.unload()); };
  }, []);

  useEffect(() => {
    if (soundsRef.current) {
      if (!muted && isActive) {
        if (!soundsRef.current.background.playing()) soundsRef.current.background.play();
      } else {
        soundsRef.current.background.stop();
      }
    }
  }, [muted, isActive]);

  useEffect(() => { onPlayerNameLoaded(playerName || "Player"); }, [onPlayerNameLoaded]);
  useEffect(() => { if (onLevelChange) onLevelChange(currentLevel); }, [currentLevel, onLevelChange]);
  useEffect(() => { if (onTimerUpdate) onTimerUpdate(timeRemaining); if (onTimerActive) onTimerActive(timerStarted.current && timeRemaining > 0); }, [timeRemaining, onTimerUpdate, onTimerActive]);
 
  useEffect(() => {
    if (!timerStarted.current || !isActive || gameState !== 'playing' || isCelebrating.current) return;
    const intervalId = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = Math.max(0, prev - 1);
        if (newTime === 0) {
          const collected = memoryOrbs.current.filter(o => o.collected).length;
          if (collected < memoryOrbs.current.length) {
            timerStarted.current = false;
            saveGameState();
            onGameStateChange('gameOver');
            if (soundsRef.current && !muted) soundsRef.current.gameOver.play();
          }
        }
        return newTime;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isActive, gameState, muted]);

  const saveGameState = () => {
    const state: SavedGameState = {
      player: { ...player.current },
      memoryOrbs: memoryOrbs.current.map(orb => ({ ...orb })),
      guardians: guardians.current.map(guard => ({ ...guard })),
      memoriesCollected: memoryOrbs.current.filter(orb => orb.collected).length,
      playerName,
      currentLevel,
      timeRemaining,
    };
    localStorage.setItem('gameState', JSON.stringify(state));
  };

  const resetGameState = (level: number = 1) => {
    firstRender.current = true;
    isCelebrating.current = false; // Ensure celebration is off
    confettiParticles.current = [];
    
    const config = getLevelConfig(level);
    
    player.current = { ...getRandomSafePosition(), size: 20 };
    
    const newOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[] = [];
    const newGuardians: Guardian[] = [];
    
    const spawnedPositions: {x: number, y: number}[] = [player.current];

    for (let i = 0; i < config.orbs; i++) {
        let newPos;
        do {
          newPos = getRandomSafePosition();
        } while (spawnedPositions.some(p => !isSafeDistance(newPos, p)));
        spawnedPositions.push(newPos);
        newOrbs.push({ ...newPos, collected: false, pulse: Math.random() * Math.PI * 2, collectingTime: 0 });
    }

    for (let i = 0; i < config.guards; i++) {
        let newPos;
        do {
          newPos = getRandomSafePosition();
        } while (spawnedPositions.some(p => !isSafeDistance(newPos, p)));
        spawnedPositions.push(newPos);
        newGuardians.push({ ...newPos, directionX: Math.random() > 0.5 ? 1 : -1, directionY: Math.random() > 0.5 ? 1 : -1, alert: false });
    }

    memoryOrbs.current = newOrbs;
    guardians.current = newGuardians;
    previousMemoryCount.current = 0;
    alertedGuardians.current.clear();
    
    timerStarted.current = true;
    setTimeRemaining(config.timer);
    setCurrentLevel(level);
    setGameState('playing');
    setIsLoading(false);
    onGameStateChange('playing');
    saveGameState();
  };

  // NEW: Expose controls to parent component for starting new game or retrying after game over
  useImperativeHandle(ref, () => ({
    reset: () => resetGameState(1), // Starts a fresh game at level 1
    retry: () => { // Restarts with a penalty (drop 1 level)
      const newLevel = Math.max(1, currentLevel - 1);
      resetGameState(newLevel);
    }
  }));

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    let animationId: number;
    let roomShift = { x: 0, y: 0, intensity: 0 };
    const keys: { [key: string]: boolean } = {};

    const spriteImage = new Image(); spriteImage.src = spriteSheet;
    const guardImage = new Image(); guardImage.src = guardSpriteSheet;
    const leftImg = new Image(); leftImg.src = leftImage;
    const rightImg = new Image(); rightImg.src = rightImage;

    const handleKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape') onGameStateChange('paused'); if (e.key.toLowerCase() === 'r') resetGameState(currentLevel); };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const render = () => {
      if (!ctx || isLoading) { if (animationId) cancelAnimationFrame(animationId); return; }
      
      const orbs = memoryOrbs.current;
      const guards = guardians.current;
      const config = getLevelConfig(currentLevel);
      const currentMemoryCount = orbs.filter(orb => orb.collected).length;
      
      // --- REFACTORED: UPDATE LOGIC (runs only when game is active) ---
      if (isActive && !isCelebrating.current) {
        // Orb collection check
        if (currentMemoryCount > previousMemoryCount.current) {
          roomShift.intensity = 0.5;
          previousMemoryCount.current = currentMemoryCount;
          timerStarted.current = true;
          guards.forEach(g => { g.alert = false; });
          alertedGuardians.current.clear();
          if (soundsRef.current && !muted) soundsRef.current.orbCollect.play();
          onMemoryCollected();
          saveGameState();
        }

        // Player Movement
        const speed = 3;
        if (keys['w'] || keys['arrowup'] || mobileDirection.up) {
          const nextY = player.current.y - speed; if (!isCollidingWithWall(player.current.x, nextY, player.current.size)) player.current.y = nextY;
        }
        if (keys['s'] || keys['arrowdown'] || mobileDirection.down) {
          const nextY = player.current.y + speed; if (!isCollidingWithWall(player.current.x, nextY, player.current.size)) player.current.y = nextY;
        }
        if (keys['a'] || keys['arrowleft'] || mobileDirection.left) {
          const nextX = player.current.x - speed; if (!isCollidingWithWall(nextX, player.current.y, player.current.size)) player.current.x = nextX;
        }
        if (keys['d'] || keys['arrowright'] || mobileDirection.right) {
          const nextX = player.current.x + speed; if (!isCollidingWithWall(nextX, player.current.y, player.current.size)) player.current.x = nextX;
        }
        
        // Orb update logic
        orbs.forEach(orb => {
          if (orb.collected) return;
          orb.pulse += 0.05;
          const dx = player.current.x - orb.x;
          const dy = player.current.y - orb.y;
          if (Math.sqrt(dx * dx + dy * dy) < player.current.size + 15) orb.collected = true;
        });

        // Guardian update logic
        guards.forEach((guardian, index) => {
          const dxToPlayer = player.current.x - guardian.x;
          const dyToPlayer = player.current.y - guardian.y;
          const distanceToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer);
          
          if (!guardian.alert && distanceToPlayer < commonConfig.guardianVisionRange) {
              const moveAngle = Math.atan2(guardian.directionY, guardian.directionX);
              const angleToPlayer = Math.atan2(dyToPlayer, dxToPlayer);
              let angleDiff = Math.abs(moveAngle - angleToPlayer);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
              if (angleDiff < commonConfig.guardianVisionAngle / 2) {
                  let canSeePlayer = true;
                  const steps = Math.floor(distanceToPlayer / 5);
                  for (let i = 1; i <= steps; i++) {
                      if (isCollidingWithWall(guardian.x + (dxToPlayer / steps) * i, guardian.y + (dyToPlayer / steps) * i, 5)) {
                          canSeePlayer = false; break;
                      }
                  }
                  if (canSeePlayer && !firstRender.current) {
                      guardian.alert = true;
                      alertedGuardians.current.add(index);
                      if (soundsRef.current && !muted) soundsRef.current.guardianAlert.play();
                  }
              }
          }
          
          const baseSpeed = guardian.alert ? config.guardSpeed * 1.5 : config.guardSpeed;
          const speed = baseSpeed + currentMemoryCount * 0.3;
          if (guardian.alert && distanceToPlayer > 5) {
              const nextX = guardian.x + (dxToPlayer / distanceToPlayer) * speed; if(!isCollidingWithWall(nextX, guardian.y, 20)) guardian.x = nextX;
              const nextY = guardian.y + (dyToPlayer / distanceToPlayer) * speed; if(!isCollidingWithWall(guardian.x, nextY, 20)) guardian.y = nextY;
          } else if (!guardian.alert) {
              let nextX = guardian.x + guardian.directionX * speed; let nextY = guardian.y + guardian.directionY * speed;
              if (isCollidingWithWall(nextX, guardian.y, 20) || Math.random() < 0.01) { guardian.directionX *= -1; nextX = guardian.x; }
              if (isCollidingWithWall(guardian.x, nextY, 20) || Math.random() < 0.01) { guardian.directionY *= -1; nextY = guardian.y; }
              guardian.x = nextX; guardian.y = nextY;
          }
          if (distanceToPlayer < 25 && !firstRender.current) { onGameStateChange('gameOver'); }
        });
        
        // Victory/Next Level condition check
        if (currentMemoryCount === orbs.length && orbs.length > 0) {
          if (currentLevel < commonConfig.MAX_LEVELS) {
            setIsLoading(true);
            setLoadingMessage(`Level ${currentLevel + 1}`);
            setTimeout(() => resetGameState(currentLevel + 1), 2000);
          } else if (!isCelebrating.current) { // Last level completed
            // --- NEW: START VICTORY CELEBRATION ---
            isCelebrating.current = true;
            for (let i = 0; i < 200; i++) {
              confettiParticles.current.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height,
                vx: (Math.random() - 0.5) * 5,
                vy: Math.random() * 5 + 3,
                size: Math.random() * 8 + 4,
                color: `hsl(${Math.random() * 360}, 100%, 70%)`,
                opacity: 1
              });
            }
            saveGameState();
            if (soundsRef.current && !muted) soundsRef.current.victory.play();
            setTimeout(() => {
              onGameStateChange('victory');
              isCelebrating.current = false;
              confettiParticles.current = [];
            }, 4000); // Celebrate for 4 seconds
          }
        }
      }
      
      // Room shake effect update
      if (roomShift.intensity > 0) {
        roomShift.intensity -= 0.03;
        roomShift.x = (Math.random() - 0.5) * roomShift.intensity * 10;
        roomShift.y = (Math.random() - 0.5) * roomShift.intensity * 10;
      }

      // --- ALWAYS-ON DRAWING LOGIC ---
      ctx.save();
      ctx.translate(roomShift.x, roomShift.y);
      const gradient = ctx.createLinearGradient(0, 0, 800, 600);
      gradient.addColorStop(0, 'hsl(225, 25%, 8%)');
      gradient.addColorStop(0.5, 'hsl(270, 40%, 15%)');
      gradient.addColorStop(1, 'hsl(280, 30%, 20%)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-roomShift.x, -roomShift.y, 800, 600); // Draw background behind shake

      level1Map.forEach((row, rowIndex) => {
        row.forEach((tile, colIndex) => { if (tile === 1) { ctx.fillStyle = 'hsl(280, 20%, 25%)'; ctx.fillRect(colIndex * TILE_SIZE, rowIndex * TILE_SIZE, TILE_SIZE, TILE_SIZE); ctx.strokeStyle = 'hsl(280, 50%, 40%)'; ctx.strokeRect(colIndex * TILE_SIZE, rowIndex * TILE_SIZE, TILE_SIZE, TILE_SIZE); }});
      });

      orbs.forEach(orb => {
        if (orb.collected) return;
        const glowSize = 15 + Math.sin(orb.pulse) * 5;
        const orbGradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, glowSize);
        orbGradient.addColorStop(0, 'hsl(280, 80%, 75%)'); orbGradient.addColorStop(0.7, 'hsl(270, 70%, 65%)'); orbGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = orbGradient; ctx.beginPath(); ctx.arc(orb.x, orb.y, glowSize, 0, Math.PI * 2); ctx.fill();
      });

      guards.forEach((guardian) => {
        if (!guardian.alert) {
          const moveAngle = Math.atan2(guardian.directionY, guardian.directionX);
          ctx.save(); ctx.fillStyle = 'rgba(255, 255, 0, 0.1)'; ctx.beginPath(); ctx.moveTo(guardian.x, guardian.y); ctx.arc(guardian.x, guardian.y, commonConfig.guardianVisionRange, moveAngle - commonConfig.guardianVisionAngle / 2, moveAngle + commonConfig.guardianVisionAngle / 2); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        if (guardImage.complete) { ctx.drawImage(guardImage, guardian.x - 32, guardian.y - 32, 64, 64); }
        if (guardian.alert) { ctx.fillStyle = 'red'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('!', guardian.x - 5, guardian.y - 35); }
      });
      
      let pDirection = 'idle';
      if (keys['a'] || keys['arrowleft'] || mobileDirection.left) pDirection = 'left';
      if (keys['d'] || keys['arrowright'] || mobileDirection.right) pDirection = 'right';
      if (pDirection === 'left' && leftImg.complete) { ctx.drawImage(leftImg, player.current.x - 32, player.current.y - 32, 64, 64); } 
      else if (pDirection === 'right' && rightImg.complete) { ctx.drawImage(rightImg, player.current.x - 32, player.current.y - 32, 64, 64); } 
      else if (spriteImage.complete) { ctx.drawImage(spriteImage, player.current.x - 32, player.current.y - 32, 64, 64); } 
      else { ctx.fillStyle = 'blue'; ctx.beginPath(); ctx.arc(player.current.x, player.current.y, player.current.size, 0, Math.PI * 2); ctx.fill(); }

      // --- NEW: Victory Celebration Drawing ---
      if (isCelebrating.current) {
        confettiParticles.current.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.opacity -= 0.005;
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        ctx.globalAlpha = 1; // Reset alpha
      }
      
      ctx.restore();
      if (firstRender.current) firstRender.current = false;
      animationId = requestAnimationFrame(render);
    };

    if (isActive) {
      if (gameState === 'idle') { resetGameState(1); }
      render();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isActive, onGameStateChange, onMemoryCollected, playerName, muted, currentLevel, mobileDirection, difficulty]);

  return (
    <div className="w-full h-full flex justify-center items-center relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full border-2 border-primary/30 rounded-lg shadow-2xl shadow-primary/20 bg-card"
        style={{ imageRendering: 'pixelated' }}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <h2 className="font-dream text-4xl font-bold text-primary animate-pulse-glow">{loadingMessage}</h2>
            <p className="text-lg text-foreground">Preparing the Memory Palace...</p>
            <div className="loader animate-spin rounded-full h-12 w-12 border-t-4 border-primary mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
});

GameCanvas.displayName = 'GameCanvas';