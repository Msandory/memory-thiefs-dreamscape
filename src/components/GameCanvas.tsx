import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Howl } from "howler";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import orbCollect from '@/assets/audio/orb-collect.mp3';
import guardianAlert from '@/assets/audio/guardian-alert.mp3';
import gameOver from '@/assets/audio/game-over.mp3';
import victory from '@/assets/audio/victory.mp3';
import backgroundMusic from '@/assets/audio/background-music.mp3';
import spriteSheet from '@/assets/sprites/player-sprite-sheet.png';
import leftImage from '@/assets/sprites/left.png';
import rightImage from '@/assets/sprites/right.png';
import guardSpriteSheet from '@/assets/sprites/guard-sprite-sheet.png';
import timerIcon from '@/assets/sprites/timericon.png';
import thunderIcon from '@/assets/sprites/thundericon.png';
import shieldIcon from '@/assets/sprites/sheildicon.png';
import speedIcon from '@/assets/sprites/speedicon.png';
import { 
  TILE_SIZE, 
  MAP_COLS, 
  MAP_ROWS, 
  Difficulty, 
  MindType, 
  PowerUpType, 
  difficultyConfigs, 
  commonConfig,
  MINI_CHALLENGES,
  SpecialOrb,
  SPECIAL_ORB_TYPES
} from '@/config/gameConfig';
import { getMaze } from '@/utils/mazeGenerator';
import { 
  MiniChallengeManager, 
  generateSpecialOrb, 
  shouldTriggerChallenge,
  GameChallengeState 
} from '@/utils/miniChallenges';

interface PowerUp { x: number; y: number; type: PowerUpType; collected: boolean; pulse: number; }
interface ActivePowerUp { type: PowerUpType; duration: number; maxDuration: number; }
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
  difficulty: Difficulty;
  mind: MindType;
  mazeId: string;
  onScoreUpdate?: (score: number) => void;
}
interface Guardian { x: number; y: number; directionX: number; directionY: number; alert: boolean; }
interface SavedGameState { 
  player: { x: number; y: number; size: number }; 
  memoryOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]; 
  guardians: Guardian[]; 
  memoriesCollected: number; 
  playerName: string; 
  currentLevel: number; 
  timeRemaining: number; 
  powerUps: PowerUp[]; 
  activePowerUps: ActivePowerUp[]; 
  totalTimePlayed: number;
  specialOrb: SpecialOrb | null;
  score: number;
}
interface ConfettiParticle { x: number; y: number; vx: number; vy: number; color: string; size: number; opacity: number; }

async function saveScore(playerName: string, time: number, difficulty: Difficulty, score: number, mind: MindType) {
  try {
    const docRef = await addDoc(collection(db, "scores"), {
      playerName,
      time,
      difficulty,
      score,
      mind,
      date: new Date().toISOString()
    });
    console.log(`Score saved with ID: ${docRef.id}`);
  } catch (error) {
    console.error("Detailed Firebase error:", {
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details
    });
  }
}

export const GameCanvas = forwardRef<any, GameCanvasProps>(({
  isActive, onGameStateChange, onMemoryCollected, playerName, onPlayerNameLoaded, muted, onTimerUpdate, onTimerActive, onLevelChange, mobileDirection = { up: false, down: false, left: false, right: false }, difficulty, mind, mazeId, onScoreUpdate,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [score, setScore] = useState(0);
  const soundsRef = useRef<{ orbCollect: Howl; guardianAlert: Howl; gameOver: Howl; victory: Howl; background: Howl; } | null>(null);
  const firstRender = useRef(true);
  const timerStarted = useRef(false);
  const player = useRef({ x: 0, y: 0, size: 20 });
  const memoryOrbs = useRef<{ x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]>([]);
  const guardians = useRef<Guardian[]>([]);
  const previousMemoryCount = useRef(0);
  const alertedGuardians = useRef<Set<number>>(new Set());
  const powerUps = useRef<PowerUp[]>([]);
  const activePowerUps = useRef<ActivePowerUp[]>([]);
  const thunderCharges = useRef(0);
  const isCelebrating = useRef(false);
  const confettiParticles = useRef<ConfettiParticle[]>([]);
  const totalTimePlayed = useRef(0);
  const specialOrb = useRef<SpecialOrb | null>(null);
  const challengeManager = useRef<MiniChallengeManager>(new MiniChallengeManager(MINI_CHALLENGES));
  const orbsCollectedWithoutAlert = useRef(0);
  const levelStartTime = useRef(0);
  const currentMazeLayout = useRef<number[][]>([]);

  const getCurrentRoomLayout = () => {
    // Check if we already have the layout for this mazeId
    if (currentMazeLayout.current && currentMazeLayout.current.length > 0) {
      return currentMazeLayout.current;
    }
    
    const maze = getMaze(mazeId);
    if (maze && maze.layout) {
      currentMazeLayout.current = maze.layout;
      return maze.layout;
    }
    // Fallback to empty room if maze not found
    const fallbackLayout = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(0));
    currentMazeLayout.current = fallbackLayout;
    return fallbackLayout;
  };
  const getLevelConfig = (level: number) => { 
    const diffConfig = difficultyConfigs[difficulty]; 
    return { 
      orbs: commonConfig.initialOrbs + (level - 1) * commonConfig.orbsPerLevel, 
      guards: diffConfig.initialGuards + Math.floor((level - 1) * diffConfig.guardsPerLevel), 
      guardSpeed: diffConfig.baseGuardSpeed + (level - 1) * diffConfig.speedIncrement, 
      timer: diffConfig.baseTimer + (level - 1) * diffConfig.timerIncrement, 
      powerUpChance: diffConfig.powerUpChance, 
    }; 
  };
  const isCollidingWithWall = (x: number, y: number, size: number) => { 
    const currentMap = getCurrentRoomLayout(); 
    const halfSize = size / 2; 
    const corners = [ 
      { x: x - halfSize, y: y - halfSize }, 
      { x: x + halfSize, y: y - halfSize }, 
      { x: x - halfSize, y: y + halfSize }, 
      { x: x + halfSize, y: y + halfSize }, 
    ]; 
    for (const corner of corners) { 
      const col = Math.floor(corner.x / TILE_SIZE); 
      const row = Math.floor(corner.y / TILE_SIZE); 
      if (currentMap[row] && currentMap[row][col] === 1) { 
        return true; 
      } 
    } 
    return false; 
  };
  const getRandomSafePosition = () => { 
    const currentMap = getCurrentRoomLayout(); 
    let pos; 
    let attempts = 0; 
    do { 
      const randCol = Math.floor(Math.random() * MAP_COLS); 
      const randRow = Math.floor(Math.random() * MAP_ROWS); 
      if (currentMap[randRow][randCol] === 0) { 
        pos = { x: randCol * TILE_SIZE + TILE_SIZE / 2, y: randRow * TILE_SIZE + TILE_SIZE / 2, }; 
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
  const generatePowerUps = (level: number) => { 
    if (level < commonConfig.powerUpStartLevel) return []; 
    const config = getLevelConfig(level); 
    const newPowerUps: PowerUp[] = []; 
    const spawnedPositions = [...memoryOrbs.current, ...guardians.current, player.current]; 
    const powerUpCount = difficulty === 'easy' ? 2 : Math.random() < config.powerUpChance ? (Math.random() < 0.5 ? 1 : 2) : 1; 
    for (let i = 0; i < powerUpCount; i++) { 
      let type: PowerUpType; 
      const rand = Math.random(); 
      if (timeRemaining <= config.timer * 0.5 && rand < 0.4) { 
        type = 'timer'; 
      } else if (rand < 0.25) { 
        type = 'speed'; 
      } else if (rand < 0.5) { 
        type = 'immunity'; 
      } else if (rand < 0.75) { 
        type = 'thunder'; 
      } else { 
        type = 'timer'; 
      } 
      let newPos; 
      do { 
        newPos = getRandomSafePosition(); 
      } while (spawnedPositions.some(p => !isSafeDistance(newPos, p))); 
      spawnedPositions.push(newPos); 
      newPowerUps.push({ ...newPos, type, collected: false, pulse: Math.random() * Math.PI * 2, }); 
    } 
    return newPowerUps; 
  };
  const activatePowerUp = (type: PowerUpType) => { 
    switch (type) { 
      case 'speed': 
        activePowerUps.current.push({ type: 'speed', duration: 8, maxDuration: 8 }); 
        break; 
      case 'immunity': 
        activePowerUps.current.push({ type: 'immunity', duration: 10, maxDuration: 10 }); 
        break; 
      case 'thunder': 
        thunderCharges.current += 1; 
        break; 
      case 'timer': 
        const config = getLevelConfig(currentLevel); 
        const timeBonus = Math.floor(config.timer * 0.3); 
        setTimeRemaining(prev => prev + timeBonus); 
        break; 
    } 
  };
  const useThunder = () => { 
    if (thunderCharges.current > 0 && guardians.current.length > 0) { 
      const closestGuardIndex = guardians.current.findIndex(guard => { 
        const dx = player.current.x - guard.x; 
        const dy = player.current.y - guard.y; 
        return Math.sqrt(dx * dx + dy * dy) < 150; 
      }); 
      if (closestGuardIndex !== -1) { 
        guardians.current.splice(closestGuardIndex, 1); 
      } else if (guardians.current.length > 0) { 
        const randomIndex = Math.floor(Math.random() * guardians.current.length); 
        guardians.current.splice(randomIndex, 1); 
      } 
      thunderCharges.current -= 1; 
    } 
  };
  const hasImmunity = () => activePowerUps.current.some(p => p.type === 'immunity');
  const getSpeedMultiplier = () => { 
    const speedPowerUp = activePowerUps.current.find(p => p.type === 'speed'); 
    return speedPowerUp ? 2 : 1; 
  };
  useEffect(() => { 
    soundsRef.current = { 
      orbCollect: new Howl({ src: [orbCollect], volume: 0.5 }), 
      guardianAlert: new Howl({ src: [guardianAlert], volume: 0.6 }), 
      gameOver: new Howl({ src: [gameOver], volume: 0.7 }), 
      victory: new Howl({ src: [victory], volume: 0.7 }), 
      background: new Howl({ src: [backgroundMusic], loop: true, volume: 0.3 }), 
    }; 
    return () => { 
      if (soundsRef.current) Object.values(soundsRef.current).forEach(sound => sound.unload()); 
    }; 
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
    if (!isActive || gameState !== 'playing') return; 
    const intervalId = setInterval(() => { 
      activePowerUps.current = activePowerUps.current.filter(powerUp => { 
        powerUp.duration -= 1; 
        return powerUp.duration > 0; 
      }); 
    }, 1000); 
    return () => clearInterval(intervalId); 
  }, [isActive, gameState]);
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
      powerUps: powerUps.current.map(p => ({ ...p })), 
      activePowerUps: activePowerUps.current.map(p => ({ ...p })), 
      totalTimePlayed: totalTimePlayed.current,
      specialOrb: specialOrb.current,
      score 
    }; 
    localStorage.setItem('gameState', JSON.stringify(state));
  };
  const resetGameState = (level: number = 1) => { 
    firstRender.current = true; 
    isCelebrating.current = false; 
    confettiParticles.current = []; 
    powerUps.current = []; 
    activePowerUps.current = []; 
    thunderCharges.current = 0; 
    if (level === 1) { 
      totalTimePlayed.current = 0; 
    } 
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
    powerUps.current = generatePowerUps(level); 
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
  useImperativeHandle(ref, () => ({
    reset: () => resetGameState(1),
    retry: () => {
      const newLevel = Math.max(1, currentLevel - 1);
      resetGameState(newLevel);
    },
    useThunder: () => useThunder()
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
    const spriteImage = new Image(); 
    spriteImage.src = spriteSheet; 
    const guardImage = new Image(); 
    guardImage.src = guardSpriteSheet; 
    const leftImg = new Image(); 
    leftImg.src = leftImage; 
    const rightImg = new Image(); 
    rightImg.src = rightImage; 
    const timerImg = new Image(); 
    timerImg.src = timerIcon; 
    const thunderImg = new Image(); 
    thunderImg.src = thunderIcon; 
    const shieldImg = new Image(); 
    shieldImg.src = shieldIcon; 
    const speedImg = new Image(); 
    speedImg.src = speedIcon;
    const handleKeyDown = (e: KeyboardEvent) => { 
      keys[e.key.toLowerCase()] = true; 
      if (e.key === 'Escape') onGameStateChange('paused'); 
      if (e.key.toLowerCase() === 'r') resetGameState(currentLevel); 
      if (e.key === ' ' || e.key === 'Spacebar') { 
        e.preventDefault(); 
        useThunder(); 
      } 
    };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown); 
    window.addEventListener('keyup', handleKeyUp);
    const getPowerUpIcon = (type: PowerUpType) => { 
      switch (type) { 
        case 'timer': return timerImg; 
        case 'thunder': return thunderImg; 
        case 'immunity': return shieldImg; 
        case 'speed': return speedImg; 
      } 
    };
    const getPowerUpGlowColor = (type: PowerUpType) => { 
      switch (type) { 
        case 'timer': return 'hsl(60, 100%, 70%)'; 
        case 'thunder': return 'hsl(280, 100%, 70%)'; 
        case 'immunity': return 'hsl(120, 100%, 70%)'; 
        case 'speed': return 'hsl(200, 100%, 70%)'; 
      } 
    };
    const getPlayerGlow = () => { 
      if (activePowerUps.current.length === 0) return null; 
      if (activePowerUps.current.some(p => p.type === 'immunity')) return 'hsl(120, 100%, 60%)'; 
      if (activePowerUps.current.some(p => p.type === 'speed')) return 'hsl(200, 100%, 60%)'; 
      return 'hsl(280, 100%, 60%)'; 
    };

    const render = () => {
      if (!ctx || isLoading) { 
        if (animationId) cancelAnimationFrame(animationId); 
        return; 
      }
      const orbs = memoryOrbs.current; 
      const guards = guardians.current; 
      const powerUpItems = powerUps.current;
      const config = getLevelConfig(currentLevel); 
      const currentMemoryCount = orbs.filter(orb => orb.collected).length;
      const currentMap = getCurrentRoomLayout();
      if (isActive && !isCelebrating.current) {
        if (currentMemoryCount > previousMemoryCount.current) { 
          const timeTakenForLevel = config.timer - timeRemaining; 
          totalTimePlayed.current += timeTakenForLevel; 
          roomShift.intensity = 1.5; 
          previousMemoryCount.current = currentMemoryCount; 
          timerStarted.current = true; 
          guards.forEach(g => { g.alert = false; }); 
          alertedGuardians.current.clear(); 
          if (soundsRef.current && !muted) soundsRef.current.orbCollect.play(); 
          onMemoryCollected(); 
          saveGameState(); 
        }
        powerUpItems.forEach(powerUp => { 
          if (powerUp.collected) return; 
          const dx = player.current.x - powerUp.x; 
          const dy = player.current.y - powerUp.y; 
          if (Math.sqrt(dx * dx + dy * dy) < player.current.size + 20) { 
            powerUp.collected = true; 
            activatePowerUp(powerUp.type); 
            roomShift.intensity = 0.3; 
            if (soundsRef.current && !muted) soundsRef.current.orbCollect.play(); 
          } 
        });
        const alertedGuardCount = guards.filter(g => g.alert).length;
        const sprintMultiplier = Math.min(1.6, 1 + alertedGuardCount * 0.2);
        const speed = 4.5 * getSpeedMultiplier() * sprintMultiplier;
        if (keys['w'] || keys['arrowup'] || mobileDirection.up) { 
          const nextY = player.current.y - speed; 
          if (!isCollidingWithWall(player.current.x, nextY, player.current.size)) player.current.y = nextY; 
        }
        if (keys['s'] || keys['arrowdown'] || mobileDirection.down) { 
          const nextY = player.current.y + speed; 
          if (!isCollidingWithWall(player.current.x, nextY, player.current.size)) player.current.y = nextY; 
        }
        if (keys['a'] || keys['arrowleft'] || mobileDirection.left) { 
          const nextX = player.current.x - speed; 
          if (!isCollidingWithWall(nextX, player.current.y, player.current.size)) player.current.x = nextX; 
        }
        if (keys['d'] || keys['arrowright'] || mobileDirection.right) { 
          const nextX = player.current.x + speed; 
          if (!isCollidingWithWall(nextX, player.current.y, player.current.size)) player.current.x = nextX; 
        }
        orbs.forEach(orb => { 
          if (orb.collected) return; 
          orb.pulse += 0.05; 
          const dx = player.current.x - orb.x; 
          const dy = player.current.y - orb.y; 
          if (Math.sqrt(dx * dx + dy * dy) < player.current.size + 15) orb.collected = true; 
        });
        powerUpItems.forEach(powerUp => { 
          if (!powerUp.collected) { 
            powerUp.pulse += 0.08; 
          } 
        });
        guards.forEach((guardian, index) => { 
          const dxToPlayer = player.current.x - guardian.x; 
          const dyToPlayer = player.current.y - guardian.y; 
          const distanceToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer); 
          const canDetectPlayer = !hasImmunity(); 
          if (!guardian.alert && distanceToPlayer < commonConfig.guardianVisionRange && canDetectPlayer) { 
            const moveAngle = Math.atan2(guardian.directionY, guardian.directionX); 
            const angleToPlayer = Math.atan2(dyToPlayer, dxToPlayer); 
            let angleDiff = Math.abs(moveAngle - angleToPlayer); 
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff; 
            if (angleDiff < commonConfig.guardianVisionAngle / 2) { 
              let canSeePlayer = true; 
              const steps = Math.floor(distanceToPlayer / 5); 
              for (let i = 1; i <= steps; i++) { 
                if (isCollidingWithWall(guardian.x + (dxToPlayer / steps) * i, guardian.y + (dyToPlayer / steps) * i, 5)) { 
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
          const baseSpeed = guardian.alert ? config.guardSpeed * 1.5 : config.guardSpeed; 
          const guardSpeed = baseSpeed + currentMemoryCount * 0.3; 
          if (guardian.alert && distanceToPlayer > 5 && canDetectPlayer) { 
            const nextX = guardian.x + (dxToPlayer / distanceToPlayer) * guardSpeed; 
            if(!isCollidingWithWall(nextX, guardian.y, 20)) guardian.x = nextX; 
            const nextY = guardian.y + (dyToPlayer / distanceToPlayer) * guardSpeed; 
            if(!isCollidingWithWall(guardian.x, nextY, 20)) guardian.y = nextY; 
          } else if (!guardian.alert) { 
            let nextX = guardian.x + guardian.directionX * guardSpeed; 
            let nextY = guardian.y + guardian.directionY * guardSpeed; 
            if (isCollidingWithWall(nextX, guardian.y, 20) || Math.random() < 0.01) { 
              guardian.directionX *= -1; 
              nextX = guardian.x; 
            } 
            if (isCollidingWithWall(guardian.x, nextY, 20) || Math.random() < 0.01) { 
              guardian.directionY *= -1; 
              nextY = guardian.y; 
            } 
            guardian.x = nextX; 
            guardian.y = nextY; 
          } 
          if (distanceToPlayer < 25 && !firstRender.current && !hasImmunity()) { 
            onGameStateChange('gameOver'); 
          } 
        });
        if (currentMemoryCount === orbs.length && orbs.length > 0) {
          if (currentLevel < commonConfig.MAX_LEVELS) {
            setIsLoading(true); 
            setLoadingMessage(`Level ${currentLevel + 1}`);
            setTimeout(() => resetGameState(currentLevel + 1), 2000);
          } else if (!isCelebrating.current) {
            const timeTakenForLevel = config.timer - timeRemaining;
            totalTimePlayed.current += timeTakenForLevel;
            try {
              const finalScore = { 
                playerName: playerName || "Wanderer", 
                time: totalTimePlayed.current, 
                difficulty: difficulty, 
                date: new Date().toISOString(), 
              };
              // Save to localStorage
              const existingScoresJSON = localStorage.getItem('gameScores');
              const scores = existingScoresJSON ? JSON.parse(existingScoresJSON) : [];
              scores.push(finalScore);
              localStorage.setItem('gameScores', JSON.stringify(scores));
              // Save to Firebase, including playerName as user identifier
              saveScore(playerName || "Wanderer", totalTimePlayed.current, difficulty, score, mind);
            } catch (error) {
              console.error("Failed to save score to localStorage:", error);
            }
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
            }, 4000);
          }
        }
      }
      if (roomShift.intensity > 0) { 
        roomShift.intensity -= 0.03; 
        roomShift.x = (Math.random() - 0.5) * roomShift.intensity * 10; 
        roomShift.y = (Math.random() - 0.5) * roomShift.intensity * 10; 
      }
      ctx.save(); 
      ctx.translate(roomShift.x, roomShift.y);
      const gradient = ctx.createLinearGradient(0, 0, 800, 600); 
      gradient.addColorStop(0, 'hsl(225, 25%, 8%)'); 
      gradient.addColorStop(0.5, 'hsl(270, 40%, 15%)'); 
      gradient.addColorStop(1, 'hsl(280, 30%, 20%)');
      ctx.fillStyle = gradient; 
      ctx.fillRect(-roomShift.x, -roomShift.y, 800, 600);
      currentMap.forEach((row, rowIndex) => { 
        row.forEach((tile, colIndex) => { 
          if (tile === 1) { 
            ctx.fillStyle = 'hsl(280, 20%, 25%)'; 
            ctx.fillRect(colIndex * TILE_SIZE, rowIndex * TILE_SIZE, TILE_SIZE, TILE_SIZE); 
            ctx.strokeStyle = 'hsl(280, 50%, 40%)'; 
            ctx.strokeRect(colIndex * TILE_SIZE, rowIndex * TILE_SIZE, TILE_SIZE, TILE_SIZE); 
          } 
        }); 
      });
      orbs.forEach(orb => { 
        if (orb.collected) return; 
        const glowSize = 15 + Math.sin(orb.pulse) * 5; 
        const orbGradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, glowSize); 
        orbGradient.addColorStop(0, 'hsl(280, 80%, 75%)'); 
        orbGradient.addColorStop(0.7, 'hsl(270, 70%, 65%)'); 
        orbGradient.addColorStop(1, 'transparent'); 
        ctx.fillStyle = orbGradient; 
        ctx.beginPath(); 
        ctx.arc(orb.x, orb.y, glowSize, 0, Math.PI * 2); 
        ctx.fill(); 
      });
      powerUpItems.forEach(powerUp => { 
        if (powerUp.collected) return; 
        const glowSize = 25 + Math.sin(powerUp.pulse) * 8; 
        const glowColor = getPowerUpGlowColor(powerUp.type); 
        const powerUpGradient = ctx.createRadialGradient(powerUp.x, powerUp.y, 0, powerUp.x, powerUp.y, glowSize); 
        powerUpGradient.addColorStop(0, glowColor); 
        powerUpGradient.addColorStop(0.6, glowColor.replace('70%)', '30%)')); 
        powerUpGradient.addColorStop(1, 'transparent'); 
        ctx.fillStyle = powerUpGradient; 
        ctx.beginPath(); 
        ctx.arc(powerUp.x, powerUp.y, glowSize, 0, Math.PI * 2); 
        ctx.fill(); 
        const icon = getPowerUpIcon(powerUp.type); 
        if (icon.complete) { 
          ctx.drawImage(icon, powerUp.x - 20, powerUp.y - 20, 40, 40); 
        } else { 
          ctx.fillStyle = glowColor; 
          ctx.beginPath(); 
          ctx.arc(powerUp.x, powerUp.y, 15, 0, Math.PI * 2); 
          ctx.fill(); 
        } 
      });
      guards.forEach((guardian) => { 
        if (!guardian.alert && !hasImmunity()) { 
          const moveAngle = Math.atan2(guardian.directionY, guardian.directionX); 
          ctx.save(); 
          ctx.fillStyle = 'rgba(255, 255, 0, 0.1)'; 
          ctx.beginPath(); 
          ctx.moveTo(guardian.x, guardian.y); 
          ctx.arc(guardian.x, guardian.y, commonConfig.guardianVisionRange, moveAngle - commonConfig.guardianVisionAngle / 2, moveAngle + commonConfig.guardianVisionAngle / 2); 
          ctx.closePath(); 
          ctx.fill(); 
          ctx.restore(); 
        } 
        if (guardImage.complete) { 
          ctx.drawImage(guardImage, guardian.x - 32, guardian.y - 32, 64, 64); 
        } 
        if (guardian.alert) { 
          ctx.fillStyle = 'red'; 
          ctx.font = 'bold 30px sans-serif'; 
          ctx.fillText('!', guardian.x - 5, guardian.y - 35); 
        } 
      });
      const playerGlow = getPlayerGlow(); 
      if (playerGlow) { 
        const playerGlowGradient = ctx.createRadialGradient(player.current.x, player.current.y, 0, player.current.x, player.current.y, 40); 
        playerGlowGradient.addColorStop(0, playerGlow); 
        playerGlowGradient.addColorStop(0.7, playerGlow.replace('60%)', '20%)')); 
        playerGlowGradient.addColorStop(1, 'transparent'); 
        ctx.fillStyle = playerGlowGradient; 
        ctx.beginPath(); 
        ctx.arc(player.current.x, player.current.y, 40, 0, Math.PI * 2); 
        ctx.fill(); 
      }
      let pDirection = 'idle'; 
      if (keys['a'] || keys['arrowleft'] || mobileDirection.left) pDirection = 'left'; 
      if (keys['d'] || keys['arrowright'] || mobileDirection.right) pDirection = 'right'; 
      if (pDirection === 'left' && leftImg.complete) { 
        ctx.drawImage(leftImg, player.current.x - 32, player.current.y - 32, 64, 64); 
      } else if (pDirection === 'right' && rightImg.complete) { 
        ctx.drawImage(rightImg, player.current.x - 32, player.current.y - 32, 64, 64); 
      } else if (spriteImage.complete) { 
        ctx.drawImage(spriteImage, player.current.x - 32, player.current.y - 32, 64, 64); 
      } else { 
        ctx.fillStyle = 'blue'; 
        ctx.beginPath(); 
        ctx.arc(player.current.x, player.current.y, player.current.size, 0, Math.PI * 2); 
        ctx.fill(); 
      }
      if (isCelebrating.current) { 
        confettiParticles.current.forEach(p => { 
          p.x += p.vx; 
          p.y += p.vy; 
          p.opacity -= 0.005; 
          ctx.globalAlpha = p.opacity; 
          ctx.fillStyle = p.color; 
          ctx.fillRect(p.x, p.y, p.size, p.size); 
        }); 
        ctx.globalAlpha = 1; 
      }
      ctx.restore();
      if (activePowerUps.current.length > 0 || thunderCharges.current > 0) {
        ctx.save();
        const panelWidth = 300;
        const panelPadding = 10;
        const lineHeight = 18;
        const titleHeight = 25;
        let panelHeight = titleHeight + (panelPadding * 2);
        panelHeight += activePowerUps.current.length * lineHeight;
        if (thunderCharges.current > 0) {
          panelHeight += lineHeight;
        }
        const panelX = (canvas.width - panelWidth) / 2;
        const panelY = 15;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        ctx.strokeStyle = 'hsl(280, 50%, 40%)';
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        ctx.textAlign = 'center';
        const textCenterX = canvas.width / 2;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('Active Power-ups', textCenterX, panelY + titleHeight - 5);
        let yOffset = panelY + titleHeight + lineHeight;
        ctx.font = '14px sans-serif';
        activePowerUps.current.forEach(powerUp => {
          const color = getPowerUpGlowColor(powerUp.type);
          ctx.fillStyle = color;
          ctx.fillText(`${powerUp.type.toUpperCase()}: ${Math.ceil(powerUp.duration)}s`, textCenterX, yOffset);
          yOffset += lineHeight;
        });
        if (thunderCharges.current > 0) {
          ctx.fillStyle = getPowerUpGlowColor('thunder');
          ctx.fillText(`Thunder Charges: ${thunderCharges.current} (Press SPACE)`, textCenterX, yOffset);
        }
        ctx.restore();
      }
      if (firstRender.current) firstRender.current = false;
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
  }, [isActive, onGameStateChange, onMemoryCollected, playerName, muted, currentLevel, mobileDirection, difficulty]);

  return (
    <div className="w-full h-full flex justify-center items-center relative">
      <canvas ref={canvasRef} className="w-full h-full border-2 border-primary/30 rounded-lg shadow-2xl shadow-primary/20 bg-card" style={{ imageRendering: 'pixelated' }} />
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