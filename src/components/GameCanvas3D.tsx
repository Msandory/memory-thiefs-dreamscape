import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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

// Simple 3D Wall Component
function Wall({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#444444" />
    </mesh>
  );
}

// Simple 3D Player Component
function Player({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#4ECDC4" emissive="#2C7873" emissiveIntensity={0.3} />
    </mesh>
  );
}

// Simple 3D Memory Orb Component
function MemoryOrb({ 
  position, 
  collected, 
  pulse, 
  onClick 
}: { 
  position: [number, number, number], 
  collected: boolean, 
  pulse: number,
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

  return (
    <mesh ref={meshRef} position={position} onClick={onClick}>
      <sphereGeometry args={[0.3, 12, 12]} />
      <meshStandardMaterial color="#9B59B6" emissive="#8E44AD" emissiveIntensity={0.5} />
    </mesh>
  );
}

// Simple 3D Guardian Component
function Guardian({ position, alert }: { position: [number, number, number], alert: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <boxGeometry args={[0.6, 1.2, 0.6]} />
        <meshStandardMaterial color={alert ? "#E74C3C" : "#7F8C8D"} />
      </mesh>
      {alert && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#E74C3C" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
}

// Simple 3D Game Scene Component
function GameScene({ 
  playerPosition,
  memoryOrbs,
  guardians,
  onOrbClick,
  roomShift,
  mazeLayout
}: { 
  playerPosition: [number, number, number],
  memoryOrbs: Array<{ x: number; y: number; collected: boolean; pulse: number }>,
  guardians: Array<{ x: number; y: number; alert: boolean }>,
  onOrbClick: (index: number) => void,
  roomShift: { x: number, y: number, intensity: number },
  mazeLayout: number[][]
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current && roomShift.intensity > 0) {
      groupRef.current.position.x = roomShift.x * roomShift.intensity;
      groupRef.current.position.z = roomShift.y * roomShift.intensity;
    }
  });

  // Generate 3D walls from 2D maze
  const walls: JSX.Element[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (mazeLayout[row] && mazeLayout[row][col] === 1) {
        const x = (col - MAP_COLS / 2) * 2;
        const z = (row - MAP_ROWS / 2) * 2;
        walls.push(
          <Wall 
            key={`wall-${row}-${col}`}
            position={[x, 1, z]} 
          />
        );
      }
    }
  }

  return (
    <group ref={groupRef}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[MAP_COLS * 2, MAP_ROWS * 2]} />
        <meshStandardMaterial color="#2C3E50" />
      </mesh>

      {/* Walls */}
      {walls}

      {/* Player */}
      <Player position={playerPosition} />

      {/* Memory Orbs */}
      {memoryOrbs.map((orb, index) => (
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

      {/* Guardians */}
      {guardians.map((guardian, index) => (
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

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#9B59B6" />
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
    console.error("Detailed Firebase error:", error);
  }
}

export const GameCanvas3D = forwardRef<any, GameCanvasProps>(({
  isActive, onGameStateChange, onMemoryCollected, playerName, onPlayerNameLoaded, muted, onTimerUpdate, onTimerActive, onLevelChange, mobileDirection = { up: false, down: false, left: false, right: false }, difficulty, mind, mazeId, onScoreUpdate,
}, ref) => {
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [roomShift, setRoomShift] = useState({ x: 0, y: 0, intensity: 0 });
  const [player, setPlayer] = useState({ x: 100, y: 100, size: 20 });
  const [memoryOrbs, setMemoryOrbs] = useState<{ x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [currentMazeLayout, setCurrentMazeLayout] = useState<number[][]>([]);
  
  const soundsRef = useRef<{ orbCollect: Howl; guardianAlert: Howl; gameOver: Howl; victory: Howl; background: Howl; } | null>(null);
  const timerStarted = useRef(false);

  const getCurrentRoomLayout = useCallback(() => {
    if (currentMazeLayout.length > 0) {
      return currentMazeLayout;
    }
    
    const maze = getMaze(mazeId);
    if (maze && maze.layout) {
      setCurrentMazeLayout(maze.layout);
      return maze.layout;
    }
    const fallbackLayout = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(0));
    setCurrentMazeLayout(fallbackLayout);
    return fallbackLayout;
  }, [mazeId, currentMazeLayout]);

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

  const getRandomSafePosition = useCallback(() => { 
    const currentMap = getCurrentRoomLayout(); 
    let pos; 
    let attempts = 0; 
    do { 
      const randCol = Math.floor(Math.random() * MAP_COLS); 
      const randRow = Math.floor(Math.random() * MAP_ROWS); 
      if (currentMap[randRow] && currentMap[randRow][randCol] === 0) { 
        pos = { x: randCol * TILE_SIZE + TILE_SIZE / 2, y: randRow * TILE_SIZE + TILE_SIZE / 2, }; 
      } 
      attempts++; 
    } while (!pos && attempts < 100); 
    return pos || { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 }; 
  }, [getCurrentRoomLayout]);

  // Handle orb collection in 3D
  const handleOrbClick = useCallback((orbIndex: number) => {
    const orb = memoryOrbs[orbIndex];
    if (!orb || orb.collected) return;

    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 60) {
      const newOrbs = [...memoryOrbs];
      newOrbs[orbIndex] = { ...orb, collected: true, collectingTime: Date.now() };
      setMemoryOrbs(newOrbs);
      
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
  }, [memoryOrbs, player, score, muted, onMemoryCollected, onScoreUpdate]);

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
  const resetGameState = useCallback((level: number = 1) => { 
    setActivePowerUps([]); 
    
    const config = getLevelConfig(level); 
    const newPlayerPos = getRandomSafePosition();
    setPlayer({ ...newPlayerPos, size: 20 }); 
    
    // Initialize orbs and guardians
    const newOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[] = []; 
    const newGuardians: Guardian[] = []; 
    const spawnedPositions: {x: number, y: number}[] = [newPlayerPos]; 
    
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
    
    for (let i = 0; i < config.guards; i++) { 
      let newPos; 
      do { 
        newPos = getRandomSafePosition(); 
      } while (spawnedPositions.some(p => {
        const dx = newPos.x - p.x;
        const dy = newPos.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) < commonConfig.safeDistance;
      })); 
      spawnedPositions.push(newPos); 
      newGuardians.push({ ...newPos, directionX: Math.random() > 0.5 ? 1 : -1, directionY: Math.random() > 0.5 ? 1 : -1, alert: false }); 
    } 
    
    setMemoryOrbs(newOrbs); 
    setGuardians(newGuardians); 
    timerStarted.current = true; 
    setTimeRemaining(config.timer); 
    setCurrentLevel(level); 
    setGameState('playing'); 
    onGameStateChange('playing'); 
  }, [getLevelConfig, getRandomSafePosition, onGameStateChange]);

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
      const speed = 5;
      const currentMap = getCurrentRoomLayout();
      
      setPlayer(prevPlayer => {
        let newX = prevPlayer.x;
        let newY = prevPlayer.y;

        switch (e.key.toLowerCase()) {
          case 'w':
          case 'arrowup':
            newY = prevPlayer.y - speed;
            break;
          case 's':
          case 'arrowdown':
            newY = prevPlayer.y + speed;
            break;
          case 'a':
          case 'arrowleft':
            newX = prevPlayer.x - speed;
            break;
          case 'd':
          case 'arrowright':
            newX = prevPlayer.x + speed;
            break;
          case 'escape':
            onGameStateChange('paused');
            return prevPlayer;
          default:
            return prevPlayer;
        }

        // Check collision
        const newCol = Math.floor(newX / TILE_SIZE);
        const newRow = Math.floor(newY / TILE_SIZE);
        
        if (newRow >= 0 && newRow < MAP_ROWS && newCol >= 0 && newCol < MAP_COLS &&
            currentMap[newRow] && currentMap[newRow][newCol] === 0) {
          return { ...prevPlayer, x: newX, y: newY };
        }
        
        return prevPlayer;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, gameState, onGameStateChange, getCurrentRoomLayout]);

  // Initialize game on mount
  useEffect(() => {
    if (isActive && gameState === 'idle') {
      resetGameState(1);
    }
  }, [isActive, gameState, resetGameState]);

  const playerPosition: [number, number, number] = [
    (player.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
    1,
    (player.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
  ];

  return (
    <div className="w-full h-full bg-background">
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 10, 10], fov: 75 }}
      >
        <OrbitControls 
          enablePan={false} 
          enableZoom={true} 
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={5}
          maxDistance={20}
        />
        <GameScene 
          playerPosition={playerPosition}
          memoryOrbs={memoryOrbs}
          guardians={guardians}
          onOrbClick={handleOrbClick}
          roomShift={roomShift}
          mazeLayout={getCurrentRoomLayout()}
        />
      </Canvas>
    </div>
  );
});

GameCanvas3D.displayName = 'GameCanvas3D';