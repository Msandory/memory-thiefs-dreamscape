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
  PowerUpType, 
  difficultyConfigs, 
  commonConfig
} from '@/config/gameConfig';
import { getMaze } from '@/utils/mazeGenerator';
import { GLTF } from 'three-stdlib'; 

interface ActivePowerUp { type: PowerUpType; duration: number; maxDuration: number; }
interface PowerUpItem { x: number; y: number; type: PowerUpType; collected: boolean; spawn_time: number; }
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
  wallTexture?: string;
  onLoadingStateChange?: (loading: boolean, progress: number, stage: string) => void;
}

interface Guardian { 
  x: number; 
  y: number; 
  directionX: number; 
  directionY: number; 
  alert: boolean; 
  rotationY: number;
  lastDirectionChange: number;
  stuckCounter: number; // Track how long guardian has been stuck
}

function Wall({ position, onMeshReady, texture: wallTexture }: { 
  position: [number, number, number], 
  onMeshReady?: (mesh: THREE.Mesh) => void,
  texture?: string
}) {
  const texture = useTexture(wallTexture || brickWallTexture);
  const meshRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    if (meshRef.current && onMeshReady) {
      onMeshReady(meshRef.current);
    }
  }, [texture, onMeshReady]);
  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[2, 4, 2]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ---------- Player 3D Model (GLB) ----------
type PlayerGLTFResult = GLTF & { animations: THREE.AnimationClip[]; };
function PlayerModel({ position, visible, isSprinting, isMoving, rotationY }: 
  { position: [number, number, number], visible: boolean, isSprinting: boolean, isMoving: boolean, rotationY?: number }) {

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
    <group position={[position[0], 0, position[2]]} rotation={[0, rotationY || 0, 0]} visible={visible}>
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
      <meshStandardMaterial color="#9B59B6" emissive="#8E44AD" emissiveIntensity={0.5} />
    </mesh>
  );
}

// ---------- Power Up (on the floor) ----------
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
  useFrame((state) => {
    if (meshRef.current && !collected) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });
  
  if (collected) return null;

  const getColor = (powerUpType: PowerUpType) => {
    switch (powerUpType) {
      case 'speed': return '#00FF00';
      case 'immunity': return '#FFD700';
      case 'thunder': return '#FF6600';
      case 'timer': return '#00CCFF';
      default: return '#FFFFFF';
    }
  };

  return (
    <mesh ref={meshRef} position={position} onClick={onClick}>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshStandardMaterial 
        color={getColor(type)} 
        emissive={getColor(type)} 
        emissiveIntensity={0.3}
      />
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

// ---------- Enhanced 3D Scene with Dynamic Camera ----------
function GameScene({ 
  playerPosition,
  memoryOrbs,
  guardians,
  powerUps,
  onOrbClick,
  onPowerUpClick,
  roomShift,
  mazeLayout,
  playerMovement,
  gameState,
  gameSettings,
  thirdPerson,
  isSprinting,
  cameraRotationRef,
  playerFacingDirection,
  wallTexture
}: { 
  playerPosition: [number, number, number],
  memoryOrbs: Array<{ x: number; y: number; collected: boolean; pulse: number }>,
  guardians: Array<Guardian>,
  powerUps: Array<PowerUpItem>,
  onOrbClick: (index: number) => void,
  onPowerUpClick: (index: number) => void,
  roomShift: { x: number, y: number, intensity: number },
  mazeLayout: number[][],
  playerMovement: { isMoving: boolean, isRunningFast: boolean },
  gameState: 'idle' | 'playing',
  gameSettings: GameSettings,
  thirdPerson: boolean,
  isSprinting?: boolean,
  cameraRotationRef: React.MutableRefObject<{ x: number; y: number }>,
  playerFacingDirection: number,
  wallTexture?: string
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const rotationRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ isLocked: false });
  const raycaster = useRef(new THREE.Raycaster());
  const wallMeshes = useRef<THREE.Mesh[]>([]);
  
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
      const verticalMovement = gameSettings.mouseInvert ? -event.movementY : event.movementY;
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

  // Dynamic camera collision detection
  const checkCameraCollision = useCallback((from: THREE.Vector3, to: THREE.Vector3): number => {
    raycaster.current.set(from, to.clone().sub(from).normalize());
    const intersects = raycaster.current.intersectObjects(wallMeshes.current, true);
    
    if (intersects.length > 0) {
      const distance = from.distanceTo(to);
      const collisionDistance = intersects[0].distance;
      return Math.max(1, collisionDistance - 0.5); // Leave some buffer
    }
    return from.distanceTo(to);
  }, []);

  useFrame(() => {
    const eyeHeight = 1.6;
    const px = playerPosition[0];
    const pz = playerPosition[2];

    // Store camera rotation for movement calculations in parent component
    cameraRotationRef.current = rotationRef.current;

    if (!thirdPerson) {
      // First-person: camera at player position with fixed rotation
      camera.position.set(px, eyeHeight, pz);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = rotationRef.current.y;
      camera.rotation.x = rotationRef.current.x;
      camera.rotation.z = 0; // Prevent camera tilt/skew
    } else {
      // Third-person with fixed camera distance
      const baseDistance = 4;
      const height = 2.5;
      
      const yaw = rotationRef.current.y;
      const pitch = rotationRef.current.x * 0.3;
      
      const camX = px - Math.sin(yaw) * baseDistance;
      const camY = height - Math.sin(pitch) * 1;
      const camZ = pz - Math.cos(yaw) * baseDistance;
      
      camera.position.set(camX, camY, camZ);
      camera.lookAt(px, 1.2, pz);
    }

    // Room shift effect
    if (groupRef.current && roomShift.intensity > 0) {
      groupRef.current.position.x = roomShift.x * roomShift.intensity;
      groupRef.current.position.z = roomShift.y * roomShift.intensity;
    }
  });

  // Build walls and store mesh references for collision detection
  const walls: JSX.Element[] = [];
  wallMeshes.current = [];
  
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (mazeLayout[row] && mazeLayout[row][col] === 1) {
        const x = (col - MAP_COLS / 2) * 2;
        const z = (row - MAP_ROWS / 2) * 2;
        walls.push(
          <Wall 
            key={`wall-${row}-${col}`} 
            position={[x, 2, z]} 
            texture={wallTexture}
            onMeshReady={(mesh) => wallMeshes.current.push(mesh)}
          />
        );
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

      {/* Player model with proper rotation */}
      <PlayerModel 
        position={playerPosition} 
        visible={thirdPerson} 
        isSprinting={isSprinting} 
        isMoving={playerMovement.isMoving}
        rotationY={thirdPerson ? playerFacingDirection : rotationRef.current.y}
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

      {/* Power-ups */}
      {powerUps.map((powerUp, index) => (
        <PowerUpModel
          key={`powerup-${index}`}
          position={[
            (powerUp.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            0.5,
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
            (guardian.x - MAP_COLS * TILE_SIZE / 2) / (TILE_SIZE / 2),
            0,
            (guardian.y - MAP_ROWS * TILE_SIZE / 2) / (TILE_SIZE / 2)
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

// ---------------- Main Component ----------------
export const GameCanvas3D = forwardRef<any, GameCanvasProps>(({
  isActive, onGameStateChange, onMemoryCollected, playerName, onPlayerNameLoaded, muted, onTimerUpdate, onTimerActive, onLevelChange, mobileDirection = { up: false, down: false, left: false, right: false }, difficulty, mind, mazeId, onScoreUpdate, gameSettings, onSettingsChange, wallTexture, onLoadingStateChange
}, ref) => {
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [roomShift, setRoomShift] = useState({ x: 0, y: 0, intensity: 0 });
  const [player, setPlayer] = useState({ x: 100, y: 100, size: 20, rotationY: 0 });
  const [playerMovement, setPlayerMovement] = useState({ isMoving: false, isRunningFast: false });
  const [thirdPerson, setThirdPerson] = useState(true);
  const sprintingRef = useRef(false);
  const keysPressed = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const [memoryOrbs, setMemoryOrbs] = useState<{ x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUpItem[]>([]);
  const [currentMazeLayout, setCurrentMazeLayout] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('Initializing...');
  const cameraRotationRef = useRef({ x: 0, y: 0 });
  
  const soundsRef = useRef<{ orbCollect: Howl; guardianAlert: Howl; gameOver: Howl; victory: Howl; background: Howl; } | null>(null);
  const timerStarted = useRef(false);

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
      powerUpChance: diffConfig.powerUpChance, 
    }; 
  };

  // Simplified collision detection with 4-point check
  const checkCollisionEnhanced = useCallback((x: number, y: number, radius: number = 12) => {
    const currentMap = getCurrentRoomLayout();
    
    // Simplified 4-point collision check for better performance
    const checkPoints = [
      [x - radius, y - radius], // Top-left
      [x + radius, y - radius], // Top-right
      [x - radius, y + radius], // Bottom-left
      [x + radius, y + radius], // Bottom-right
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
    do { 
      const randCol = Math.floor(Math.random() * MAP_COLS); 
      const randRow = Math.floor(Math.random() * MAP_ROWS); 
      const x = randCol * TILE_SIZE + TILE_SIZE / 2;
      const y = randRow * TILE_SIZE + TILE_SIZE / 2;
      
      // Fix the variable name bug - was using randCol instead of randRow
      if (currentMap[randRow] && currentMap[randRow][randCol] === 0 && !checkCollisionEnhanced(x, y, 15)) { 
        pos = { x, y }; 
      } 
      attempts++; 
    } while (!pos && attempts < 100); 
    return pos || { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 }; 
  }, [getCurrentRoomLayout, checkCollisionEnhanced]);

  const handleOrbClick = useCallback((orbIndex: number) => {
    const orb = memoryOrbs[orbIndex];
    if (!orb || orb.collected) return;
    
    // Convert 3D world position back to 2D game coordinates for distance calculation
    const worldToGameX = (orb.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const worldToGameZ = (orb.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const playerWorldX = (player.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2;
    const playerWorldZ = (player.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2;
    
    const dx = playerWorldX - worldToGameX;
    const dz = playerWorldZ - worldToGameZ;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < 2) { // Reduced distance for easier collection in 3D
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

  const resetGameState = useCallback((level: number = 1) => { 
    setActivePowerUps([]); 
    setPowerUps([]);
    const config = getLevelConfig(level); 
    const newPlayerPos = getRandomSafePosition();
    setPlayer({ ...newPlayerPos, size: 20, rotationY: 0 }); 
    const newOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[] = []; 
    const newGuardians: Guardian[] = [];
    const newPowerUps: PowerUpItem[] = [];
    const spawnedPositions: {x: number, y: number}[] = [newPlayerPos]; 
    
    // Spawn orbs
    for (let i = 0; i < config.orbs; i++) { 
      let newPos; 
      do { newPos = getRandomSafePosition(); } while (spawnedPositions.some(p => {
        const dx = newPos.x - p.x; const dy = newPos.y - p.y; return Math.sqrt(dx*dx + dy*dy) < commonConfig.safeDistance;
      })); 
      spawnedPositions.push(newPos); 
      newOrbs.push({ ...newPos, collected: false, pulse: Math.random() * Math.PI * 2, collectingTime: 0 }); 
    }
    
    // Spawn power-ups if level is high enough
    if (level >= commonConfig.powerUpStartLevel) {
      const powerUpTypes: PowerUpType[] = ['speed', 'immunity', 'thunder', 'timer'];
      const numPowerUps = Math.min(2, Math.floor(level / 2)); // Max 2 power-ups
      
      for (let i = 0; i < numPowerUps; i++) {
        if (Math.random() < config.powerUpChance) {
          let newPos;
          do { newPos = getRandomSafePosition(); } while (spawnedPositions.some(p => {
            const dx = newPos.x - p.x; const dy = newPos.y - p.y; return Math.sqrt(dx*dx + dy*dy) < commonConfig.safeDistance;
          }));
          spawnedPositions.push(newPos);
          const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
          newPowerUps.push({
            ...newPos,
            type: randomType,
            collected: false,
            spawn_time: Date.now()
          });
        }
      }
    }
    
    // Spawn guardians
    for (let i = 0; i < config.guards; i++) { 
      let newPos; 
      do { newPos = getRandomSafePosition(); } while (spawnedPositions.some(p => {
        const dx = newPos.x - p.x; const dy = newPos.y - p.y; return Math.sqrt(dx*dx + dy*dy) < commonConfig.safeDistance;
      })); 
      spawnedPositions.push(newPos); 
      newGuardians.push({ 
        ...newPos, 
        directionX: Math.random() > 0.5 ? 1 : -1, 
        directionY: Math.random() > 0.5 ? 1 : -1, 
        alert: false, 
        rotationY: 0,
        lastDirectionChange: Date.now(),
        stuckCounter: 0
      }); 
    } 
    
    setMemoryOrbs(newOrbs); 
    setGuardians(newGuardians);
    setPowerUps(newPowerUps);
    timerStarted.current = true; 
    const t = config.timer;
    setTimeRemaining(t); 
    onTimerUpdate?.(t);
    onTimerActive?.(true);
    setCurrentLevel(level); 
    setGameState('playing'); 
    onGameStateChange('playing'); 
  }, [getLevelConfig, getRandomSafePosition, onGameStateChange, onTimerActive, onTimerUpdate]);

  // Power-up collection handler
  const handlePowerUpClick = useCallback((powerUpIndex: number) => {
    const powerUp = powerUps[powerUpIndex];
    if (!powerUp || powerUp.collected) return;
    
    const dx = player.x - powerUp.x;
    const dy = player.y - powerUp.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 40) {
      const newPowerUps = [...powerUps];
      newPowerUps[powerUpIndex] = { ...powerUp, collected: true };
      setPowerUps(newPowerUps);
      
      // Activate power-up
      const duration = powerUp.type === 'timer' ? 0 : 10; // Timer adds time, others last 10 seconds
      if (powerUp.type === 'timer') {
        setTimeRemaining(prev => prev + 30); // Add 30 seconds
        onTimerUpdate?.(timeRemaining + 30);
      } else if (powerUp.type === 'thunder') {
        // Thunder instantly stuns all guardians for 3 seconds
        setGuardians(prev => prev.map(guardian => ({
          ...guardian,
          alert: false,
          stuckCounter: 30 // Freeze them
        })));
      } else {
        setActivePowerUps(prev => [
          ...prev.filter(p => p.type !== powerUp.type), // Remove existing same type
          { type: powerUp.type, duration, maxDuration: duration }
        ]);
      }
      
      if (soundsRef.current && !muted) soundsRef.current.orbCollect.play();
    }
  }, [powerUps, player, timeRemaining, muted, onTimerUpdate]);

  useImperativeHandle(ref, () => ({
    reset: () => resetGameState(1),
    retry: () => { const newLevel = Math.max(1, currentLevel - 1); resetGameState(newLevel); },
    useThunder: () => {},
    getMazeLayout: () => getCurrentRoomLayout(),
    getPlayerPosition: () => ({ x: player.x, y: player.y }),
    getPlayerRotation: () => cameraRotationRef.current.y,
    getOrbs: () => memoryOrbs,
    getGuardians: () => guardians,
    getPowerUps: () => powerUps
  }));

  // Enhanced keyboard controls with hold-to-sprint
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
        const moveKey = key === 'arrowup' ? 'w' : key === 'arrowdown' ? 's' : key === 'arrowleft' ? 'a' : key === 'arrowright' ? 'd' : key;
        if (moveKey in keysPressed.current) keysPressed.current[moveKey as 'w'|'a'|'s'|'d'] = true;
      }
      // Hold-to-sprint instead of toggle
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

  // Enhanced Movement System with better third-person controls
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;
    const moveInterval = setInterval(() => {
      const currentMap = getCurrentRoomLayout();
      const keys = keysPressed.current;
      const isMovingNow = keys.w || keys.a || keys.s || keys.d;

      const speed = sprintingRef.current ? 8 : 4;
      setPlayerMovement({ isMoving: isMovingNow, isRunningFast: sprintingRef.current && isMovingNow });

      if (isMovingNow) {
        setPlayer(prevPlayer => {
          let deltaX = 0;
          let deltaY = 0;
          const playerRadius = 12; // Slightly reduced for better navigation

      // Call of Duty style camera-relative movement for both views
      const cameraYaw = cameraRotationRef.current.y;
      const forward = { x: Math.sin(cameraYaw), y: -Math.cos(cameraYaw) };
      const right = { x: Math.cos(cameraYaw), y: Math.sin(cameraYaw) };

      // Apply speed multipliers from power-ups
      let finalSpeed = speed;
      activePowerUps.forEach(powerUp => {
        if (powerUp.type === 'speed') {
          finalSpeed *= 1.5; // 50% speed boost
        }
      });

      if (keys.w) { // Forward relative to camera
        deltaX += forward.x * finalSpeed;
        deltaY += forward.y * finalSpeed;
      }
      if (keys.s) { // Backward relative to camera
        deltaX -= forward.x * finalSpeed;
        deltaY -= forward.y * finalSpeed;
      }
      if (keys.a) { // Left relative to camera (strafe)
        deltaX -= right.x * finalSpeed;
        deltaY -= right.y * finalSpeed;
      }
      if (keys.d) { // Right relative to camera (strafe)
        deltaX += right.x * finalSpeed;
        deltaY += right.y * finalSpeed;
      }

      // Calculate new position
      let newX = prevPlayer.x + deltaX;
      let newY = prevPlayer.y + deltaY;

      // Player model rotation for visual appearance only (doesn't affect controls)
      let newRotationY = prevPlayer.rotationY;
      if (thirdPerson && (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1)) {
        newRotationY = Math.atan2(deltaX, -deltaY); // Face movement direction in third person
      }

      // Simplified collision detection with wall sliding
      const canMoveX = !checkCollisionEnhanced(newX, prevPlayer.y, playerRadius);
      const canMoveY = !checkCollisionEnhanced(prevPlayer.x, newY, playerRadius);
      const canMoveBoth = !checkCollisionEnhanced(newX, newY, playerRadius);

      // Apply movement with wall sliding
      if (canMoveBoth) {
        prevPlayer.x = newX;
        prevPlayer.y = newY;
      } else if (canMoveX) {
        prevPlayer.x = newX;
      } else if (canMoveY) {
        prevPlayer.y = newY;
      }

      // Update rotation for third-person visual only
      if (thirdPerson && (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1)) {
        prevPlayer.rotationY = newRotationY;
      }

          return { ...prevPlayer };
        });

        // Auto-collect nearby orbs
        memoryOrbs.forEach((orb, index) => {
          if (!orb.collected) {
            const dx = player.x - orb.x;
            const dy = player.y - orb.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 40) { // Auto-collect distance
              handleOrbClick(index);
            }
          }
        });

        // Auto-collect nearby power-ups
        powerUps.forEach((powerUp, index) => {
          if (!powerUp.collected) {
            const dx = player.x - powerUp.x;
            const dy = player.y - powerUp.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 40) { // Auto-collect distance
              handlePowerUpClick(index);
            }
          }
        });
      }
    }, 16);
    return () => clearInterval(moveInterval);
  }, [isActive, gameState, getCurrentRoomLayout, memoryOrbs, powerUps, player, handleOrbClick, handlePowerUpClick, thirdPerson, checkCollisionEnhanced, activePowerUps]);

  // Enhanced Guardian AI with better pathfinding and stuck detection
  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;
    const guardianInterval = setInterval(() => {
      const currentMap = getCurrentRoomLayout();
      const config = getLevelConfig(currentLevel);
      const currentTime = Date.now();
      
      setGuardians(prevGuardians => prevGuardians.map(guardian => {
        const dx = player.x - guardian.x;
        const dy = player.y - guardian.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const isAlert = distance < 120;

        let newX = guardian.x;
        let newY = guardian.y;
        const guardianRadius = 12; // Reduced for better navigation
        let newDirectionX = guardian.directionX;
        let newDirectionY = guardian.directionY;
        let angle = guardian.rotationY;
        let stuckCounter = guardian.stuckCounter;

        if (isAlert) {
          // Enhanced chase behavior with pathfinding
          const chaseSpeed = config.guardSpeed * 1.8;
          angle = Math.atan2(dy, dx);
          
          const chaseX = Math.cos(angle) * chaseSpeed;
          const chaseY = Math.sin(angle) * chaseSpeed;
          
          // Try direct path first
          if (!checkCollisionEnhanced(newX + chaseX, newY + chaseY, guardianRadius)) {
            newX += chaseX;
            newY += chaseY;
            stuckCounter = 0;
          } else {
            // Try alternative paths if direct path is blocked
            const alternatives = [
              { x: chaseX * 0.7 + Math.cos(angle + Math.PI/4) * chaseSpeed * 0.3, 
                y: chaseY * 0.7 + Math.sin(angle + Math.PI/4) * chaseSpeed * 0.3 },
              { x: chaseX * 0.7 + Math.cos(angle - Math.PI/4) * chaseSpeed * 0.3, 
                y: chaseY * 0.7 + Math.sin(angle - Math.PI/4) * chaseSpeed * 0.3 },
              { x: Math.cos(angle + Math.PI/2) * chaseSpeed * 0.8, 
                y: Math.sin(angle + Math.PI/2) * chaseSpeed * 0.8 },
              { x: Math.cos(angle - Math.PI/2) * chaseSpeed * 0.8, 
                y: Math.sin(angle - Math.PI/2) * chaseSpeed * 0.8 }
            ];
            
            let moved = false;
            for (const alt of alternatives) {
              if (!checkCollisionEnhanced(newX + alt.x, newY + alt.y, guardianRadius)) {
                newX += alt.x;
                newY += alt.y;
                angle = Math.atan2(alt.y, alt.x);
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
          // Enhanced patrol behavior
          const patrolSpeed = config.guardSpeed * 0.6;
          
          // Check if guardian has been stuck
          const timeSinceLastChange = currentTime - guardian.lastDirectionChange;
          const shouldChangeDirection = stuckCounter > 5 || timeSinceLastChange > 3000 + Math.random() * 2000;
          
          // Calculate potential new position
          const potentialX = newX + newDirectionX * patrolSpeed;
          const potentialY = newY + newDirectionY * patrolSpeed;
          
          const willCollide = checkCollisionEnhanced(potentialX, potentialY, guardianRadius);
          
          if (willCollide || shouldChangeDirection) {
            // Smart direction picking with preference for open areas
            const directions = [
              { x: 1, y: 0, weight: 1 },   // Right
              { x: -1, y: 0, weight: 1 },  // Left  
              { x: 0, y: 1, weight: 1 },   // Down
              { x: 0, y: -1, weight: 1 },  // Up
              { x: 0.7, y: 0.7, weight: 0.8 },   // Diagonal down-right
              { x: -0.7, y: 0.7, weight: 0.8 },  // Diagonal down-left
              { x: 0.7, y: -0.7, weight: 0.8 },  // Diagonal up-right
              { x: -0.7, y: -0.7, weight: 0.8 }  // Diagonal up-left
            ];
            
            // Filter valid directions and prefer those leading to open areas
            const validDirections = directions.filter(dir => {
              const testDistance = patrolSpeed * 4; // Look ahead further
              const testX = newX + dir.x * testDistance;
              const testY = newY + dir.y * testDistance;
              return !checkCollisionEnhanced(testX, testY, guardianRadius);
            }).map(dir => ({
              ...dir,
              // Boost weight if direction leads away from walls
              weight: dir.weight * (1 + Math.random() * 0.5)
            }));
            
            if (validDirections.length > 0) {
              // Weighted random selection favoring better directions
              const totalWeight = validDirections.reduce((sum, dir) => sum + dir.weight, 0);
              let random = Math.random() * totalWeight;
              
              for (const dir of validDirections) {
                random -= dir.weight;
                if (random <= 0) {
                  newDirectionX = dir.x;
                  newDirectionY = dir.y;
                  break;
                }
              }
              
              guardian.lastDirectionChange = currentTime;
              stuckCounter = 0;
            } else {
              // Emergency unstuck: try moving backwards
              newDirectionX = -guardian.directionX + (Math.random() - 0.5) * 0.5;
              newDirectionY = -guardian.directionY + (Math.random() - 0.5) * 0.5;
              guardian.lastDirectionChange = currentTime;
              stuckCounter++;
            }
          }
          
          // Move in current direction
          const moveX = newDirectionX * patrolSpeed;
          const moveY = newDirectionY * patrolSpeed;
          
          if (!checkCollisionEnhanced(newX + moveX, newY + moveY, guardianRadius)) {
            newX += moveX;
            newY += moveY;
            angle = Math.atan2(newDirectionY, newDirectionX);
            stuckCounter = Math.max(0, stuckCounter - 1); // Reduce stuck counter when moving
          } else {
            stuckCounter++;
          }
        }

        // Emergency teleport if guardian is stuck for too long
        if (stuckCounter > 50) {
          const safePos = getRandomSafePosition();
          newX = safePos.x;
          newY = safePos.y;
          stuckCounter = 0;
          guardian.lastDirectionChange = currentTime;
          console.log('Guardian teleported due to being stuck');
        }

        // Check if guardian caught player (with immunity power-up check)
        const hasImmunity = activePowerUps.some(powerUp => powerUp.type === 'immunity');
        const catchDistance = Math.sqrt((newX - player.x) ** 2 + (newY - player.y) ** 2);
        if (catchDistance < 25 && !hasImmunity) {
          // Game over - player caught
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
    }, 100);
    return () => clearInterval(guardianInterval);
  }, [isActive, gameState, getCurrentRoomLayout, player, currentLevel, getLevelConfig, onGameStateChange, muted, playerName, timeRemaining, difficulty, score, mind, checkCollisionEnhanced, getRandomSafePosition, activePowerUps]);

  // Power-up duration management
  useEffect(() => {
    if (!isActive || gameState !== 'playing' || activePowerUps.length === 0) return;
    
    const powerUpInterval = setInterval(() => {
      setActivePowerUps(prev => prev.map(powerUp => ({
        ...powerUp,
        duration: Math.max(0, powerUp.duration - 1)
      })).filter(powerUp => powerUp.duration > 0));
    }, 1000);
    
    return () => clearInterval(powerUpInterval);
  }, [isActive, gameState, activePowerUps]);

  // Timer (show + callbacks)
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
    
    if (totalOrbs > 0 && collectedOrbs === totalOrbs && gameState === 'playing') {
      // All orbs collected - victory!
      onGameStateChange('victory');
      if (soundsRef.current && !muted) soundsRef.current.victory.play();
      saveScore(playerName, timeRemaining, difficulty, score, mind);
      setGameState('idle');
    }
  }, [memoryOrbs, gameState, onGameStateChange, muted, playerName, timeRemaining, difficulty, score, mind]);

  // Loading simulation
  useEffect(() => {
    if (isActive && gameState === 'idle') {
      setLoading(true);
      setLoadingProgress(0);
      setLoadingStage('Loading maze layout...');
      onLoadingStateChange?.(true, 0, 'Loading maze layout...');
      
      const loadingSteps = [
        { progress: 20, stage: 'Generating player position...' },
        { progress: 40, stage: 'Spawning memory orbs...' },
        { progress: 60, stage: 'Initializing guardians...' },
        { progress: 80, stage: 'Loading 3D models...' },
        { progress: 100, stage: 'Ready to play!' }
      ];
      
      let currentStep = 0;
      const stepInterval = setInterval(() => {
        if (currentStep < loadingSteps.length) {
          const step = loadingSteps[currentStep];
          setLoadingProgress(step.progress);
          setLoadingStage(step.stage);
          onLoadingStateChange?.(true, step.progress, step.stage);
          currentStep++;
        } else {
          clearInterval(stepInterval);
          setTimeout(() => {
            setLoading(false);
            onLoadingStateChange?.(false, 100, 'Complete');
            setGameState('playing');
            resetGameState(1);
          }, 500);
        }
      }, 300);
      
      return () => clearInterval(stepInterval);
    }
  }, [isActive, gameState, resetGameState, onLoadingStateChange]);

  // Initialize game when not loading and game is idle
  useEffect(() => {
    if (isActive && gameState === 'idle' && !loading) {
      resetGameState(1);
    }
  }, [isActive, gameState, resetGameState, loading]);

  const playerPosition: [number, number, number] = [
    (player.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
    0,
    (player.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
  ];

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = (t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="w-full h-full bg-background relative flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-xl font-bold text-foreground">Loading Memory Palace</div>
          <div className="w-64 bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div className="text-sm text-muted-foreground">{loadingStage}</div>
          <div className="text-xs text-muted-foreground">{loadingProgress}%</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-background relative">
      
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [playerPosition[0], 1.6, playerPosition[2]], fov: 75, near: 0.1, far: 1000 }}
      >
        <GameScene 
          playerPosition={playerPosition}
          memoryOrbs={memoryOrbs}
          guardians={guardians}
          powerUps={powerUps}
          onOrbClick={handleOrbClick}
          onPowerUpClick={handlePowerUpClick}
          roomShift={roomShift}
          mazeLayout={getCurrentRoomLayout()}
          playerMovement={playerMovement}
          gameState={gameState}
          gameSettings={gameSettings}
          thirdPerson={thirdPerson}
          isSprinting={sprintingRef.current}
          cameraRotationRef={cameraRotationRef}
          playerFacingDirection={player.rotationY}
          wallTexture={wallTexture}
        />
      </Canvas>
      
      {/* Enhanced Controls Instructions */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg text-sm">
        <div className="font-bold mb-2">Enhanced Controls:</div>
        <div>WASD: Move</div>
        <div>Hold Shift: Sprint</div>
        <div>V: Toggle Camera</div>
        <div>Mouse: Look Around</div>
        <div>Click: Lock Mouse</div>
        <div>ESC: Pause</div>
        <div className="mt-2 text-xs text-gray-300">
          Camera: {thirdPerson ? 'Third Person' : 'First Person'}
        </div>
        <div className="text-xs text-gray-300">
          Sprint: {sprintingRef.current ? 'Active' : 'Inactive'}
        </div>
        {activePowerUps.length > 0 && (
          <div className="mt-2 text-xs text-yellow-300">
            Active Power-ups:
            {activePowerUps.map((powerUp, index) => (
              <div key={index}>
                {powerUp.type}: {powerUp.duration}s
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
});

GameCanvas3D.displayName = 'GameCanvas3D';