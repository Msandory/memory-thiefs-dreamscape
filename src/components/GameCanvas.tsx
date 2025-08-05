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

// --- NEW: Map and Wall Configuration ---
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

// Configuration for game levels
const gameConfig = {
  MAX_LEVELS: 10,
  baseTimer: 30,
  timerIncrement: 2,
  baseGuardSpeed: 1, // Slightly slower base speed for tight corridors
  speedIncrement: 0.5,
  initialOrbs: 2,
  orbsPerLevel: 1,
  initialGuards: 1,
  guardsPerLevel: 1,
  safeDistance: 100, // Distance for spawning items away from each other
  guardianVisionRange: 120,
  guardianVisionAngle: Math.PI / 3, // 60 degrees
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
}

interface Guardian {
  x: number;
  y: number;
  directionX: number; // Use separate X/Y directions now
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

export const GameCanvas = forwardRef<any, GameCanvasProps>(({
  isActive,
  onGameStateChange,
  memoriesCollected,
  onMemoryCollected,
  playerName,
  onPlayerNameLoaded,
  muted,
  onTimerUpdate,
  onTimerActive,
  onLevelChange,
  mobileDirection = { up: false, down: false, left: false, right: false },
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
  const player = useRef({ x: 0, y: 0, size: 20 }); // Position will be set in reset
  const memoryOrbs = useRef<{ x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]>([]);
  const guardians = useRef<Guardian[]>([]);
  const previousMemoryCount = useRef(0);
  const alertedGuardians = useRef<Set<number>>(new Set());
  
  const getLevelConfig = (level: number) => ({
    orbs: gameConfig.initialOrbs + (level - 1) * gameConfig.orbsPerLevel,
    guards: gameConfig.initialGuards + (level - 1) * gameConfig.guardsPerLevel,
    guardSpeed: gameConfig.baseGuardSpeed + (level - 1) * gameConfig.speedIncrement,
    timer: gameConfig.baseTimer + (level - 1) * gameConfig.timerIncrement,
  });

  // --- NEW: Helper function to check for wall collision ---
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
  
  // --- MODIFIED: Spawning function now finds safe, empty tiles ---
  const getRandomSafePosition = () => {
    let pos;
    let attempts = 0;
    do {
      const randCol = Math.floor(Math.random() * MAP_COLS);
      const randRow = Math.floor(Math.random() * MAP_ROWS);
      if (level1Map[randRow][randCol] === 0) { // Is it a floor tile?
        pos = {
          x: randCol * TILE_SIZE + TILE_SIZE / 2,
          y: randRow * TILE_SIZE + TILE_SIZE / 2,
        };
      }
      attempts++;
    } while (!pos && attempts < 100); // Failsafe
    return pos || { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 }; // Default spawn if random fails
  };

  const isSafeDistance = (pos1: { x: number; y: number }, pos2: { x: number; y: number }) => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy) >= gameConfig.safeDistance;
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
    if (!timerStarted.current || !isActive || gameState !== 'playing') return;
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

  useImperativeHandle(ref, () => ({ reset: () => resetGameState(1) }));

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
      if (!ctx || !isActive || isLoading) { if (animationId) cancelAnimationFrame(animationId); return; }

      const orbs = memoryOrbs.current;
      const guards = guardians.current;
      const config = getLevelConfig(currentLevel);

      const currentMemoryCount = orbs.filter(orb => orb.collected).length;
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

      if (roomShift.intensity > 0) {
        roomShift.intensity -= 0.03;
        roomShift.x = (Math.random() - 0.5) * roomShift.intensity * 10;
        roomShift.y = (Math.random() - 0.5) * roomShift.intensity * 10;
      }

      ctx.save();
      ctx.translate(roomShift.x, roomShift.y);

      // Draw background
      const gradient = ctx.createLinearGradient(0, 0, 800, 600);
      gradient.addColorStop(0, 'hsl(225, 25%, 8%)');
      gradient.addColorStop(0.5, 'hsl(270, 40%, 15%)');
      gradient.addColorStop(1, 'hsl(280, 30%, 20%)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 600);

      // --- NEW: Draw the walls ---
      level1Map.forEach((row, rowIndex) => {
        row.forEach((tile, colIndex) => {
          if (tile === 1) {
            const x = colIndex * TILE_SIZE;
            const y = rowIndex * TILE_SIZE;
            ctx.fillStyle = 'hsl(280, 20%, 25%)'; // Wall color
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'hsl(280, 50%, 40%)'; // Wall border
            ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
          }
        });
      });

      // Draw orbs (no changes needed here)
      orbs.forEach(orb => {
        if (orb.collected) return;
        orb.pulse += 0.05;
        const dx = player.current.x - orb.x;
        const dy = player.current.y - orb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.current.size + 15 && orb.collectingTime === 0) {
          orb.collectingTime = 0.01;
          orb.collected = true;
        }
        if (orb.collectingTime > 0) {
          orb.collectingTime += 0.03;
          if (orb.collectingTime >= 1) {
            orb.collected = true;
          }
        }
        const glowSize = 15 + Math.sin(orb.pulse) * 5;
        const alpha = orb.collectingTime > 0 ? 1 - orb.collectingTime : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        const orbGradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, glowSize);
        orbGradient.addColorStop(0, 'hsl(280, 80%, 75%)');
        orbGradient.addColorStop(0.7, 'hsl(270, 70%, 65%)');
        orbGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw guardians with wall collision Draw guardians with vision cones
       guards.forEach((guardian, index) => {
        const dxToPlayer = player.current.x - guardian.x;
        const dyToPlayer = player.current.y - guardian.y;
        const distanceToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer);
        
        // --- NEW: Guardian vision cone logic ---
        if (!guardian.alert) {
          const moveAngle = Math.atan2(guardian.directionY, guardian.directionX);
          const startAngle = moveAngle - gameConfig.guardianVisionAngle / 2;
          const endAngle = moveAngle + gameConfig.guardianVisionAngle / 2;

          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
          ctx.beginPath();
          ctx.moveTo(guardian.x, guardian.y);
          ctx.arc(guardian.x, guardian.y, gameConfig.guardianVisionRange, startAngle, endAngle);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Check if player is inside the vision cone
          if (distanceToPlayer < gameConfig.guardianVisionRange) {
              const angleToPlayer = Math.atan2(dyToPlayer, dxToPlayer);
              // Normalize angles to be able to compare them
              let angleDiff = Math.abs(moveAngle - angleToPlayer);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

              if (angleDiff < gameConfig.guardianVisionAngle / 2) {
                  // Final check: Line of sight
                  let canSeePlayer = true;
                  const steps = Math.floor(distanceToPlayer / 5);
                  for (let i = 1; i <= steps; i++) {
                      const checkX = guardian.x + (dxToPlayer / steps) * i;
                      const checkY = guardian.y + (dyToPlayer / steps) * i;
                      if (isCollidingWithWall(checkX, checkY, 5)) {
                          canSeePlayer = false;
                          break;
                      }
                  }
                  if (canSeePlayer && !firstRender.current) {
                      guardian.alert = true;
                      alertedGuardians.current.add(index);
                      if (soundsRef.current && !muted) soundsRef.current.guardianAlert.play();
                  }
              }
          }
        }
        
        // --- Guardian movement logic (same as before) ---
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
        
        // --- Guardian drawing logic (same as before) ---
        if (guardImage.complete) { ctx.drawImage(guardImage, guardian.x - 32, guardian.y - 32, 64, 64); }
        if (guardian.alert) { ctx.fillStyle = 'red'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('!', guardian.x - 5, guardian.y - 35); }
        if (distanceToPlayer < 25 && !firstRender.current) { onGameStateChange('gameOver'); }
      });
      
      // --- MODIFIED: Player movement with collision detection ---
      const speed = 3;
      let direction = 'idle';
      
      if (keys['w'] || keys['arrowup'] || mobileDirection.up) {
        const nextY = player.current.y - speed;
        if (!isCollidingWithWall(player.current.x, nextY, player.current.size)) player.current.y = nextY;
        direction = 'up';
      }
      if (keys['s'] || keys['arrowdown'] || mobileDirection.down) {
        const nextY = player.current.y + speed;
        if (!isCollidingWithWall(player.current.x, nextY, player.current.size)) player.current.y = nextY;
        direction = 'down';
      }
      if (keys['a'] || keys['arrowleft'] || mobileDirection.left) {
        const nextX = player.current.x - speed;
        if (!isCollidingWithWall(nextX, player.current.y, player.current.size)) player.current.x = nextX;
        direction = 'left';
      }
      if (keys['d'] || keys['arrowright'] || mobileDirection.right) {
        const nextX = player.current.x + speed;
        if (!isCollidingWithWall(nextX, player.current.y, player.current.size)) player.current.x = nextX;
        direction = 'right';
      }

      // Render player (no changes needed)
      if (direction === 'left' && leftImg.complete) { ctx.drawImage(leftImg, player.current.x - 32, player.current.y - 32, 64, 64); } 
      else if (direction === 'right' && rightImg.complete) { ctx.drawImage(rightImg, player.current.x - 32, player.current.y - 32, 64, 64); } 
      else if (spriteImage.complete) { ctx.drawImage(spriteImage, player.current.x - 32, player.current.y - 32, 64, 64); } 
      else { ctx.fillStyle = 'blue'; ctx.beginPath(); ctx.arc(player.current.x, player.current.y, player.current.size, 0, Math.PI * 2); ctx.fill(); }

      // Victory condition (no changes needed)
      if (currentMemoryCount === orbs.length && orbs.length > 0) {
        if (currentLevel < gameConfig.MAX_LEVELS) {
          setIsLoading(true);
          setLoadingMessage(`Level ${currentLevel + 1}`);
          setTimeout(() => resetGameState(currentLevel + 1), 2000);
        } else {
          saveGameState();
          onGameStateChange('victory');
          if (soundsRef.current && !muted) soundsRef.current.victory.play();
        }
        return; // Stop rendering this frame
      }

      if (firstRender.current) firstRender.current = false;
      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    if (isActive) {
      if (gameState === 'idle') {
        resetGameState(1);
      }
      render();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isActive, onGameStateChange, onMemoryCollected, playerName, muted, currentLevel, mobileDirection]);

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
            <h2 className="font-dream text-4xl font-bold text-primary animate-pulse-glow">
              {loadingMessage}
            </h2>
            <p className="text-lg text-foreground">Preparing the Memory Palace...</p>
            <div className="loader animate-spin rounded-full h-12 w-12 border-t-4 border-primary mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
});

GameCanvas.displayName = 'GameCanvas';