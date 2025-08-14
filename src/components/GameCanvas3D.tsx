import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
  commonConfig, // Ensure this is correctly imported
  MINI_CHALLENGES, // Not used in provided code, but kept if needed later
  SpecialOrb, // Not used in provided code, but kept if needed later
  SPECIAL_ORB_TYPES // Not used in provided code, but kept if needed later
} from '@/config/gameConfig';
import { getMaze } from '@/utils/mazeGenerator';
import { useGLTF, useAnimations } from '@react-three/drei'; // New import for 3D models
import { GLTF } from 'three-stdlib'; // For GLTF type safety

// --- Type Definitions ---
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
interface Guardian { x: number; y: number; directionX: number; directionY: number; alert: boolean; rotationY: number; } // Added rotationY

// --- 3D Components ---

// Enhanced 3D Wall Component with better lighting
function Wall({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[2, 2, 2]} /> {/* Walls are 2 units tall, 2 units wide/deep */}
      <meshLambertMaterial color="#4A4A4A" />
    </mesh>
  );
}

// Player representation for third-person view (when enabled)
function PlayerModel({ 
  position, 
  rotation, 
  visible = false 
}: { 
  position: [number, number, number], 
  rotation: [number, number, number],
  visible?: boolean 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && visible) {
      // Slight bob animation when visible
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 4) * 0.05;
    }
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <capsuleGeometry args={[0.3, 1.2, 4, 8]} />
      <meshLambertMaterial color="#3498DB" />
    </mesh>
  );
}

// Enhanced 3D Memory Orb Component with better lighting
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
  const lightRef = useRef<THREE.PointLight>(null);
  
  useFrame((state) => {
    if (meshRef.current && !collected) {
      // Orbs float slightly above the floor (Y=0)
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2 + pulse) * 0.3;
      meshRef.current.rotation.y = state.clock.elapsedTime + pulse;
      
      // Animate the point light intensity
      if (lightRef.current) {
        lightRef.current.intensity = 0.5 + Math.sin(state.clock.elapsedTime * 3 + pulse) * 0.3;
      }
    }
  });

  if (collected) return null;

  return (
    <group>
      <mesh ref={meshRef} position={position} onClick={onClick}>
        <sphereGeometry args={[commonConfig.orbRadius / (TILE_SIZE / 2), 16, 16]} />
        <meshStandardMaterial 
          color="#9B59B6" 
          emissive="#8E44AD" 
          emissiveIntensity={0.8}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      {/* Add individual light for each orb */}
      <pointLight 
        ref={lightRef}
        position={position} 
        color="#9B59B6" 
        intensity={0.5} 
        distance={8}
        decay={2}
      />
    </group>
  );
}

// Type for GLTF model, adjust based on your GLB structure
type GuardianGLTFResult = GLTF & {
  nodes: {
    // If your GLB has specific named meshes, list them here. Otherwise, you might not need `nodes`.
  };
  animations: THREE.AnimationClip[];
};

// Enhanced 3D Guardian Component (using GLB model)
interface GuardianModelProps {
  position: [number, number, number];
  alert: boolean;
  rotationY: number; // Y-axis rotation for facing direction
}

function GuardianModel({ position, alert, rotationY }: GuardianModelProps) {
  // Load the GLB model from the public folder
  const { scene, animations } = useGLTF('/assets/3DModels/guards.glb') as GuardianGLTFResult;
  const { actions, mixer } = useAnimations(animations, scene);
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  const lightRef = useRef<THREE.SpotLight>(null);

  // Set up animation logic
  useEffect(() => {
    // IMPORTANT: Replace 'Walking' and 'Running' with the actual animation clip names from your GLB.
    // Use a tool like https://gltf.report/ or https://sandbox.babylonjs.com/ to inspect your GLB.
    const walkAction = actions['Walking']; 
    const runAction = actions['Running']; 

    if (walkAction) walkAction.loop = THREE.LoopRepeat;
    if (runAction) runAction.loop = THREE.LoopRepeat;

    if (alert) {
      if (currentAction.current !== runAction) {
        currentAction.current?.fadeOut(0.2);
        runAction?.reset().fadeIn(0.2).play();
        currentAction.current = runAction;
      }
    } else {
      if (currentAction.current !== walkAction) {
        currentAction.current?.fadeOut(0.2);
        walkAction?.reset().fadeIn(0.2).play();
        currentAction.current = walkAction;
      }
    }
    
    return () => {
      // Clean up actions on unmount or state change
      walkAction?.fadeOut(0.5);
      runAction?.fadeOut(0.5);
    };
  }, [alert, actions]);

  // Animate the spotlight when alert
  useFrame((state) => {
    if (lightRef.current && alert) {
      lightRef.current.intensity = 2 + Math.sin(state.clock.elapsedTime * 8) * 0.5;
    }
  });

  // Adjust scale and position offsets based on your model's size and origin
  const modelHeight = 1.5; // Desired height of the guardian in 3D units
  const modelScale = modelHeight; // If original model is 1 unit tall
  const modelOffset = 0; // If model's feet are at Y=0

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={scene} scale={modelScale} position={[0, modelOffset, 0]} /> 
      {/* Alert spotlight */}
      {alert && (
        <spotLight
          ref={lightRef}
          position={[0, 2, 0]}
          angle={Math.PI / 6}
          penumbra={0.5}
          intensity={2}
          color="#FF6B6B"
          distance={10}
          decay={1}
          target={scene}
        />
      )}
    </group>
  );
}
// Preload the model to avoid pop-in
useGLTF.preload('/guards.glb');

// Enhanced First Person Game Scene Component
function GameScene({ 
  playerCoords, // Player position in 2D maze coordinates
  memoryOrbs,
  guardians,
  onOrbClick,
  roomShift,
  mazeLayout,
  cameraMode,
  playerRotation
}: { 
  playerCoords: {x: number, y: number},
  memoryOrbs: Array<{ x: number; y: number; collected: boolean; pulse: number }>,
  guardians: Array<Guardian>, // Use updated Guardian interface
  onOrbClick: (index: number) => void,
  roomShift: { x: number, y: number, intensity: number },
  mazeLayout: number[][],
  cameraMode: 'first' | 'third',
  playerRotation: { x: number, y: number }
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const rotationRef = useRef({ x: 0, y: 0 }); // Mouse look rotation
  const mouseRef = useRef({ isLocked: false });

  // Initialize rotation from props
  useEffect(() => {
    rotationRef.current = { ...playerRotation };
  }, []);

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

      const sensitivity = 0.002; // Mouse sensitivity
      rotationRef.current.y -= event.movementX * sensitivity; // Horizontal rotation (yaw)
      rotationRef.current.x -= event.movementY * sensitivity; // Vertical rotation (pitch)

      // Clamp vertical rotation to prevent over-rotation
      rotationRef.current.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotationRef.current.x));
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
    // Convert 2D maze coordinates to 3D Three.js coordinates
    const player3DX = (playerCoords.x - MAP_COLS * TILE_SIZE / 2) / (TILE_SIZE / 2);
    const player3DZ = (playerCoords.y - MAP_ROWS * TILE_SIZE / 2) / (TILE_SIZE / 2);
    
    // Update camera position and rotation based on mode
    if (cameraMode === 'first') {
      // First person view
      camera.position.set(player3DX, 1.6, player3DZ); // 1.6 is eye level height
      camera.rotation.order = 'YXZ';
      camera.rotation.y = rotationRef.current.y;
      camera.rotation.x = rotationRef.current.x;
    } else {
      // Third person view
      const distance = 8;
      const height = 6;
      const angle = rotationRef.current.y;
      
      camera.position.set(
        player3DX - Math.sin(angle) * distance,
        height,
        player3DZ - Math.cos(angle) * distance
      );
      camera.lookAt(player3DX, 1.6, player3DZ);
    }
    
    // Room shift effect (applied to the entire maze group)
    if (groupRef.current && roomShift.intensity > 0) {
      groupRef.current.position.x = roomShift.x * roomShift.intensity;
      groupRef.current.position.z = roomShift.y * roomShift.intensity;
    } else if (groupRef.current) {
      groupRef.current.position.x = 0;
      groupRef.current.position.z = 0;
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
      {/* Enhanced Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_COLS * 2, MAP_ROWS * 2]} />
        <meshLambertMaterial color="#34495E" />
      </mesh>

      {/* Walls */}
      {walls}

      {/* Player Model (visible in third person) */}
      <PlayerModel 
        position={[
          (playerCoords.x - MAP_COLS * TILE_SIZE / 2) / (TILE_SIZE / 2),
          0,
          (playerCoords.y - MAP_ROWS * TILE_SIZE / 2) / (TILE_SIZE / 2)
        ]}
        rotation={[0, rotationRef.current.y, 0]}
        visible={cameraMode === 'third'}
      />

      {/* Memory Orbs */}
      {memoryOrbs.map((orb, index) => (
        <MemoryOrb
          key={`orb-${index}`}
          position={[
            (orb.x - MAP_COLS * TILE_SIZE / 2) / (TILE_SIZE / 2),
            0,
            (orb.y - MAP_ROWS * TILE_SIZE / 2) / (TILE_SIZE / 2)
          ]}
          collected={orb.collected}
          pulse={orb.pulse}
          onClick={() => onOrbClick(index)}
        />
      ))}

      {/* Guardians */}
      {guardians.map((guardian, index) => (
        <GuardianModel
          key={`guardian-${index}`}
          position={[
            (guardian.x - MAP_COLS * TILE_SIZE / 2) / (TILE_SIZE / 2),
            0,
            (guardian.y - MAP_ROWS * TILE_SIZE / 2) / (TILE_SIZE / 2)
          ]}
          alert={guardian.alert}
          rotationY={guardian.rotationY}
        />
      ))}

      {/* Enhanced Lighting Setup */}
      <ambientLight intensity={0.6} color="#B0C4DE" /> {/* Soft blue ambient light */}
      
      {/* Main directional light (sun-like) */}
      <directionalLight 
        position={[20, 20, 10]} 
        intensity={1.2} 
        color="#FFF8DC"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      
      {/* Secondary fill light */}
      <directionalLight 
        position={[-10, 15, -10]} 
        intensity={0.5} 
        color="#87CEEB"
      />
      
      {/* Player's flashlight effect */}
      <spotLight
        position={[
          (playerCoords.x - MAP_COLS * TILE_SIZE / 2) / (TILE_SIZE / 2),
          1.6,
          (playerCoords.y - MAP_ROWS * TILE_SIZE / 2) / (TILE_SIZE / 2)
        ]}
        angle={Math.PI / 4}
        penumbra={0.3}
        intensity={1.5}
        color="#FFFACD"
        distance={12}
        decay={1}
        target-position={[
          (playerCoords.x - MAP_COLS * TILE_SIZE / 2) / (TILE_SIZE / 2) + Math.sin(rotationRef.current.y) * 5,
          1,
          (playerCoords.y - MAP_ROWS * TILE_SIZE / 2) / (TILE_SIZE / 2) + Math.cos(rotationRef.current.y) * 5
        ]}
      />
    </group>
  );
}

// Enhanced Player movement controller component
interface PlayerControllerProps {
  player: { x: number; y: number; size: number };
  setPlayer: React.Dispatch<React.SetStateAction<{ x: number; y: number; size: number }>>;
  isActive: boolean;
  gameState: 'idle' | 'playing' | 'paused' | 'gameOver' | 'victory';
  onGameStateChange: (state: 'playing' | 'paused' | 'gameOver' | 'victory') => void;
  getCurrentRoomLayout: () => number[][];
  playerRotation: { x: number; y: number };
  setPlayerRotation: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setCameraMode: React.Dispatch<React.SetStateAction<'first' | 'third'>>;
}

function PlayerController({
  player,
  setPlayer,
  isActive,
  gameState,
  onGameStateChange,
  getCurrentRoomLayout,
  playerRotation,
  setPlayerRotation,
  setCameraMode
}: PlayerControllerProps) {
  const { camera } = useThree();
  const keysPressed = useRef<Set<string>>(new Set());
  const lastMoveTime = useRef<number>(0);

  // Handle continuous key presses for smoother movement
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
      
      // Handle non-movement keys immediately
      switch (e.key.toLowerCase()) {
        case 'escape':
          onGameStateChange('paused');
          break;
        case 'c':
          // Toggle camera mode
          setCameraMode(prev => prev === 'first' ? 'third' : 'first');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    // Movement update loop
    const updateMovement = () => {
      if (!isActive || gameState !== 'playing') return;

      const currentTime = Date.now();
      const deltaTime = Math.min((currentTime - lastMoveTime.current) / 1000, 1/30); // Cap at 30fps for stability
      lastMoveTime.current = currentTime;

      if (keysPressed.current.size === 0) {
        requestAnimationFrame(updateMovement);
        return;
      }

      const speed = 120; // Units per second (increased for smoother feel)
      const currentMap = getCurrentRoomLayout();
      const currentCameraYRotation = camera.rotation.y;

      setPlayer(prevPlayer => {
        let moveX = 0;
        let moveY = 0;

        // Calculate movement vector based on pressed keys and camera direction
        const keys = Array.from(keysPressed.current);
        
        keys.forEach(key => {
          switch (key) {
            case 'w':
            case 'arrowup':
              moveX += Math.sin(currentCameraYRotation) * speed * deltaTime;
              moveY += Math.cos(currentCameraYRotation) * speed * deltaTime;
              break;
            case 's':
            case 'arrowdown':
              moveX -= Math.sin(currentCameraYRotation) * speed * deltaTime;
              moveY -= Math.cos(currentCameraYRotation) * speed * deltaTime;
              break;
            case 'a':
            case 'arrowleft':
              moveX += Math.sin(currentCameraYRotation - Math.PI / 2) * speed * deltaTime;
              moveY += Math.cos(currentCameraYRotation - Math.PI / 2) * speed * deltaTime;
              break;
            case 'd':
            case 'arrowright':
              moveX += Math.sin(currentCameraYRotation + Math.PI / 2) * speed * deltaTime;
              moveY += Math.cos(currentCameraYRotation + Math.PI / 2) * speed * deltaTime;
              break;
          }
        });

        if (moveX === 0 && moveY === 0) return prevPlayer;

        const proposedX = prevPlayer.x + moveX;
        const proposedY = prevPlayer.y + moveY;

        // Enhanced collision detection with sliding
        const playerRadius = commonConfig.playerRadius;
        
        // Try full movement first
        if (!checkCollision(proposedX, proposedY, playerRadius, currentMap)) {
          return { ...prevPlayer, x: proposedX, y: proposedY };
        }
        
        // Try X-only movement (sliding along Y walls)
        if (!checkCollision(proposedX, prevPlayer.y, playerRadius, currentMap)) {
          return { ...prevPlayer, x: proposedX };
        }
        
        // Try Y-only movement (sliding along X walls)
        if (!checkCollision(prevPlayer.x, proposedY, playerRadius, currentMap)) {
          return { ...prevPlayer, y: proposedY };
        }
        
        return prevPlayer; // No movement possible
      });

      requestAnimationFrame(updateMovement);
    };

    // Helper function for collision detection
    const checkCollision = (x: number, y: number, radius: number, map: number[][]) => {
      const checkPoints = [
        { x: x - radius, y: y - radius },
        { x: x + radius, y: y - radius },
        { x: x - radius, y: y + radius },
        { x: x + radius, y: y + radius },
        { x: x, y: y } // Center point
      ];

      for (const point of checkPoints) {
        const tileCol = Math.floor(point.x / TILE_SIZE);
        const tileRow = Math.floor(point.y / TILE_SIZE);

        if (tileRow < 0 || tileRow >= MAP_ROWS || tileCol < 0 || tileCol >= MAP_COLS ||
            (map[tileRow] && map[tileRow][tileCol] === 1)) {
          return true; // Collision detected
        }
      }
      return false; // No collision
    };

    lastMoveTime.current = Date.now();
    requestAnimationFrame(updateMovement);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive, gameState, onGameStateChange, getCurrentRoomLayout, setPlayer, camera, setCameraMode, commonConfig.playerRadius]);
  
  return null;
}

// Function to save score to Firebase
async function saveScore(playerName: string, time: number, difficulty: Difficulty, score: number, mind: MindType) {
  try {
    const docRef = await addDoc(collection(db, "scores"), {
      playerName,
      time: Math.round(time), // Save as rounded integer
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
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameOver' | 'victory'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [roomShift, setRoomShift] = useState({ x: 0, y: 0, intensity: 0 });
  const [player, setPlayer] = useState({ x: 0, y: 0, size: commonConfig.playerRadius * 2 });
  const [playerRotation, setPlayerRotation] = useState({ x: 0, y: 0 });
  const [cameraMode, setCameraMode] = useState<'first' | 'third'>('third'); // Start in third person for better initial view
  const [memoryOrbs, setMemoryOrbs] = useState<{ x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [currentMazeLayout, setCurrentMazeLayout] = useState<number[][]>([]);
  
  const soundsRef = useRef<{ orbCollect: Howl; guardianAlert: Howl; gameOver: Howl; victory: Howl; background: Howl; } | null>(null);
  
  const lastFrameTime = useRef(performance.now());
  const animationFrameId = useRef<number>();

  const getCurrentRoomLayout = useCallback(() => {
    if (currentMazeLayout.length > 0) {
      return currentMazeLayout;
    }
    
    const maze = getMaze(mazeId);
    if (maze && maze.layout) {
      setCurrentMazeLayout(maze.layout);
      return maze.layout;
    }
    const fallbackLayout = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill(1));
    console.warn("Could not load maze layout, using fallback.");
    setCurrentMazeLayout(fallbackLayout);
    return fallbackLayout;
  }, [mazeId, currentMazeLayout]);

  const getLevelConfig = useCallback((level: number) => { 
    const diffConfig = difficultyConfigs[difficulty]; 
    return { 
      orbs: commonConfig.initialOrbs + (level - 1) * commonConfig.orbsPerLevel, 
      guards: diffConfig.initialGuards + Math.floor((level - 1) * diffConfig.guardsPerLevel), 
      guardSpeed: diffConfig.baseGuardSpeed + (level - 1) * diffConfig.speedIncrement, 
      timer: diffConfig.baseTimer + (level - 1) * diffConfig.timerIncrement, 
      powerUpChance: diffConfig.powerUpChance, 
      maxLevels: diffConfig.maxLevels
    }; 
  }, [difficulty]);

  const getRandomSafePosition = useCallback(() => { 
    const currentMap = getCurrentRoomLayout(); 
    let pos: { x: number; y: number } | undefined; 
    let attempts = 0; 
    do { 
      const randCol = Math.floor(Math.random() * MAP_COLS); 
      const randRow = Math.floor(Math.random() * MAP_ROWS); 
      if (currentMap[randRow] && currentMap[randRow][randCol] === 0) { 
        pos = { x: randCol * TILE_SIZE + TILE_SIZE / 2, y: randRow * TILE_SIZE + TILE_SIZE / 2 }; 
      } 
      attempts++; 
    } while (!pos && attempts < 500);
    return pos || { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 };
  }, [getCurrentRoomLayout]);

  // Handle orb collection
  const collectOrb = useCallback((orbIndex: number) => {
    setMemoryOrbs(prevOrbs => {
      const orb = prevOrbs[orbIndex];
      if (!orb || orb.collected) return prevOrbs;

      const newOrbs = [...prevOrbs];
      newOrbs[orbIndex] = { ...orb, collected: true, collectingTime: Date.now() };
      
      const newScore = score + 1;
      setScore(newScore);
      onScoreUpdate?.(newScore);
      onMemoryCollected();

      setRoomShift({
        x: (Math.random() - 0.5) * 0.5,
        y: (Math.random() - 0.5) * 0.5,
        intensity: 1
      });

      if (soundsRef.current && !muted) {
        soundsRef.current.orbCollect.play();
      }
      return newOrbs;
    });
  }, [score, muted, onMemoryCollected, onScoreUpdate]);

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
    setPlayer({ ...newPlayerPos, size: commonConfig.playerRadius * 2 }); 
    
    // Reset camera to third person for new level
    setCameraMode('third');
    setPlayerRotation({ x: 0, y: 0 });
    
    // Initialize orbs and guardians
    const newOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[] = []; 
    const newGuardians: Guardian[] = []; 
    const spawnedPositions: {x: number, y: number}[] = [newPlayerPos]; 
    
    // Spawn Orbs
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
    
    // Spawn Guardians
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
      newGuardians.push({ 
        ...newPos, 
        directionX: Math.random() > 0.5 ? 1 : -1, 
        directionY: Math.random() > 0.5 ? 1 : -1, 
        alert: false,
        rotationY: 0
      }); 
    } 
    
    setMemoryOrbs(newOrbs); 
    setGuardians(newGuardians); 
    setTimeRemaining(config.timer); 
    setCurrentLevel(level); 
    setGameState('playing'); 
    onGameStateChange('playing'); 
    onLevelChange?.(level);
    setScore(0);
    onScoreUpdate?.(0);
  }, [getLevelConfig, getRandomSafePosition, onGameStateChange, onLevelChange, commonConfig.playerRadius, commonConfig.safeDistance, onScoreUpdate]);

  useImperativeHandle(ref, () => ({
    reset: () => resetGameState(1),
    retry: () => {
      const newLevel = Math.max(1, currentLevel);
      resetGameState(newLevel);
    },
    useThunder: () => {
      console.log("Thunder power-up activated!");
    }
  }));

  // Enhanced Game Loop
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') {
      cancelAnimationFrame(animationFrameId.current!);
      animationFrameId.current = undefined;
      return;
    }

    const now = performance.now();
    const deltaTime = (now - lastFrameTime.current) / 1000;
    lastFrameTime.current = now;

    // Timer update
    setTimeRemaining(prevTime => {
      const newTime = prevTime - deltaTime;
      onTimerUpdate?.(Math.max(0, Math.floor(newTime)));

      if (newTime <= 0) {
        if (soundsRef.current && !muted) soundsRef.current.gameOver.play();
        onGameStateChange('gameOver');
        saveScore(playerName, 0, difficulty, score, mind);
        return 0;
      }
      return newTime;
    });

    // Enhanced Guardian AI with Debug
    setGuardians(prevGuardians => {
      const updatedGuardians = prevGuardians.map((guardian, index) => {
        let { x, y, directionX, directionY, alert } = guardian;
        const config = getLevelConfig(currentLevel);
        let guardSpeed = Math.max(config.guardSpeed, 30); // Ensure minimum speed of 30 units/sec

        const dxToPlayer = player.x - x;
        const dyToPlayer = player.y - y;
        const distanceToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer);
        
        const newAlert = distanceToPlayer < commonConfig.guardianAlertRadius;
        if (newAlert && !alert && soundsRef.current && !muted) {
          soundsRef.current.guardianAlert.play();
        }
        
        let targetDirectionX = directionX;
        let targetDirectionY = directionY;

        if (newAlert) {
          // Chase player directly
          const angle = Math.atan2(dyToPlayer, dxToPlayer);
          targetDirectionX = Math.cos(angle);
          targetDirectionY = Math.sin(angle);
          guardSpeed *= Math.max(commonConfig.guardianAlertSpeedMultiplier, 1.5); // Ensure speed boost
        } else {
          // Random direction changes for more dynamic movement
          if (Math.random() < 0.02) { // 2% chance per frame to change direction
            targetDirectionX = (Math.random() - 0.5) * 2;
            targetDirectionY = (Math.random() - 0.5) * 2;
            // Normalize direction
            const length = Math.sqrt(targetDirectionX * targetDirectionX + targetDirectionY * targetDirectionY);
            if (length > 0) {
              targetDirectionX /= length;
              targetDirectionY /= length;
            }
          }
        }

        // Calculate proposed movement
        const moveX = targetDirectionX * guardSpeed * deltaTime;
        const moveY = targetDirectionY * guardSpeed * deltaTime;
        let proposedX = x + moveX;
        let proposedY = y + moveY;

        const currentMap = getCurrentRoomLayout();
        const guardianRadius = commonConfig.guardianRadius || 10; // Fallback radius

        // Simplified collision detection
        const checkCollision = (testX: number, testY: number) => {
          const tileCol = Math.floor(testX / TILE_SIZE);
          const tileRow = Math.floor(testY / TILE_SIZE);
          
          // Check bounds and wall collision
          if (tileRow < 0 || tileRow >= MAP_ROWS || tileCol < 0 || tileCol >= MAP_COLS) {
            return true;
          }
          
          if (currentMap[tileRow] && currentMap[tileRow][tileCol] === 1) {
            return true;
          }
          
          return false;
        };

        // Check collision for proposed position
        let collidedX = false;
        let collidedY = false;

        // Test corners of guardian's bounding box
        const testPoints = [
          { x: proposedX - guardianRadius, y: y - guardianRadius },
          { x: proposedX + guardianRadius, y: y + guardianRadius }
        ];

        for (const point of testPoints) {
          if (checkCollision(point.x, point.y)) {
            collidedX = true;
            break;
          }
        }

        const testPointsY = [
          { x: x - guardianRadius, y: proposedY - guardianRadius },
          { x: x + guardianRadius, y: proposedY + guardianRadius }
        ];

        for (const point of testPointsY) {
          if (checkCollision(point.x, point.y)) {
            collidedY = true;
            break;
          }
        }
        
        // Handle collisions - bounce off walls
        if (collidedX) {
          targetDirectionX *= -1;
          proposedX = x; // Don't move in X if collision
        }
        if (collidedY) {
          targetDirectionY *= -1;
          proposedY = y; // Don't move in Y if collision
        }

        // Update positions
        const newX = collidedX ? x : proposedX;
        const newY = collidedY ? y : proposedY;

        // Calculate rotation for 3D model
        const guardianRotationY = Math.atan2(targetDirectionX, targetDirectionY);

        // Debug log for first guardian to check movement
        if (index === 0 && Math.random() < 0.01) { // Log occasionally
          console.log(`Guardian ${index}: Speed=${guardSpeed}, Move=(${moveX.toFixed(2)}, ${moveY.toFixed(2)}), Pos=(${newX.toFixed(1)}, ${newY.toFixed(1)}), Collision=(${collidedX}, ${collidedY})`);
        }

        return { 
          ...guardian, 
          x: newX, 
          y: newY, 
          directionX: targetDirectionX, 
          directionY: targetDirectionY, 
          alert: newAlert, 
          rotationY: guardianRotationY 
        };
      });
      return updatedGuardians;
    });

    // Player-Guardian Collision Check
    const playerRadius = commonConfig.playerRadius; 
    guardians.forEach(guardian => {
      const dx = player.x - guardian.x;
      const dy = player.y - guardian.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < playerRadius + commonConfig.guardianRadius) {
        if (gameState === 'playing') {
          if (soundsRef.current && !muted) soundsRef.current.gameOver.play();
          onGameStateChange('gameOver');
          saveScore(playerName, timeRemaining, difficulty, score, mind);
        }
      }
    });

    // Passive Orb collection check
    setMemoryOrbs(prevOrbs => {
      let changed = false;
      const newOrbs = prevOrbs.map((orb, index) => {
        if (orb.collected) return orb;
        
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < playerRadius + commonConfig.orbRadius) {
          collectOrb(index);
          changed = true;
          return { ...orb, collected: true };
        }
        return orb;
      });
      return changed ? newOrbs : prevOrbs;
    });

    // Level Progression / Victory Check
    const uncollectedOrbs = memoryOrbs.filter(orb => !orb.collected).length;
    if (uncollectedOrbs === 0 && memoryOrbs.length > 0) {
      if (currentLevel < difficultyConfigs[difficulty].maxLevels) {
        if (gameState === 'playing') {
          if (soundsRef.current && !muted) soundsRef.current.victory.play();
          resetGameState(currentLevel + 1);
        }
      } else {
        if (gameState === 'playing') {
          if (soundsRef.current && !muted) soundsRef.current.victory.play();
          onGameStateChange('victory');
          saveScore(playerName, timeRemaining, difficulty, score, mind);
        }
      }
    }

    // Power-up updates
    setActivePowerUps(prevActive => prevActive.filter(pu => {
      pu.duration -= deltaTime;
      return pu.duration > 0;
    }));

    // Room shift decay
    setRoomShift(prev => {
      if (prev.intensity > 0) {
        return { ...prev, intensity: Math.max(0, prev.intensity - deltaTime * 2) };
      }
      return prev;
    });

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [
    gameState, player, currentLevel, timeRemaining, score, memoryOrbs, guardians, activePowerUps, roomShift, 
    playerName, difficulty, mind, muted, 
    onTimerUpdate, onGameStateChange, onMemoryCollected, onScoreUpdate, onLevelChange,
    getLevelConfig, getCurrentRoomLayout, resetGameState, collectOrb, soundsRef, 
    commonConfig.playerRadius, commonConfig.guardianRadius, commonConfig.orbRadius, 
    commonConfig.guardianAlertRadius, commonConfig.guardianAlertSpeedMultiplier,
    difficultyConfigs
  ]);

  // Effect to start/stop the game loop
  useEffect(() => {
    if (isActive && gameState === 'playing' && !animationFrameId.current) {
      lastFrameTime.current = performance.now();
      animationFrameId.current = requestAnimationFrame(gameLoop);
      if (soundsRef.current && !muted) soundsRef.current.background.play();
      onTimerActive?.(true);
    } else if (!isActive || gameState !== 'playing') {
      cancelAnimationFrame(animationFrameId.current!);
      animationFrameId.current = undefined;
      if (soundsRef.current) soundsRef.current.background.pause();
      onTimerActive?.(false);
    }
    return () => {
      cancelAnimationFrame(animationFrameId.current!);
      animationFrameId.current = undefined;
    };
  }, [isActive, gameState, gameLoop, muted, onTimerActive]);

  // Initialize game on mount if active
  useEffect(() => {
    if (isActive && gameState === 'idle') {
      resetGameState(1);
    }
  }, [isActive, gameState, resetGameState]);

  return (
    <div className="w-full h-full bg-background relative">
      {/* Camera mode indicator */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
        Camera: {cameraMode === 'first' ? 'First Person' : 'Third Person'} (Press C to toggle)
      </div>
      
      {/* Movement instructions */}
      <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
        WASD/Arrows: Move | Mouse: Look | C: Toggle Camera | ESC: Pause
      </div>
      
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ 
          position: [0, 6, 8], // Initial third-person camera position
          fov: 75,
          near: 0.1,
          far: 1000
        }}
        shadows // Enable shadows for better visual quality
      >
        <PlayerController
          player={player}
          setPlayer={setPlayer}
          isActive={isActive}
          gameState={gameState}
          onGameStateChange={onGameStateChange}
          getCurrentRoomLayout={getCurrentRoomLayout}
          playerRotation={playerRotation}
          setPlayerRotation={setPlayerRotation}
          setCameraMode={setCameraMode}
        />
        
        <GameScene 
          playerCoords={player}
          memoryOrbs={memoryOrbs}
          guardians={guardians}
          onOrbClick={collectOrb}
          roomShift={roomShift}
          mazeLayout={getCurrentRoomLayout()}
          cameraMode={cameraMode}
          playerRotation={playerRotation}
        />
      </Canvas>
    </div>
  );
});

GameCanvas3D.displayName = 'GameCanvas3D';