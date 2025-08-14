import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Howl } from "howler";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import orbCollect from '@/assets/audio/orb-collect.mp3';
import guardianAlert from '@/assets/audio/guardian-alert.mp3';
import gameOver from '@/assets/audio/game-over.mp3';
import victory from '@/assets/audio/victory.mp3';
import backgroundMusic from '@/assets/audio/background-music.mp3';
import brickWallTexture from '@/assets/sprites/brickWallTexture.avif';
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

// Enhanced 3D Wall Component with texture
function Wall({ position }: { position: [number, number, number] }) {
  const texture = useTexture(brickWallTexture);
  
  useEffect(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 2); // Repeat texture for better appearance
  }, [texture]);

  return (
    <mesh position={position}>
      <boxGeometry args={[2, 4, 2]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// 3D Player Model Component
function Player({ 
  position, 
  isMoving, 
  isRunningFast 
}: { 
  position: [number, number, number],
  isMoving: boolean,
  isRunningFast: boolean
}) {
  const groupRef = useRef<THREE.Group>(null);
  
  // For now, use a simple 3D representation until GLB model is available
  useFrame((state) => {
    if (groupRef.current && isMoving) {
      // Simple bob animation when moving
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 8) * 0.1;
    } else if (groupRef.current) {
      groupRef.current.position.y = position[1];
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Player body - visible in third person if needed */}
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.3, 1.6]} />
        <meshStandardMaterial color="#2E86AB" />
      </mesh>
      {/* Player head */}
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.25]} />
        <meshStandardMaterial color="#F4A261" />
      </mesh>
    </group>
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

// Enhanced 3D Guardian Component
function Guardian({ position, alert }: { position: [number, number, number], alert: boolean }) {
  const meshRef = useRef<THREE.Group>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += alert ? 0.05 : 0.02;
    }
    // Glowing eyes effect
    if (eyeLeftRef.current && eyeRightRef.current) {
      const intensity = alert ? 0.8 + Math.sin(state.clock.elapsedTime * 8) * 0.2 : 0.3;
      (eyeLeftRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      (eyeRightRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    }
  });

  return (
    <group ref={meshRef} position={position}>
      {/* Main body */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.8, 1.2, 0.6]} />
        <meshStandardMaterial color={alert ? "#E74C3C" : "#34495E"} />
      </mesh>
      
      {/* Head */}
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.5]} />
        <meshStandardMaterial color={alert ? "#C0392B" : "#2C3E50"} />
      </mesh>
      
      {/* Eyes */}
      <mesh ref={eyeLeftRef} position={[-0.15, 1.45, 0.26]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.3} />
      </mesh>
      <mesh ref={eyeRightRef} position={[0.15, 1.45, 0.26]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Arms */}
      <mesh position={[-0.5, 0.8, 0]}>
        <boxGeometry args={[0.3, 0.8, 0.3]} />
        <meshStandardMaterial color={alert ? "#E74C3C" : "#34495E"} />
      </mesh>
      <mesh position={[0.5, 0.8, 0]}>
        <boxGeometry args={[0.3, 0.8, 0.3]} />
        <meshStandardMaterial color={alert ? "#E74C3C" : "#34495E"} />
      </mesh>
      
      {/* Alert aura */}
      {alert && (
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[1.5, 12, 12]} />
          <meshStandardMaterial color="#E74C3C" transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
}

// First Person Game Scene Component
function GameScene({ 
  playerPosition,
  memoryOrbs,
  guardians,
  onOrbClick,
  roomShift,
  mazeLayout,
  playerMovement
}: { 
  playerPosition: [number, number, number],
  memoryOrbs: Array<{ x: number; y: number; collected: boolean; pulse: number }>,
  guardians: Array<{ x: number; y: number; alert: boolean }>,
  onOrbClick: (index: number) => void,
  roomShift: { x: number, y: number, intensity: number },
  mazeLayout: number[][],
  playerMovement: { isMoving: boolean, isRunningFast: boolean }
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const rotationRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ isLocked: false });

  // Mouse look controls
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleClick = () => {
      canvas.requestPointerLock();
    };

    const handlePointerLockChange = () => {
      mouseRef.current.isLocked = document.pointerLockElement === canvas;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseRef.current.isLocked) return;

      const sensitivity = 0.002;
      rotationRef.current.y -= event.movementX * sensitivity; // Horizontal rotation
      rotationRef.current.x -= event.movementY * sensitivity; // Vertical rotation

      // Clamp vertical rotation to prevent over-rotation
      rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));
    };

    canvas.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gl]);

  useFrame(() => {
    // Update camera position to player position for first person view
    camera.position.set(...playerPosition);
    
    // Apply mouse rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = rotationRef.current.y;
    camera.rotation.x = rotationRef.current.x;
    
    // Room shift effect
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
            position={[x, 2, z]} 
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

      {/* Player - hidden in first person, but keep for potential third person mode */}
      <Player 
        position={playerPosition} 
        isMoving={playerMovement?.isMoving || false}
        isRunningFast={playerMovement?.isRunningFast || false}
      />

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
  const [playerMovement, setPlayerMovement] = useState({ isMoving: false, isRunningFast: false });
  const keysPressed = useRef({ w: false, a: false, s: false, d: false });
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

  // Enhanced keyboard controls for 3D movement with proper state management
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        const moveKey = key === 'arrowup' ? 'w' : key === 'arrowdown' ? 's' : key === 'arrowleft' ? 'a' : key === 'arrowright' ? 'd' : key;
        if (moveKey === 'w' || moveKey === 'a' || moveKey === 's' || moveKey === 'd') {
          keysPressed.current[moveKey] = true;
        }
      }
      if (key === 'escape') {
        onGameStateChange('paused');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const moveKey = key === 'arrowup' ? 'w' : key === 'arrowdown' ? 's' : key === 'arrowleft' ? 'a' : key === 'arrowright' ? 'd' : key;
      if (moveKey === 'w' || moveKey === 'a' || moveKey === 's' || moveKey === 'd') {
        keysPressed.current[moveKey] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive, gameState, onGameStateChange]);

  // Movement loop with smooth movement and animation states
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;

    const moveInterval = setInterval(() => {
      const currentMap = getCurrentRoomLayout();
      const keys = keysPressed.current;
      const isMovingNow = keys.w || keys.a || keys.s || keys.d;
      
      // Check if player is near guardians for fast run mode
      const nearGuardian = guardians.some(guardian => {
        const dx = player.x - guardian.x;
        const dy = player.y - guardian.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < 100 && guardian.alert;
      });

      const speed = nearGuardian ? 8 : 4; // Faster when running from guardians
      
      setPlayerMovement({
        isMoving: isMovingNow,
        isRunningFast: nearGuardian && isMovingNow
      });

      if (isMovingNow) {
        setPlayer(prevPlayer => {
          let newX = prevPlayer.x;
          let newY = prevPlayer.y;

          if (keys.w) newY -= speed;
          if (keys.s) newY += speed;
          if (keys.a) newX -= speed;
          if (keys.d) newX += speed;

          // Check collision
          const newCol = Math.floor(newX / TILE_SIZE);
          const newRow = Math.floor(newY / TILE_SIZE);
          
          if (newRow >= 0 && newRow < MAP_ROWS && newCol >= 0 && newCol < MAP_COLS &&
              currentMap[newRow] && currentMap[newRow][newCol] === 0) {
            return { ...prevPlayer, x: newX, y: newY };
          }
          
          return prevPlayer;
        });
      }
    }, 16); // ~60fps

    return () => clearInterval(moveInterval);
  }, [isActive, gameState, getCurrentRoomLayout, guardians, player]);

  // Initialize game on mount
  useEffect(() => {
    if (isActive && gameState === 'idle') {
      resetGameState(1);
    }
  }, [isActive, gameState, resetGameState]);

  const playerPosition: [number, number, number] = [
    (player.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
    1.6, // Eye level height
    (player.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
  ];

  return (
    <div className="w-full h-full bg-background">
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ 
          position: playerPosition, 
          fov: 75,
          near: 0.1,
          far: 1000
        }}
      >
        {/* First person view - no orbit controls */}
        <GameScene 
          playerPosition={playerPosition}
          memoryOrbs={memoryOrbs}
          guardians={guardians}
          onOrbClick={handleOrbClick}
          roomShift={roomShift}
          mazeLayout={getCurrentRoomLayout()}
          playerMovement={playerMovement}
        />
      </Canvas>
    </div>
  );
});

GameCanvas3D.displayName = 'GameCanvas3D';