import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Box, Sphere, Plane, Text, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Howl } from "howler";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import orbCollect from '@/assets/audio/orb-collect.mp3';
import guardianAlert from '@/assets/audio/guardian-alert.mp3';
import gameOver from '@/assets/audio/game-over.mp3';
import victory from '@/assets/audio/victory.mp3';
import backgroundMusic from '@/assets/audio/background-music.mp3';
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

interface PowerUp { x: number; y: number; z: number; type: PowerUpType; collected: boolean; pulse: number; }
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
interface Guardian { x: number; y: number; z: number; directionX: number; directionZ: number; alert: boolean; }
interface SavedGameState { 
  player: { x: number; y: number; z: number; size: number }; 
  memoryOrbs: { x: number; y: number; z: number; collected: boolean; pulse: number; collectingTime: number }[]; 
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

// 3D Wall Component
function Wall({ position, size }: { position: [number, number, number], size: [number, number, number] }) {
  return (
    <Box position={position} args={size}>
      <meshStandardMaterial color="hsl(220, 30%, 20%)" />
    </Box>
  );
}

// 3D Player Component
function Player({ 
  position, 
  glow, 
  immunity 
}: { 
  position: [number, number, number], 
  glow: string | null, 
  immunity: boolean 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
    }
  });

  return (
    <group position={position}>
      <Sphere ref={meshRef} args={[0.5, 16, 16]}>
        <meshStandardMaterial 
          color={immunity ? "hsl(120, 100%, 60%)" : "hsl(200, 100%, 70%)"} 
          emissive={glow ? glow : undefined}
          emissiveIntensity={glow ? 0.3 : 0}
        />
      </Sphere>
      {immunity && (
        <Sphere args={[0.7, 16, 16]}>
          <meshStandardMaterial 
            color="hsl(120, 100%, 60%)" 
            transparent 
            opacity={0.3}
          />
        </Sphere>
      )}
    </group>
  );
}

// 3D Memory Orb Component
function MemoryOrb({ 
  position, 
  collected, 
  pulse, 
  isSpecial = false,
  specialType,
  onClick 
}: { 
  position: [number, number, number], 
  collected: boolean, 
  pulse: number,
  isSpecial?: boolean,
  specialType?: string,
  onClick: () => void 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && !collected) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + pulse) * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime + pulse;
    }
  });

  if (collected) return null;

  const getOrbColor = () => {
    if (isSpecial && specialType) {
      return SPECIAL_ORB_TYPES[specialType as keyof typeof SPECIAL_ORB_TYPES]?.color || '#FFD700';
    }
    return "hsl(280, 100%, 70%)";
  };

  return (
    <Sphere 
      ref={meshRef}
      position={position} 
      args={[0.3, 12, 12]} 
      onClick={onClick}
    >
      <meshStandardMaterial 
        color={getOrbColor()}
        emissive={getOrbColor()}
        emissiveIntensity={0.5}
      />
    </Sphere>
  );
}

// 3D Guardian Component
function Guardian({ 
  position, 
  alert 
}: { 
  position: [number, number, number], 
  alert: boolean 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group position={position}>
      <Box ref={meshRef} args={[0.6, 1.2, 0.6]}>
        <meshStandardMaterial 
          color={alert ? "hsl(0, 100%, 60%)" : "hsl(0, 0%, 30%)"} 
          emissive={alert ? "hsl(0, 100%, 30%)" : undefined}
          emissiveIntensity={alert ? 0.3 : 0}
        />
      </Box>
      {alert && (
        <Sphere args={[1, 8, 8]} position={[0, 0.5, 0]}>
          <meshStandardMaterial 
            color="hsl(0, 100%, 50%)" 
            transparent 
            opacity={0.2}
          />
        </Sphere>
      )}
    </group>
  );
}

// 3D PowerUp Component
function PowerUp({ 
  position, 
  type, 
  collected, 
  pulse, 
  onClick 
}: { 
  position: [number, number, number], 
  type: PowerUpType, 
  collected: boolean, 
  pulse: number,
  onClick: () => void 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && !collected) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3 + pulse) * 0.1;
      meshRef.current.rotation.x = state.clock.elapsedTime + pulse;
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.5 + pulse;
    }
  });

  if (collected) return null;

  const getPowerUpColor = () => {
    switch (type) {
      case 'timer': return 'hsl(60, 100%, 70%)';
      case 'thunder': return 'hsl(280, 100%, 70%)';
      case 'immunity': return 'hsl(120, 100%, 70%)';
      case 'speed': return 'hsl(200, 100%, 70%)';
    }
  };

  return (
    <Box 
      ref={meshRef}
      position={position} 
      args={[0.4, 0.4, 0.4]} 
      onClick={onClick}
    >
      <meshStandardMaterial 
        color={getPowerUpColor()}
        emissive={getPowerUpColor()}
        emissiveIntensity={0.3}
      />
    </Box>
  );
}

// 3D Game Scene Component
function GameScene({ 
  gameRefs, 
  roomShift, 
  onOrbClick, 
  onPowerUpClick,
  activePowerUps 
}: { 
  gameRefs: any, 
  roomShift: { x: number, y: number, intensity: number },
  onOrbClick: (index: number) => void,
  onPowerUpClick: (index: number) => void,
  activePowerUps: ActivePowerUp[]
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current && roomShift.intensity > 0) {
      groupRef.current.position.x = roomShift.x * roomShift.intensity;
      groupRef.current.position.z = roomShift.y * roomShift.intensity;
    }
  });

  const currentMap = gameRefs.getCurrentRoomLayout();
  const walls: JSX.Element[] = [];

  // Generate 3D walls from 2D maze
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (currentMap[row] && currentMap[row][col] === 1) {
        const x = (col - MAP_COLS / 2) * 2;
        const z = (row - MAP_ROWS / 2) * 2;
        walls.push(
          <Wall 
            key={`wall-${row}-${col}`}
            position={[x, 1, z]} 
            size={[2, 2, 2]} 
          />
        );
      }
    }
  }

  const getPlayerGlow = () => {
    if (activePowerUps.length === 0) return null;
    if (activePowerUps.some(p => p.type === 'immunity')) return 'hsl(120, 100%, 60%)';
    if (activePowerUps.some(p => p.type === 'speed')) return 'hsl(200, 100%, 60%)';
    return 'hsl(280, 100%, 60%)';
  };

  const hasImmunity = () => activePowerUps.some(p => p.type === 'immunity');

  return (
    <group ref={groupRef}>
      {/* Floor */}
      <Plane args={[MAP_COLS * 2, MAP_ROWS * 2]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <meshStandardMaterial color="hsl(240, 20%, 10%)" />
      </Plane>

      {/* Walls */}
      {walls}

      {/* Player */}
      <Player 
        position={[
          (gameRefs.player.current.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
          1,
          (gameRefs.player.current.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
        ]}
        glow={getPlayerGlow()}
        immunity={hasImmunity()}
      />

      {/* Memory Orbs */}
      {gameRefs.memoryOrbs.current.map((orb: any, index: number) => (
        <MemoryOrb
          key={`orb-${index}`}
          position={[
            (orb.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            1.5,
            (orb.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
          ]}
          collected={orb.collected}
          pulse={orb.pulse}
          onClick={() => onOrbClick(index)}
        />
      ))}

      {/* Special Orb */}
      {gameRefs.specialOrb.current && !gameRefs.specialOrb.current.collected && (
        <MemoryOrb
          position={[
            (gameRefs.specialOrb.current.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            1.5,
            (gameRefs.specialOrb.current.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
          ]}
          collected={gameRefs.specialOrb.current.collected}
          pulse={gameRefs.specialOrb.current.pulse}
          isSpecial={true}
          specialType={gameRefs.specialOrb.current.type}
          onClick={() => {/* Handle special orb click */}}
        />
      )}

      {/* Guardians */}
      {gameRefs.guardians.current.map((guardian: any, index: number) => (
        <Guardian
          key={`guardian-${index}`}
          position={[
            (guardian.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            1,
            (guardian.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
          ]}
          alert={guardian.alert}
        />
      ))}

      {/* PowerUps */}
      {gameRefs.powerUps.current.map((powerUp: any, index: number) => (
        <PowerUp
          key={`powerup-${index}`}
          position={[
            (powerUp.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            1.5,
            (powerUp.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
          ]}
          type={powerUp.type}
          collected={powerUp.collected}
          pulse={powerUp.pulse}
          onClick={() => onPowerUpClick(index)}
        />
      ))}

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1} 
        castShadow 
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="hsl(280, 100%, 70%)" />
    </group>
  );
}

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

export const GameCanvas3D = forwardRef<any, GameCanvasProps>(({
  isActive, onGameStateChange, onMemoryCollected, playerName, onPlayerNameLoaded, muted, onTimerUpdate, onTimerActive, onLevelChange, mobileDirection = { up: false, down: false, left: false, right: false }, difficulty, mind, mazeId, onScoreUpdate,
}, ref) => {
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [roomShift, setRoomShift] = useState({ x: 0, y: 0, intensity: 0 });
  
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
  const totalTimePlayed = useRef(0);
  const specialOrb = useRef<SpecialOrb | null>(null);
  const challengeManager = useRef<MiniChallengeManager>(new MiniChallengeManager(MINI_CHALLENGES));
  const orbsCollectedWithoutAlert = useRef(0);
  const levelStartTime = useRef(0);
  const currentMazeLayout = useRef<number[][]>([]);

  // Game logic functions, effects, etc.

  const getCurrentRoomLayout = () => {
    if (currentMazeLayout.current && currentMazeLayout.current.length > 0) {
      return currentMazeLayout.current;
    }
    
    const maze = getMaze(mazeId);
    if (maze && maze.layout) {
      currentMazeLayout.current = maze.layout;
      return maze.layout;
    }
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

  // Handle orb collection in 3D
  const handleOrbClick = useCallback((orbIndex: number) => {
    const orb = memoryOrbs.current[orbIndex];
    if (!orb || orb.collected) return;

    const dx = player.current.x - orb.x;
    const dy = player.current.y - orb.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 60) {
      orb.collected = true;
      orb.collectingTime = Date.now();
      
      const newScore = score + 1;
      setScore(newScore);
      onScoreUpdate?.(newScore);
      onMemoryCollected();

      // Room shift effect
      setRoomShift({
        x: (Math.random() - 0.5) * 0.5,
        y: (Math.random() - 0.5) * 0.5,
        intensity: 1
      });

      setTimeout(() => {
        setRoomShift(prev => ({ ...prev, intensity: 0 }));
      }, 300);

      if (soundsRef.current && !muted) {
        soundsRef.current.orbCollect.play();
      }
    }
  }, [score, muted, onMemoryCollected, onScoreUpdate]);

  // Handle power-up collection in 3D
  const handlePowerUpClick = useCallback((powerUpIndex: number) => {
    const powerUp = powerUps.current[powerUpIndex];
    if (!powerUp || powerUp.collected) return;

    const dx = player.current.x - powerUp.x;
    const dy = player.current.y - powerUp.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 60) {
      powerUp.collected = true;
      // Activate power-up logic here
    }
  }, []);

  // Initialize sounds
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

  // Game initialization and reset logic
  const resetGameState = (level: number = 1) => { 
    firstRender.current = true; 
    powerUps.current = []; 
    activePowerUps.current = []; 
    thunderCharges.current = 0; 
    if (level === 1) { 
      totalTimePlayed.current = 0; 
    } 
    const config = getLevelConfig(level); 
    player.current = { ...getRandomSafePosition(), size: 20 }; 
    
    // Initialize orbs and guardians
    const newOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[] = []; 
    const newGuardians: Guardian[] = []; 
    const spawnedPositions: {x: number, y: number}[] = [player.current]; 
    
    for (let i = 0; i < config.orbs; i++) { 
      let newPos; 
      do { 
        newPos = getRandomSafePosition(); 
      } while (spawnedPositions.some(p => {
        const dx = newPos.x - p.x;
        const dy = newPos.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) < commonConfig.safeDistance;
      })); 
      spawnedPositions.push(newPos); 
      newOrbs.push({ ...newPos, collected: false, pulse: Math.random() * Math.PI * 2, collectingTime: 0 }); 
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
  };

  useImperativeHandle(ref, () => ({
    reset: () => resetGameState(1),
    retry: () => {
      const newLevel = Math.max(1, currentLevel - 1);
      resetGameState(newLevel);
    },
    useThunder: () => {}
  }));

  // Keyboard controls for 3D movement
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const speed = 5; // 3D movement speed
      const currentMap = getCurrentRoomLayout();
      
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          const newY = player.current.y - speed;
          const newRow = Math.floor(newY / TILE_SIZE);
          const col = Math.floor(player.current.x / TILE_SIZE);
          if (currentMap[newRow] && currentMap[newRow][col] === 0) {
            player.current.y = newY;
          }
          break;
        case 's':
        case 'arrowdown':
          const newY2 = player.current.y + speed;
          const newRow2 = Math.floor(newY2 / TILE_SIZE);
          const col2 = Math.floor(player.current.x / TILE_SIZE);
          if (currentMap[newRow2] && currentMap[newRow2][col2] === 0) {
            player.current.y = newY2;
          }
          break;
        case 'a':
        case 'arrowleft':
          const newX = player.current.x - speed;
          const newCol = Math.floor(newX / TILE_SIZE);
          const row = Math.floor(player.current.y / TILE_SIZE);
          if (currentMap[row] && currentMap[row][newCol] === 0) {
            player.current.x = newX;
          }
          break;
        case 'd':
        case 'arrowright':
          const newX2 = player.current.x + speed;
          const newCol2 = Math.floor(newX2 / TILE_SIZE);
          const row2 = Math.floor(player.current.y / TILE_SIZE);
          if (currentMap[row2] && currentMap[row2][newCol2] === 0) {
            player.current.x = newX2;
          }
          break;
        case 'escape':
          onGameStateChange('paused');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, gameState, onGameStateChange]);

  const gameRefs = {
    player,
    memoryOrbs,
    guardians,
    powerUps,
    specialOrb,
    getCurrentRoomLayout
  };

  return (
    <div className="w-full h-full bg-background">
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 10, 10], fov: 75 }}
        shadows
      >
        <PerspectiveCamera makeDefault position={[0, 10, 10]} />
        <OrbitControls 
          enablePan={false} 
          enableZoom={true} 
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={5}
          maxDistance={20}
        />
        <GameScene 
          gameRefs={gameRefs}
          roomShift={roomShift}
          onOrbClick={handleOrbClick}
          onPowerUpClick={handlePowerUpClick}
          activePowerUps={activePowerUps.current}
        />
      </Canvas>
    </div>
  );
});

GameCanvas3D.displayName = 'GameCanvas3D';
