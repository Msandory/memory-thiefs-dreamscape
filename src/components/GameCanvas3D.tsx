import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture, useAnimations } from "@react-three/drei";
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
  PowerUpType, // Ensure PowerUpType is imported
  difficultyConfigs, 
  commonConfig
} from '@/config/gameConfig';
import { getMaze } from '@/utils/mazeGenerator';
import { GLTF } from 'three-stdlib'; 

interface ActivePowerUp { type: PowerUpType; duration: number; maxDuration: number; }
// NEW: Interface for power-ups managed in state
interface SpawnedPowerUp { x: number; y: number; type: PowerUpType; collected: boolean; }

interface GameSettings { mouseSensitivity: number; mouseInvert: boolean; }
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
  gameSettings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  onPlayerPositionUpdate?: (x: number, y: number) => void;
  onPlayerLookRotationUpdate?: (rotationY: number) => void;
  texturePath: string;
}

interface Guardian { 
  x: number; 
  y: number; 
  directionX: number; 
  directionY: number; 
  alert: boolean; 
  rotationY: number;
  lastDirectionChange: number;
  stuckCounter: number;
}

function Wall({ position,texturePath }: { position: [number, number, number] , texturePath: string }) {
  const texture = useTexture(texturePath);
  useEffect(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
  }, [texture]);
  return (
    <mesh position={position}>
      <boxGeometry args={[2, 4, 2]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ---------- Player 3D Model (GLB) ----------
type PlayerGLTFResult = GLTF & { animations: THREE.AnimationClip[]; };
function PlayerModel({ position, visible, isSprinting, isMoving, rotationY }: 
  { position: [number, number, number], visible: boolean, isSprinting: boolean, isMoving: boolean, rotationY: number }) {

  const { scene, animations } = useGLTF('/assets/3DModels/player1.glb') as PlayerGLTFResult;
  const { actions } = useAnimations(animations, scene);
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const idle = actions['Idle'] || actions['idle'];
    const run = actions['Running'] || actions['run'];
    const runFast = actions['Run Fast'] || actions['run fast'] || actions['runFast'];

    let nextAction: THREE.AnimationAction | undefined;

    if (isSprinting) {
      nextAction = runFast;
    } else if (isMoving) {
      nextAction = run;
    } else {
      nextAction = idle;
    }

    if (nextAction && currentAction.current !== nextAction) {
      currentAction.current?.fadeOut(0.1);
      nextAction.reset().fadeIn(0.2).play();
      currentAction.current = nextAction;
    }

    return () => {
      nextAction?.fadeOut(0.1);
    };
  }, [isSprinting, isMoving, actions]);

  return (
    <group position={[position[0], 0, position[2]]} rotation={[0, rotationY, 0]} visible={visible}>
      <primitive object={scene} scale={1.5} />
    </group>
  );
}

// ---------- Memory Orb (on the floor) ----------
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
      meshRef.current.rotation.y = state.clock.elapsedTime + pulse;
    }
  });
  if (collected) return null;
  return (
    <mesh ref={meshRef} position={position} onClick={onClick}>
      <sphereGeometry args={[0.3, 16, 16]} />
      {/* IMPROVED GLOW: Increased emissiveIntensity */}
      <meshStandardMaterial color="#9B59B6" emissive="#8E44AD" emissiveIntensity={1.0} /> 
    </mesh>
  );
}

// ---------- Guardian 3D Model ----------
type GuardianGLTFResult = GLTF & { animations: THREE.AnimationClip[]; };
function GuardianModel({ position, alert, rotationY }: { position: [number, number, number]; alert: boolean; rotationY: number; }) {
  const { scene, animations } = useGLTF('/assets/3DModels/guards.glb') as GuardianGLTFResult;
  const { actions } = useAnimations(animations, scene);
  const currentAction = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    const walkAction = actions['Walking'] || actions['Walk'];
    const runAction = actions['Running'] || actions['Run'];
    if (alert) {
      if (currentAction.current !== runAction) {
        currentAction.current?.fadeOut(0.2);
        runAction?.reset().fadeIn(0.2).play();
        currentAction.current = runAction || null;
      }
    } else {
      if (currentAction.current !== walkAction) {
        currentAction.current?.fadeOut(0.2);
        walkAction?.reset().fadeIn(0.2).play();
        currentAction.current = walkAction || null;
      }
    }
    return () => {
      walkAction?.fadeOut(0.1);
      runAction?.fadeOut(0.1);
    };
  }, [alert, actions]);
  return (
    <group position={[position[0], 0, position[2]]} rotation={[0, rotationY, 0]}>
      <primitive object={scene} scale={1.5} />
    </group>
  );
}
useGLTF.preload('/assets/3DModels/guards.glb');
useGLTF.preload('/assets/3DModels/player1.glb');

// NEW: PowerUp 3D Model
function PowerUpModel({ 
  position, 
  type, 
  collected, 
  onClick 
}: { 
  position: [number, number, number], 
  type: PowerUpType, 
  collected: boolean, 
  onClick: () => void 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Define colors based on PowerUpType
  const color = {
    [PowerUpType.Speed]: '#00FF00', // Green
    [PowerUpType.Immunity]: '#FFD700', // Gold
    [PowerUpType.Thunder]: '#FF6600', // Orange
    [PowerUpType.Timer]: '#00CCFF', // Light Blue
  }[type] || '#FFFFFF'; // Default white

  useFrame((state) => {
    if (meshRef.current && !collected) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2; // Spin
      // Bobbing effect
      meshRef.current.position.y = position[1] + 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.1; 
    }
  });

  if (collected) return null;

  return (
    <mesh ref={meshRef} position={[position[0], position[1] + 0.5, position[2]]} onClick={onClick}>
      <boxGeometry args={[0.6, 0.6, 0.6]} /> {/* Simple cube for power-up */}
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  );
}


// ---------- Fixed 3D Scene with Proper COD-Style Controls ----------
function GameScene({ 
  playerPosition,
  memoryOrbs,
  guardians,
  powerUps, // NEW: Pass powerUps to GameScene
  onOrbClick,
  onPowerUpClick, // NEW: Pass powerUp click handler
  roomShift,
  mazeLayout,
  playerMovement,
  gameState,
  gameSettings,
  thirdPerson,
  isSprinting,
  cameraRotationRef,
  texturePath
}: { 
  playerPosition: [number, number, number],
  memoryOrbs: Array<{ x: number; y: number; collected: boolean; pulse: number }>,
  guardians: Array<Guardian>,
  powerUps: Array<SpawnedPowerUp>, // NEW: Type for powerUps
  onOrbClick: (index: number) => void,
  onPowerUpClick: (index: number) => void, // NEW: Type for powerUp click handler
  roomShift: { x: number, y: number, intensity: number },
  mazeLayout: number[][],
  playerMovement: { isMoving: boolean, isRunningFast: boolean },
  gameState: 'idle' | 'playing',
  gameSettings: GameSettings,
  thirdPerson: boolean,
  isSprinting?: boolean,
  cameraRotationRef: React.MutableRefObject<{ x: number; y: number }> ,
  texturePath: string
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const rotationRef = useRef({ x: 0, y: 0 }); // Internal ref for mouse look
  const mouseRef = useRef({ isLocked: false });
  const raycaster = useRef(new THREE.Raycaster());
  
  // Pointer lock + mouse look
  useEffect(() => {
    const canvas = gl.domElement;
    const handleClick = () => canvas.requestPointerLock();
    const handlePointerLockChange = () => {
      mouseRef.current.isLocked = document.pointerLockElement === canvas;
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseRef.current.isLocked) return;
      const sensitivity = gameSettings.mouseSensitivity * 0.002;
      rotationRef.current.y -= event.movementX * sensitivity;
      const verticalMovement = gameSettings.mouseInvert ? event.movementY : -event.movementY;
      rotationRef.current.x += verticalMovement * sensitivity;
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
  }, [gl, gameSettings]);

  // Auto-eject mouse on pause, game over, or victory
  useEffect(() => {
    if (gameState !== 'playing') {
      document.exitPointerLock();
      mouseRef.current.isLocked = false;
    }
  }, [gameState]);

  // Dynamic camera collision detection for third person
  const checkCameraCollision = useCallback((from: THREE.Vector3, to: THREE.Vector3): number => {
    if (!thirdPerson) return from.distanceTo(to);
    
    raycaster.current.set(from, to.clone().sub(from).normalize());
    
    // Get all wall meshes for collision check
    const wallMeshes: THREE.Object3D[] = [];
    camera.parent?.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
        wallMeshes.push(child);
      }
    });
    
    const intersects = raycaster.current.intersectObjects(wallMeshes, true);
    
    if (intersects.length > 0) {
      const distance = from.distanceTo(to);
      const collisionDistance = intersects[0].distance;
      return Math.max(1.2, collisionDistance - 0.3); // Leave buffer space
    }
    return from.distanceTo(to);
  }, [thirdPerson, camera]);
  const DEBUG_SKEW_VIEW = false; // toggle for debugging

  useFrame(() => {
    const px = playerPosition[0];
    const pz = playerPosition[2];
    const eyeHeight = 1.6;
    if (DEBUG_SKEW_VIEW) {
      const height = 20;         // how high above the maze
      const distance = 15;       // how far back from the player
      const yaw = Math.PI / 4;   // 45° angle around player

      // Position camera at an angle above player
      const camX = px - Math.sin(yaw) * distance;
      const camY = height;
      const camZ = pz - Math.cos(yaw) * distance;

      camera.position.set(camX, camY, camZ);
      //camera.lookAt(px, 0, pz); // always look at player

      return; // skip normal camera code
    }

    if (!thirdPerson) {
      // First-person camera with proper rotation
      camera.position.set(px, eyeHeight, pz);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = rotationRef.current.y;
      camera.rotation.x = rotationRef.current.x;
      camera.rotation.z = 0; // Prevent camera tilt/skew
    } else {
      // Enhanced third-person with dynamic zoom and collision detection
      const baseDistance = 2.5;
      const minDistance = 1.2;
      const height = 2.2;
      
      // Use camera yaw for third-person camera positioning
      const yaw = rotationRef.current.y;
      const pitch = rotationRef.current.x * 0.4;
      
      // Calculate desired camera position
      const camX = px - Math.sin(yaw) * baseDistance;
      const camY = height - Math.sin(pitch) * 1.2;
      const camZ = pz - Math.cos(yaw) * baseDistance;
      
      const playerPos = new THREE.Vector3(px, 1.2, pz);
      const desiredCamPos = new THREE.Vector3(camX, camY, camZ);
      
      // Check for wall collision and adjust distance
      const actualDistance = checkCameraCollision(playerPos, desiredCamPos);
      const clampedDistance = Math.max(minDistance, actualDistance);
      
      // Apply the collision-adjusted distance
      const finalCamX = px - Math.sin(yaw) * clampedDistance;
      const finalCamZ = pz - Math.cos(yaw) * clampedDistance;
      
      camera.position.set(finalCamX, camY, finalCamZ);
      camera.lookAt(px, 1.2, pz);
    }

    // IMPORTANT: Update the external cameraRotationRef so GameCanvas3D knows the camera's actual rotation
    cameraRotationRef.current.x = rotationRef.current.x;
    cameraRotationRef.current.y = rotationRef.current.y;

    // Room shift effect
    if (groupRef.current && roomShift.intensity > 0) {
      groupRef.current.position.x = roomShift.x * roomShift.intensity;
      groupRef.current.position.z = roomShift.y * roomShift.intensity;
    }
  });

  // Build walls
  const walls: JSX.Element[] = [];
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (mazeLayout[row] && mazeLayout[row][col] === 1) {
        const x = (col - MAP_COLS / 2) * 2;
        const z = (row - MAP_ROWS / 2) * 2;
        walls.push(<Wall key={`wall-${row}-${col}`} position={[x, 2, z]} texturePath={texturePath} />)
      }
    }
  }

  return (
    <group ref={groupRef}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_COLS * 2, MAP_ROWS * 2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Walls */}
      {walls}

      {/* Player model - now always faces camera's look direction */}
      <PlayerModel 
        position={playerPosition} 
        visible={thirdPerson} 
        isSprinting={isSprinting} 
        isMoving={playerMovement.isMoving}
        rotationY={cameraRotationRef.current.y} // Player model rotates with camera yaw
      />

      {/* Memory Orbs on ground */}
      {memoryOrbs.map((orb, index) => (
        <MemoryOrb
          key={`orb-${index}`}
          position={[
            (orb.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            0.3,
            (orb.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
          ]}
          collected={orb.collected}
          pulse={orb.pulse}
          onClick={() => onOrbClick(index)}
        />
      ))}

      {/* Power-ups on ground */}
      {powerUps.map((powerUp, index) => ( // NEW: Render PowerUps
        <PowerUpModel
          key={`powerup-${index}`}
          position={[
            (powerUp.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            0.3, // Height from ground
            (powerUp.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
          ]}
          type={powerUp.type}
          collected={powerUp.collected}
          onClick={() => onPowerUpClick(index)}
        />
      ))}

      {/* Guardians */}
      {guardians.map((guardian, index) => (
        <GuardianModel
          key={`guardian-${index}`}
          position={[
            (guardian.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2, // consistent conversion
            0,
            (guardian.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2  // consistent conversion
          ]}
          alert={guardian.alert}
          rotationY={guardian.rotationY}
        />
      ))}

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[0, 5, 0]} intensity={0.5} />
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

// ---------------- Main Component with Fixed Movement ----------------
export const GameCanvas3D = forwardRef<any, GameCanvasProps>(({
  isActive, onGameStateChange, onMemoryCollected, playerName, onPlayerNameLoaded, muted, onTimerUpdate, onTimerActive, onLevelChange, mobileDirection = { up: false, down: false, left: false, right: false }, difficulty, mind, mazeId, onScoreUpdate, gameSettings, onSettingsChange,
  onPlayerPositionUpdate, onPlayerLookRotationUpdate, texturePath 
}, ref) => {
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [roomShift, setRoomShift] = useState({ x: 0, y: 0, intensity: 0 });
  const [player, setPlayer] = useState({ x: 100, y: 100, size: 20, rotationY: 0 ,lookRotationY: 0}); 
  const [playerMovement, setPlayerMovement] = useState({ isMoving: false, isRunningFast: false });
  const [thirdPerson, setThirdPerson] = useState(false); // CHANGED: Default to first-person view
  const sprintingRef = useRef(false);
  const keysPressed = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const [memoryOrbs, setMemoryOrbs] = useState<{ x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [powerUps, setPowerUps] = useState<SpawnedPowerUp[]>([]); // NEW: Power-up state
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [currentMazeLayout, setCurrentMazeLayout] = useState<number[][]>([]);
  const cameraRotationRef = useRef({ x: 0, y: 0 }); 
  const [isLoading, setIsLoading] = useState(false);
  const soundsRef = useRef<{ orbCollect: Howl; guardianAlert: Howl; gameOver: Howl; victory: Howl; background: Howl; } | null>(null);
  const timerStarted = useRef(false);
  const [isSpawningComplete, setIsSpawningComplete] = useState(false);
  const getCurrentRoomLayout = useCallback(() => {
    if (currentMazeLayout.length > 0) return currentMazeLayout;
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
      powerUpChance: diffConfig.powerUpChance  // Use commonConfig or default
    }; 
  };

  const checkCollision = useCallback((x: number, y: number, radius: number = 15) => {
    const currentMap = getCurrentRoomLayout();
    
    // Simple 4-point collision (corners only) - less sensitive
    const checkPoints = [
      [x - radius, y - radius], // Top-left
      [x + radius, y - radius], // Top-right
      [x - radius, y + radius], // Bottom-left
      [x + radius, y + radius]  // Bottom-right
    ];

    return checkPoints.some(([px, py]) => {
      const col = Math.floor(px / TILE_SIZE);
      const row = Math.floor(py / TILE_SIZE);
      
      // Out of bounds check
      if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) {
        return true;
      }
      
      // Wall collision check
      return currentMap[row] && currentMap[row][col] === 1;
    });
  }, [getCurrentRoomLayout]);

  const getRandomSafePosition = useCallback(() => { 
    const currentMap = getCurrentRoomLayout(); 
    let pos: {x:number;y:number}|undefined; 
    let attempts = 0; 
    const minSpawnDistance = commonConfig.safeDistance || 100; // Use config or default
    do { 
      const randCol = Math.floor(Math.random() * MAP_COLS); 
      const randRow = Math.floor(Math.random() * MAP_ROWS); 
      const x = randCol * TILE_SIZE + TILE_SIZE / 2;
      const y = randRow * TILE_SIZE + TILE_SIZE / 2;
      
      // Ensure it's not a wall and not too close to existing spawned items (player, orbs, guards, other power-ups)
      if (currentMap[randRow] && currentMap[randRow][randCol] === 0 && !checkCollision(x, y, 0)) { // 0 radius for tile check
        pos = { x, y }; 
      } 
      attempts++; 
    } while (!pos && attempts < 100); 
    return pos || { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 }; // Fallback
  }, [getCurrentRoomLayout, checkCollision]);

  const handleOrbClick = useCallback((orbIndex: number) => {
    const orb = memoryOrbs[orbIndex];
    if (!orb || orb.collected) return;
    
    const worldToGameX = (orb.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const worldToGameZ = (orb.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const playerWorldX = (player.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const playerWorldZ = (player.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2;
    
    const dx = playerWorldX - worldToGameX;
    const dz = playerWorldZ - worldToGameZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < 2) {
      const newOrbs = [...memoryOrbs];
      newOrbs[orbIndex] = { ...orb, collected: true, collectingTime: Date.now() };
      setMemoryOrbs(newOrbs);
      const newScore = score + 1;
      setScore(newScore);
      onScoreUpdate?.(newScore);
      onMemoryCollected();
      setRoomShift({ x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5, intensity: 1 });
      setTimeout(() => setRoomShift(prev => ({ ...prev, intensity: 0 })), 300);
      if (soundsRef.current && !muted) soundsRef.current.orbCollect.play();
    }
  }, [memoryOrbs, player, score, muted, onMemoryCollected, onScoreUpdate]);

  // NEW: handlePowerUpClick function
  const handlePowerUpClick = useCallback((powerUpIndex: number) => {
    const pUp = powerUps[powerUpIndex];
    if (!pUp || pUp.collected) return;

    const worldToGameX = (pUp.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const worldToGameZ = (pUp.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const playerWorldX = (player.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const playerWorldZ = (player.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2;
    
    const dx = playerWorldX - worldToGameX;
    const dz = playerWorldZ - worldToGameZ;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 2) { // Allow collection if player is close
      const newPowerUps = [...powerUps];
      newPowerUps[powerUpIndex] = { ...pUp, collected: true };
      setPowerUps(newPowerUps);

      console.log(`Power-up collected: ${pUp.type}`);
      // TODO: Implement actual power-up effects here (e.g., speed boost, time add)
      // For now, it just disappears.
    }
  }, [powerUps, player]);

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

const resetGameState = useCallback(async (level: number = 1) => { 
  setIsLoading(true); // START LOADING HERE - at the beginning of spawning
  setIsSpawningComplete(false); // Reset spawning state
  setActivePowerUps([]); 
  const config = getLevelConfig(level); 
  
  // Track spawned positions to ensure minimum safe distance
  const spawnedPositions: {x: number, y: number}[] = [];
  const minSpawnDistance = commonConfig.safeDistance || 100;

  const getUniqueSafePosition = () => {
    let newPos;
    let attempts = 0;
    do {
      newPos = getRandomSafePosition();
      attempts++;
      if (attempts > 200) { // Prevent infinite loop for very small maps
        console.log("Could not find a unique safe position for an item after many attempts.");
        break;
      }
      // Add a small delay every 10 attempts to show loading progress
     
    } while (spawnedPositions.some(p => {
      const dx = newPos.x - p.x; 
      const dy = newPos.y - p.y; 
      return Math.sqrt(dx*dx + dy*dy) < minSpawnDistance;
    }));
    spawnedPositions.push(newPos);
    return newPos;
  };

  // Spawn player with loading feedback
  console.log("Spawning player...");
  const newPlayerPos = await getUniqueSafePosition();
  setPlayer({ ...newPlayerPos, size: 20, rotationY: 0, lookRotationY: 0 }); 

  // Spawn orbs with loading feedback
  console.log("Spawning memory orbs...");
  const newOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[] = []; 
  for (let i = 0; i < config.orbs; i++) { 
    console.log(`Spawning orb ${i + 1}/${config.orbs}...`);
    const orbPos = await getUniqueSafePosition();
    newOrbs.push({ ...orbPos, collected: false, pulse: Math.random() * Math.PI * 2, collectingTime: 0 }); 
  } 
  setMemoryOrbs(newOrbs); 

  // Spawn guardians with loading feedback
  console.log("Spawning guardians...");
  const newGuardians: Guardian[] = []; 
  for (let i = 0; i < config.guards; i++) { 
    console.log(`Spawning guardian ${i + 1}/${config.guards}...`);
    const guardianPos = await getUniqueSafePosition();
    newGuardians.push({ 
      ...guardianPos, 
      directionX: Math.random() > 0.5 ? 1 : -1, 
      directionY: Math.random() > 0.5 ? 1 : -1, 
      alert: false, 
      rotationY: 0,
      lastDirectionChange: Date.now(),
      stuckCounter: 0
    }); 
  } 
  setGuardians(newGuardians); 

  // Spawn power-ups with loading feedback
  console.log("Spawning power-ups...");
  const newPowerUps: SpawnedPowerUp[] = [];
  if (Math.random() < config.powerUpChance) {
    const powerUpTypes = Object.values(PowerUpType);
    const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    const powerUpPos = await getUniqueSafePosition();
    newPowerUps.push({ ...powerUpPos, type: randomType, collected: false });
  }
  setPowerUps(newPowerUps);

  // Finish setup
  timerStarted.current = true; 
  const t = config.timer;
  setTimeRemaining(t); 
  onTimerUpdate?.(t);
  onTimerActive?.(true);
  setCurrentLevel(level); 
  onLevelChange?.(level);
  setGameState('playing'); 
  onGameStateChange('playing'); 
  
  // Small delay to ensure everything is rendered, then hide loader
  setTimeout(() => {
    setIsSpawningComplete(true);
    setIsLoading(false); // END LOADING HERE - after everything is spawned
    console.log("Level spawning complete!");
  }, 500);
}, [getLevelConfig, getRandomSafePosition, onGameStateChange, onTimerActive, onTimerUpdate, onLevelChange, commonConfig.safeDistance]);

// And update the victory condition logic to NOT set loading there:
useEffect(() => {
  const collectedOrbs = memoryOrbs.filter(orb => orb.collected).length;
  const totalOrbs = memoryOrbs.length;
  
  if (totalOrbs > 0 && collectedOrbs === totalOrbs && gameState === 'playing' && isSpawningComplete) {
    if (currentLevel < commonConfig.MAX_LEVELS) {               
      // DON'T setIsLoading(true) here - let resetGameState handle it
      setTimeout(() => {
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);
        onLevelChange?.(nextLevel);
        resetGameState(nextLevel); // This will handle the loading state
      }, 2000); // Reduced delay since loading will show during resetGameState
    } else {
      onGameStateChange('victory');
      if (soundsRef.current && !muted) soundsRef.current.victory.play();
      saveScore(playerName, timeRemaining, difficulty, score, mind);
      setGameState('idle'); 
    }
  }
}, [memoryOrbs, gameState, onGameStateChange, muted, playerName, timeRemaining, difficulty, score, mind, currentLevel, onLevelChange, resetGameState, isSpawningComplete]);
  useImperativeHandle(ref, () => ({
    reset: () => resetGameState(1),
    retry: () => { const newLevel = Math.max(1, currentLevel - 1); resetGameState(newLevel); },
    useThunder: () => {},
    getMazeLayout: () => getCurrentRoomLayout(),
    getPlayerPosition: () => ({ x: player.x, y: player.y }),
    getOrbs: () => memoryOrbs,
    getGuardians: () => guardians,
    getPowerUps: () => powerUps, // NEW: Expose power-ups
    getPlayerLookRotation: () => player.lookRotationY 
  }));

  // Hold-to-sprint keyboard controls
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
        const moveKey = key === 'arrowup' ? 'w' : key === 'arrowdown' ? 's' : key === 'arrowleft' ? 'a' : key === 'arrowright' ? 'd' : key;
        if (moveKey in keysPressed.current) keysPressed.current[moveKey as 'w'|'a'|'s'|'d'] = true;
      }
      if (key === 'shift') {
        keysPressed.current.shift = true;
        sprintingRef.current = true;
      }
      if (key === 'v') {
        setThirdPerson(prev => !prev);
      }
      if (key === 'escape') {
        onGameStateChange('paused');
        document.exitPointerLock();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const moveKey = key === 'arrowup' ? 'w' : key === 'arrowdown' ? 's' : key === 'arrowleft' ? 'a' : key === 'arrowright' ? 'd' : key;
      if (moveKey in keysPressed.current) keysPressed.current[moveKey as 'w'|'a'|'s'|'d'] = false;
      if (key === 'shift') {
        keysPressed.current.shift = false;
        sprintingRef.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive, gameState, onGameStateChange]);

  // Call of Duty style movement - SAME for both camera modes
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;
    const moveInterval = setInterval(() => {
      const keys = keysPressed.current;
      const isMovingNow = keys.w || keys.a || keys.s || keys.d;
      const speed = sprintingRef.current ? 8 : 4;
      setPlayerMovement({ isMoving: isMovingNow, isRunningFast: sprintingRef.current && isMovingNow });
  
      setPlayer(prevPlayer => {
          const cameraYaw = cameraRotationRef.current.y; 

          const updatedPlayer = {
              ...prevPlayer,
              lookRotationY: cameraYaw 
          };

          if (isMovingNow) {
              let deltaX = 0;
              let deltaZ = 0; 
              const playerRadius = 15;
      
              const forward = { x: -Math.sin(cameraYaw), z: -Math.cos(cameraYaw) }; 
              const right = { x: Math.cos(cameraYaw), z: -Math.sin(cameraYaw) };    
              
              if (keys.w) { 
                deltaX += forward.x * speed;
                deltaZ += forward.z * speed;
              }
              if (keys.s) { 
                deltaX -= forward.x * speed;
                deltaZ -= forward.z * speed;
              }
              if (keys.a) { 
                deltaX -= right.x * speed;
                deltaZ -= right.z * speed;
              }
              if (keys.d) { 
                deltaX += right.x * speed;
                deltaZ += right.z * speed;
              }
      
              let newX = updatedPlayer.x + deltaX;
              let newY = updatedPlayer.y + deltaZ; 
      
              const canMoveX = !checkCollision(newX, updatedPlayer.y, playerRadius);
              const canMoveY = !checkCollision(updatedPlayer.x, newY, playerRadius);
              const canMoveBoth = !checkCollision(newX, newY, playerRadius);
      
              if (canMoveBoth) {
                updatedPlayer.x = newX;
                updatedPlayer.y = newY;
              } else if (canMoveX) {
                updatedPlayer.x = newX;
              } else if (canMoveY) {
                updatedPlayer.y = newY;
              }
          }
          
          if (updatedPlayer.x !== prevPlayer.x || updatedPlayer.y !== prevPlayer.y) {
            onPlayerPositionUpdate?.(updatedPlayer.x, updatedPlayer.y);
          }
          if (updatedPlayer.lookRotationY !== prevPlayer.lookRotationY) {
            onPlayerLookRotationUpdate?.(updatedPlayer.lookRotationY);
          }

          return updatedPlayer;
      });
  
      // Auto-collect nearby orbs
      memoryOrbs.forEach((orb, index) => {
        if (!orb.collected) {
          const dx = player.x - orb.x;
          const dy = player.y - orb.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 40) {
            handleOrbClick(index);
          }
        }
      });

      // NEW: Auto-collect nearby power-ups
      powerUps.forEach((pUp, index) => {
        if (!pUp.collected) {
          const dx = player.x - pUp.x;
          const dy = player.y - pUp.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 40) { // Same collection radius as orbs
            handlePowerUpClick(index);
          }
        }
      });

    }, 16); // ~60 FPS
    return () => clearInterval(moveInterval);
  }, [isActive, gameState, memoryOrbs, powerUps, player, handleOrbClick, handlePowerUpClick, checkCollision, cameraRotationRef, onPlayerPositionUpdate, onPlayerLookRotationUpdate]); 

  // Enhanced Guardian AI with better pathfinding
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;
    const guardianInterval = setInterval(() => {
      const currentMap = getCurrentRoomLayout();
      const config = getLevelConfig(currentLevel);
      const currentTime = Date.now();
      
      setGuardians(prevGuardians => prevGuardians.map(guardian => {
        const dx = player.x - guardian.x; // Player X - Guardian X (game coords)
        const dy = player.y - guardian.y; // Player Y - Guardian Y (game coords)
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isAlert = distance < 120; // Alert radius

        let newX = guardian.x;
        let newY = guardian.y;
        const guardianRadius = 15;
        let newDirectionX = guardian.directionX;
        let newDirectionY = guardian.directionY;
        let angle = guardian.rotationY; // Current 3D rotation angle
        let stuckCounter = guardian.stuckCounter;

        if (isAlert) {
          // Enhanced chase behavior
          const chaseSpeed = config.guardSpeed * 1.5;
          // CORRECTED: Guardian faces player. In Three.js, Math.atan2(X, Z) gives Y-rotation.
          // In game coords, X is X, Y is Z. So Math.atan2(dx, dy)
          angle = Math.atan2(dx, dy); 
          
          const chaseX = Math.sin(angle) * chaseSpeed; // If angle is from atan2(X,Z), then X-movement is sin(angle)
          const chaseY = Math.cos(angle) * chaseSpeed; // And Z-movement (game Y) is cos(angle)
          
          // Try direct path first
          if (!checkCollision(newX + chaseX, newY + chaseY, guardianRadius)) {
            newX += chaseX;
            newY += chaseY;
            stuckCounter = 0;
          } else {
            // Try alternative paths if direct path is blocked (simplified examples)
            const alternatives = [
              { x: Math.sin(angle + Math.PI/6) * chaseSpeed, y: Math.cos(angle + Math.PI/6) * chaseSpeed }, // Slight left
              { x: Math.sin(angle - Math.PI/6) * chaseSpeed, y: Math.cos(angle - Math.PI/6) * chaseSpeed }, // Slight right
              { x: Math.sin(angle + Math.PI/2) * chaseSpeed * 0.5, y: Math.cos(angle + Math.PI/2) * chaseSpeed * 0.5 }, // Hard left
              { x: Math.sin(angle - Math.PI/2) * chaseSpeed * 0.5, y: Math.cos(angle - Math.PI/2) * chaseSpeed * 0.5 }  // Hard right
            ];
            
            let moved = false;
            for (const alt of alternatives) {
              if (!checkCollision(newX + alt.x, newY + alt.y, guardianRadius)) {
                newX += alt.x;
                newY += alt.y;
                angle = Math.atan2(alt.x, alt.y); // Update angle to new movement direction
                moved = true;
                stuckCounter = 0;
                break;
              }
            }
            
            if (!moved) {
              stuckCounter++;
            }
          }
        } else {
          // Normal patrol behavior
          const patrolSpeed = config.guardSpeed * 0.6;
          
          // Change direction periodically or when hitting wall
          const timeSinceLastChange = currentTime - guardian.lastDirectionChange;
          // Lowered stuck threshold for random direction changes for more dynamic patrol
          const shouldChangeDirection = stuckCounter > 2 || timeSinceLastChange > 2500 + Math.random() * 2000; 
          
          // Calculate potential new position
          const potentialX = newX + newDirectionX * patrolSpeed;
          const potentialY = newY + newDirectionY * patrolSpeed;
          
          const willCollide = checkCollision(potentialX, potentialY, guardianRadius);
          
          if (willCollide || shouldChangeDirection) {
            const directions = [
              { x: 0, y: 1 },   // Down (positive Y in game -> positive Z in 3D)
              { x: 0, y: -1 },  // Up (negative Y in game -> negative Z in 3D)
              { x: 1, y: 0 },   // Right (positive X in game -> positive X in 3D)
              { x: -1, y: 0 },  // Left (negative X in game -> negative X in 3D)
            ];
            // Prioritize straight cardinal directions to avoid diagonal sticking
            const validDirections = directions.filter(dir => {
              const testX = newX + dir.x * patrolSpeed * 3;
              const testY = newY + dir.y * patrolSpeed * 3;
              return !checkCollision(testX, testY, guardianRadius);
            });
            
            if (validDirections.length > 0) {
              const newDir = validDirections[Math.floor(Math.random() * validDirections.length)];
              newDirectionX = newDir.x;
              newDirectionY = newDir.y;
              guardian.lastDirectionChange = currentTime;
              stuckCounter = 0;
            } else {
              // If all cardinal directions are blocked, try diagonals or just turn around
              const diagonalDirections = [
                  { x: 0.7, y: 0.7 }, { x: -0.7, y: 0.7 }, { x: 0.7, y: -0.7 }, { x: -0.7, y: -0.7 }
              ].filter(dir => {
                  const testX = newX + dir.x * patrolSpeed * 3;
                  const testY = newY + dir.y * patrolSpeed * 3;
                  return !checkCollision(testX, testY, guardianRadius);
              });
              if(diagonalDirections.length > 0) {
                  const newDir = diagonalDirections[Math.floor(Math.random() * diagonalDirections.length)];
                  newDirectionX = newDir.x;
                  newDirectionY = newDir.y;
                  guardian.lastDirectionChange = currentTime;
                  stuckCounter = 0;
              } else {
                  // Fallback: turn 180 degrees
                  newDirectionX = -guardian.directionX;
                  newDirectionY = -guardian.directionY;
                  guardian.lastDirectionChange = currentTime;
                  stuckCounter++;
              }
            }
          }
          
          // Move in current direction
          const moveX = newDirectionX * patrolSpeed;
          const moveY = newDirectionY * patrolSpeed;
          
          if (!checkCollision(newX + moveX, newY + moveY, guardianRadius)) {
            newX += moveX;
            newY += moveY;
            // CORRECTED: Guardian faces its movement direction
            angle = Math.atan2(newDirectionX, newDirectionY); 
            stuckCounter = Math.max(0, stuckCounter - 1);
          } else {
            stuckCounter++;
          }
        }

        // Emergency teleport if guardian is stuck for too long
        if (stuckCounter > 5) { // Adjusted threshold for quicker reset
          console.warn(`Guardian ${JSON.stringify(guardian)} stuck, teleporting.`);
          const safePos = getRandomSafePosition();
          newX = safePos.x;
          newY = safePos.y;
          stuckCounter = 0;
          guardian.lastDirectionChange = currentTime;
        }

        // Check if guardian caught player
        const catchDistance = Math.sqrt((newX - player.x) ** 2 + (newY - player.y) ** 2);
        if (catchDistance < 30) {
          onGameStateChange('gameOver');
          if (soundsRef.current && !muted) soundsRef.current.gameOver.play();
          saveScore(playerName, timeRemaining, difficulty, score, mind);
        }

        return { 
          ...guardian, 
          x: newX, 
          y: newY, 
          directionX: newDirectionX,
          directionY: newDirectionY,
          alert: isAlert, 
          rotationY: angle,
          stuckCounter
        };
      }));
    }, 100); // Run guardian updates every 100ms
    return () => clearInterval(guardianInterval);
  }, [isActive, gameState, getCurrentRoomLayout, player, currentLevel, getLevelConfig, onGameStateChange, muted, playerName, timeRemaining, difficulty, score, mind, checkCollision, getRandomSafePosition]);

  // Timer
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;
    const id = setInterval(() => {
      setTimeRemaining(prev => {
        const next = Math.max(0, prev - 1);
        onTimerUpdate?.(next);
        if (next === 0) {
          onTimerActive?.(false);
          onGameStateChange('gameOver');
          if (soundsRef.current && !muted) soundsRef.current.gameOver.play();
          saveScore(playerName, prev, difficulty, score, mind);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, gameState, playerName, difficulty, score, mind, muted, onTimerActive, onTimerUpdate, onGameStateChange]);

  // Check Victory Condition
  useEffect(() => {
    const collectedOrbs = memoryOrbs.filter(orb => orb.collected).length;
    const totalOrbs = memoryOrbs.length;
    
    if (totalOrbs > 0 && collectedOrbs === totalOrbs && gameState === 'playing' &&isSpawningComplete ) {
      if (currentLevel < commonConfig.MAX_LEVELS) {               
        
        setTimeout(() => {
          const nextLevel = currentLevel + 1;
          setCurrentLevel(nextLevel);
          onLevelChange?.(nextLevel);
          resetGameState(nextLevel);
         
          
        }, 7000); // 7-second delay
        
        
      } else {
        onGameStateChange('victory');
        if (soundsRef.current && !muted) soundsRef.current.victory.play();
        saveScore(playerName, timeRemaining, difficulty, score, mind);
        setGameState('idle'); 
      }
    }
  }, [memoryOrbs, gameState, onGameStateChange, muted, playerName, timeRemaining, difficulty, score, mind, currentLevel, onLevelChange, resetGameState, isSpawningComplete]);
  // Init
  useEffect(() => { 
    if (isActive && gameState === 'idle') resetGameState(1); 
  }, [isActive, gameState, resetGameState]);

  const playerPosition: [number, number, number] = [
    (player.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
    0,
    (player.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
  ];

  return (
    <div className="w-full h-full bg-background relative">
    {isLoading && (
      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
        <div className="text-white text-2xl font-bold animate-pulse">
          Loading Next Level...
        </div>
      </div>
    )}
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [playerPosition[0], 1.6, playerPosition[2]], fov: 75, near: 0.1, far: 1000 }}
    >
        <GameScene 
          playerPosition={playerPosition}
          memoryOrbs={memoryOrbs}
          guardians={guardians}
          powerUps={powerUps} // NEW: Pass powerUps
          onOrbClick={handleOrbClick}
          onPowerUpClick={handlePowerUpClick} // NEW: Pass powerUp click handler
          roomShift={roomShift}
          mazeLayout={getCurrentRoomLayout()}
          playerMovement={playerMovement}
          gameState={gameState}
          gameSettings={gameSettings}
          thirdPerson={thirdPerson}
          isSprinting={sprintingRef.current}
          cameraRotationRef={cameraRotationRef} 
          texturePath={texturePath} 
        />
      </Canvas>
      
      {/* Fixed Controls Instructions */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-sm max-w-xs">
        <div className="font-bold mb-2 text-green-400">✅ FIXED Controls:</div>
        <div>WASD: Move (Camera-Relative)</div>
        <div>Hold Shift: Sprint</div>
        <div>V: Toggle Camera View</div>
        <div>Mouse: Look Around</div>
        <div>Click: Lock Mouse</div>
        <div>ESC: Pause</div>
        <div className="mt-2 text-xs border-t border-gray-600 pt-2">
          <div className="text-yellow-300">Mode: {thirdPerson ? 'Third Person' : 'First Person'}</div>
          <div className="text-blue-300">Sprint: {sprintingRef.current ? 'Active' : 'Ready'}</div>
          <div className="text-gray-300">Movement: Call of Duty Style (Unified)</div>
        </div>
      </div>
      
    </div>
  );
});

GameCanvas3D.displayName = 'GameCanvas3D';