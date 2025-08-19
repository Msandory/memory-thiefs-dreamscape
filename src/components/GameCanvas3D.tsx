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
import footsteps from '@/assets/audio/footsteps.mp3';
import runningSound from '@/assets/audio/running.mp3'; 
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
  thirdPerson: boolean; // Receive current state from parent
  onToggleThirdPerson: (value: boolean) => void; // Receive setter from parent
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

function Wall({ position, texturePath }: { position: [number, number, number], texturePath: string }) {
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

type PlayerGLTFResult = GLTF & { animations: THREE.AnimationClip[]; };
function PlayerModel({ position, visible, isSprinting, isMoving, rotationY }: 
  { position: [number, number, number], visible: boolean, isSprinting: boolean, isMoving: boolean, rotationY: number }) {
  const { scene, animations } = useGLTF('/assets/3DModels/player1.glb') as PlayerGLTFResult;
  const { actions } = useAnimations(animations, scene);
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const idle = actions['Idle'] || actions['idle'];
    const run = actions['Running'] || actions['run'];
    const runFast = actions['Run Fast'] || actions['run fast'] || actions['RunFast'];

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
      <meshStandardMaterial color="#9B59B6" emissive="#8E44AD" emissiveIntensity={1.0} /> 
    </mesh>
  );
}

type GuardianGLTFResult = GLTF & { animations: THREE.AnimationClip[]; };
function GuardianModel({ position, alert, rotationY }: { position: [number, number, number]; alert: boolean; rotationY: number; }) {
  const { scene, animations } = useGLTF('/assets/3DModels/guards.glb') as GuardianGLTFResult;
  const { actions } = useAnimations(animations, scene);
  const currentAction = useRef<THREE.AnimationAction | null>(null);

  const modelCorrectionOffset = -Math.PI / 2; 
  const finalModelRotationY = rotationY; // Default, if your model correctly aligns with Math.atan2(dx, dy) 
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
    <group position={[position[0], 0, position[2]]} rotation={[0, finalModelRotationY, 0]}>
      <primitive object={scene} scale={1.5} />
    </group>
  );
}
useGLTF.preload('/assets/3DModels/guards.glb');
useGLTF.preload('/assets/3DModels/player1.glb');

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
  
  const color = {
    [PowerUpType.Speed]: '#00FF00',
    [PowerUpType.Immunity]: '#FFD700',
    [PowerUpType.Thunder]: '#FF6600',
    [PowerUpType.Timer]: '#00CCFF',
  }[type] || '#FFFFFF';

  useFrame((state) => {
    if (meshRef.current && !collected) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
      meshRef.current.position.y = position[1] + 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });

  if (collected) return null;

  return (
    <mesh ref={meshRef} position={[position[0], position[1] + 0.5, position[2]]} onClick={onClick}>
      <boxGeometry args={[0.6, 0.6, 0.6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  );
}

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
  texturePath
}: { 
  playerPosition: [number, number, number],
  memoryOrbs: Array<{ x: number; y: number; collected: boolean; pulse: number }>,
  guardians: Array<Guardian>,
  powerUps: Array<SpawnedPowerUp>,
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
  texturePath: string
  }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const rotationRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ isLocked: false });
  const raycaster = useRef(new THREE.Raycaster());
  
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

  useEffect(() => {
    if (gameState !== 'playing') {
      document.exitPointerLock();
      mouseRef.current.isLocked = false;
    }
  }, [gameState]);

  const checkCameraCollision = useCallback((from: THREE.Vector3, to: THREE.Vector3): number => {
    if (!thirdPerson) return from.distanceTo(to);
    
    raycaster.current.set(from, to.clone().sub(from).normalize());
    
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
      return Math.max(1.2, collisionDistance - 0.3);
    }
    return from.distanceTo(to);
  }, [thirdPerson, camera]);
  const DEBUG_SKEW_VIEW = false;

  useFrame(() => {
    const px = playerPosition[0];
    const pz = playerPosition[2];
    const eyeHeight = 1.6;
    if (DEBUG_SKEW_VIEW) {
      const height = 20;
      const distance = 15;
      const yaw = Math.PI / 4;

      const camX = px - Math.sin(yaw) * distance;
      const camY = height;
      const camZ = pz - Math.cos(yaw) * distance;

      camera.position.set(camX, camY, camZ);
      return;
    }

    if (!thirdPerson) {
      camera.position.set(px, eyeHeight, pz);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = rotationRef.current.y;
      camera.rotation.x = rotationRef.current.x;
      camera.rotation.z = 0;
    } else {
      const baseDistance = 2.5;
      const minDistance = 1.2;
      const height = 2.2;
      
      const yaw = rotationRef.current.y;
      const pitch = rotationRef.current.x * 0.4;
      
      const camX = px - Math.sin(yaw) * baseDistance;
      const camY = height - Math.sin(pitch) * 1.2;
      const camZ = pz - Math.cos(yaw) * baseDistance;
      
      const playerPos = new THREE.Vector3(px, 1.2, pz);
      const desiredCamPos = new THREE.Vector3(camX, camY, camZ);
      
      const actualDistance = checkCameraCollision(playerPos, desiredCamPos);
      const clampedDistance = Math.max(minDistance, actualDistance);
      
      const finalCamX = px - Math.sin(yaw) * clampedDistance;
      const finalCamZ = pz - Math.cos(yaw) * clampedDistance;
      
      camera.position.set(finalCamX, camY, finalCamZ);
      camera.lookAt(px, 1.2, pz);
    }

    cameraRotationRef.current.x = rotationRef.current.x;
    cameraRotationRef.current.y = rotationRef.current.y;

    if (groupRef.current && roomShift.intensity > 0) {
      groupRef.current.position.x = roomShift.x * roomShift.intensity;
      groupRef.current.position.z = roomShift.y * roomShift.intensity;
    }
  });

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_COLS * 2, MAP_ROWS * 2]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {walls}
      <PlayerModel 
        position={playerPosition} 
        visible={thirdPerson} 
        isSprinting={isSprinting} 
        isMoving={playerMovement.isMoving}
        rotationY={cameraRotationRef.current.y}
      />
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
      {powerUps.map((powerUp, index) => (
        <PowerUpModel
          key={`powerup-${index}`}
          position={[
            (powerUp.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            0.3,
            (powerUp.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
          ]}
          type={powerUp.type}
          collected={powerUp.collected}
          onClick={() => onPowerUpClick(index)}
        />
      ))}
      {guardians.map((guardian, index) => (
        <GuardianModel
          key={`guardian-${index}`}
          position={[
            (guardian.x - MAP_COLS * TILE_SIZE / 2) / TILE_SIZE * 2,
            0,
            (guardian.y - MAP_ROWS * TILE_SIZE / 2) / TILE_SIZE * 2
          ]}
          alert={guardian.alert}
          rotationY={guardian.rotationY}
        />
      ))}
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

export const GameCanvas3D = forwardRef<any, GameCanvasProps>(({
  isActive, onGameStateChange, onMemoryCollected, playerName, onPlayerNameLoaded, muted, onTimerUpdate, onTimerActive, onLevelChange, mobileDirection = { up: false, down: false, left: false, right: false }, difficulty, mind, mazeId, onScoreUpdate, gameSettings, onSettingsChange,
  onPlayerPositionUpdate, onPlayerLookRotationUpdate, texturePath, thirdPerson, onToggleThirdPerson,
}, ref) => {
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [roomShift, setRoomShift] = useState({ x: 0, y: 0, intensity: 0 });
  const [player, setPlayer] = useState({ x: 100, y: 100, size: 20, rotationY: 0 ,lookRotationY: 0}); 
  const [playerMovement, setPlayerMovement] = useState({ isMoving: false, isRunningFast: false });
  //const [thirdPerson, setThirdPerson] = useState(true);
  const sprintingRef = useRef(false);
  const keysPressed = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const [memoryOrbs, setMemoryOrbs] = useState<{ x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [powerUps, setPowerUps] = useState<SpawnedPowerUp[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [currentMazeLayout, setCurrentMazeLayout] = useState<number[][]>([]);
  const cameraRotationRef = useRef({ x: 0, y: 0 }); 
  const [isLoading, setIsLoading] = useState(false);
  const soundsRef = useRef<{ orbCollect: Howl; guardianAlert: Howl; gameOver: Howl; victory: Howl; background: Howl;footsteps:Howl; running: Howl;} | null>(null);
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
      powerUpChance: diffConfig.powerUpChance
    }; 
  };

  const checkCollision = useCallback((x: number, y: number, radius: number = 15) => {
    const currentMap = getCurrentRoomLayout();
    
    const checkPoints = [
      [x - radius, y - radius],
      [x + radius, y - radius],
      [x - radius, y + radius],
      [x + radius, y + radius],
      [x, y - radius], // Center top
      [x, y + radius], // Center bottom
      [x - radius, y], // Center left
      [x + radius, y], // Center right
    ];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        checkPoints.push([x - radius + 2 * radius * frac, y - radius]); // Top edge
        checkPoints.push([x - radius + 2 * radius * frac, y + radius]); // Bottom edge
        checkPoints.push([x - radius, y - radius + 2 * radius * frac]); // Left edge
        checkPoints.push([x + radius, y - radius + 2 * radius * frac]); // Right edge
    }
    return checkPoints.some(([px, py]) => {
      const col = Math.floor(px / TILE_SIZE);
      const row = Math.floor(py / TILE_SIZE);
      
      if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) {
        return true; // Out of bounds is a collision
      }
      
      return currentMap[row] && currentMap[row][col] === 1;// Collision with a wall
    });
  }, [getCurrentRoomLayout]);

  const getRandomSafePosition = useCallback(() => { 
    const currentMap = getCurrentRoomLayout(); 
    let pos: {x:number;y:number}|undefined; 
    let attempts = 0; 
    const minSpawnDistance = commonConfig.safeDistance || 100;
    do { 
      const randCol = Math.floor(Math.random() * MAP_COLS); 
      const randRow = Math.floor(Math.random() * MAP_ROWS); 
      const x = randCol * TILE_SIZE + TILE_SIZE / 2;
      const y = randRow * TILE_SIZE + TILE_SIZE / 2;
      
      if (currentMap[randRow] && currentMap[randRow][randCol] === 0 && !checkCollision(x, y, commonConfig.playerRadius)) {
        pos = { x, y }; 
      }
      attempts++; 
    } while (!pos && attempts < 200); 
    return pos || { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 };
  }, [getCurrentRoomLayout, checkCollision]);

  const handleOrbClick = useCallback((orbIndex: number) => {
    const orb = memoryOrbs[orbIndex];
    if (!orb || orb.collected) return;
    
    // Orb/player positions are in game units (e.g., player.x and orb.x)
    // The positions passed to MemoryOrb component are world units, scaled by 2/TILE_SIZE
    // So the distance check here should be based on game units
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < commonConfig.playerRadius + (TILE_SIZE / 4)) { // Adjust collection range, e.g., player radius + quarter tile
      const newOrbs = [...memoryOrbs];
      newOrbs[orbIndex] = { ...orb, collected: true, collectingTime: Date.now() };
      setMemoryOrbs(newOrbs);
      const newScore = score + 1;
      setScore(newScore);
      onScoreUpdate?.(newScore);
      setRoomShift({ x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5, intensity: 1 });
      setTimeout(() => setRoomShift(prev => ({ ...prev, intensity: 0 })), 300);
      if (soundsRef.current && !muted) soundsRef.current.orbCollect.play();
    }
  }, [memoryOrbs, player, score, muted, onMemoryCollected, onScoreUpdate, commonConfig.playerRadius, TILE_SIZE]);

  const handlePowerUpClick = useCallback((powerUpIndex: number) => {
    const pUp = powerUps[powerUpIndex];
    if (!pUp || pUp.collected) return;

    const dx = player.x - pUp.x;
    const dy = player.y - pUp.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < commonConfig.playerRadius + (TILE_SIZE / 4)) { // Adjust collection range
      const newPowerUps = [...powerUps];
      newPowerUps[powerUpIndex] = { ...pUp, collected: true };
      setPowerUps(newPowerUps);
      console.log(`Power-up collected: ${pUp.type}`);

      let newScore = score;
      if (pUp.type === PowerUpType.Timer) {
        setTimeRemaining(prev => prev + commonConfig.powerUpEffects.timerBoost);
        newScore += commonConfig.powerUpEffects.timerScoreBonus;
      } else {
        const duration =  10;
        setActivePowerUps(prev => [
          ...prev,
          { type: pUp.type, duration: duration, maxDuration: duration }
        ]);
        newScore += commonConfig.powerUpEffects.otherPowerUpScoreBonus;
      }
      setScore(newScore);
      onScoreUpdate?.(newScore);
      if (soundsRef.current && !muted) soundsRef.current.orbCollect.play(); // Reuse orb collect sound for power-ups
    }
  }, [powerUps, player, muted, commonConfig, setTimeRemaining, setActivePowerUps, score, onScoreUpdate, TILE_SIZE]);

  useEffect(() => { 
    soundsRef.current = { 
      orbCollect: new Howl({ src: [orbCollect], volume: 0.5 }), 
      guardianAlert: new Howl({ src: [guardianAlert], volume: 0.6 }), 
      gameOver: new Howl({ src: [gameOver], volume: 0.7 }), 
      victory: new Howl({ src: [victory], volume: 0.7 }), 
      background: new Howl({ src: [backgroundMusic], loop: true, volume: 0.3 }),
      footsteps: new Howl({ src: [footsteps], volume: 0.4, loop: true }),
      running: new Howl({ src: [runningSound], volume: 0.3, loop: true }), // Running sound
    }; 
    return () => { if (soundsRef.current) Object.values(soundsRef.current).forEach(sound => sound.unload()); }; 
  }, []);
  // Background Music Playback Control
  useEffect(() => {
    if (soundsRef.current) {
        if (isActive && gameState === 'playing' && !muted) {
            if (!soundsRef.current.background.playing()) {
                soundsRef.current.background.play();
            }
        } else {
            if (soundsRef.current.background.playing()) {
                soundsRef.current.background.stop();
            }
        }
    }
  }, [isActive, gameState, muted]);


  const resetGameState = useCallback(async (level: number = 1) => { 
    setIsLoading(true);
    setIsSpawningComplete(false);
    setActivePowerUps([]);
    const config = getLevelConfig(level);
    const spawnedPositions: {x: number, y: number}[] = [];
    const minSpawnDistance = commonConfig.safeDistance || 100;
    const getUniqueSafePosition = () => {
      let newPos;
      let attempts = 0;
      do {
        newPos = getRandomSafePosition();
        attempts++;
        if (attempts > 300) {
          console.log("Could not find a unique safe position for an item after many attempts.");
          break;
        }
      } while (spawnedPositions.some(p => {
        const dx = newPos.x - p.x; 
        const dy = newPos.y - p.y; 
        return Math.sqrt(dx*dx + dy*dy) < minSpawnDistance;
      }));
      spawnedPositions.push(newPos);
      return newPos;
    };

    console.log("Spawning player...");
    const newPlayerPos = await getUniqueSafePosition();
    setPlayer({ ...newPlayerPos, size: 20, rotationY: 0, lookRotationY: 0 }); 

    console.log("Spawning memory orbs...");
    const newOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[] = []; 
    for (let i = 0; i < config.orbs; i++) { 
      console.log(`Spawning orb ${i + 1}/${config.orbs}...`);
      const orbPos = await getUniqueSafePosition();
      newOrbs.push({ ...orbPos, collected: false, pulse: Math.random() * Math.PI * 2, collectingTime: 0 }); 
    } 
    setMemoryOrbs(newOrbs); 

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

    console.log("Spawning power-ups...");
    const newPowerUps: SpawnedPowerUp[] = [];
    if (Math.random() < config.powerUpChance) {
      const powerUpTypes = Object.values(PowerUpType);
      const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
      const powerUpPos = await getUniqueSafePosition();
      newPowerUps.push({ ...powerUpPos, type: randomType, collected: false });
    }
    setPowerUps(newPowerUps);

    timerStarted.current = true; 
    const t = config.timer;
    setTimeRemaining(t); 
    onTimerUpdate?.(t);
    onTimerActive?.(true);
    setCurrentLevel(level); 
    onLevelChange?.(level);
    setGameState('playing'); 
    onGameStateChange('playing'); 
    
    setTimeout(() => {
      setIsSpawningComplete(true);
      setIsLoading(false);
      console.log("Level spawning complete!");
    }, 500);
  }, [getLevelConfig, getRandomSafePosition, onGameStateChange, onTimerActive, onTimerUpdate, onLevelChange, commonConfig.safeDistance]);

  useEffect(() => {
    const collectedOrbs = memoryOrbs.filter(orb => orb.collected).length;
    const totalOrbs = memoryOrbs.length;
    
    if (totalOrbs > 0 && collectedOrbs === totalOrbs && gameState === 'playing' && isSpawningComplete) {
      if (currentLevel < commonConfig.MAX_LEVELS) {               
        setTimeout(() => {
          const nextLevel = currentLevel + 1;
          setCurrentLevel(nextLevel);
          onLevelChange?.(nextLevel);
          resetGameState(nextLevel);
        }, 2000);
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
    useThunder: () => {
        const thunderIndex = activePowerUps.findIndex(p => p.type === PowerUpType.Thunder);
        if (thunderIndex !== -1) {
          setGuardians([]); // Clear all guardians when thunder is used
          setActivePowerUps(prev => prev.filter((_, i) => i !== thunderIndex));
          console.log("⚡ Thunder activated!");
        }
      },
    getMazeLayout: () => getCurrentRoomLayout(),
    getPlayerPosition: () => ({ x: player.x, y: player.y }),
    getOrbs: () => memoryOrbs,
    getGuardians: () => guardians,
    getPowerUps: () => powerUps,
    getPlayerLookRotation: () => player.lookRotationY 
  }));

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
        onToggleThirdPerson(!thirdPerson); // Toggle the value
      }
      if (key === ' ') {
        // directly trigger thunder from inside component
        const thunderIndex = activePowerUps.findIndex(p => p.type === PowerUpType.Thunder);
        if (thunderIndex !== -1) {
          setGuardians([]); // Clear all guardians
          setActivePowerUps(prev => prev.filter((_, i) => i !== thunderIndex));
          console.log("⚡ Thunder activated!");
        }}
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
  }, [isActive, gameState, onGameStateChange,thirdPerson, onToggleThirdPerson]);

  useEffect(() => {
    if (!isActive || gameState !== 'playing') return;
    const moveInterval = setInterval(() => {
      const keys = keysPressed.current;
      const isMovingNow = keys.w || keys.a || keys.s || keys.d;
       // Determine player speed based on sprinting and speed power-up
       const hasSpeedBoost = activePowerUps.some(p => p.type === PowerUpType.Speed && p.duration > 0);
       let currentSpeed = commonConfig.playerBaseSpeed;
       if (sprintingRef.current) {
           currentSpeed *= commonConfig.playerSprintMultiplier;
       }
       if (hasSpeedBoost) {
           currentSpeed *= commonConfig.powerUpEffects.speedBoostMultiplier;
       }
       const speed = currentSpeed;
      setPlayerMovement({ isMoving: isMovingNow, isRunningFast: sprintingRef.current && isMovingNow });
  
      // Handle footsteps/running sound
      if (isMovingNow) {
        if (sprintingRef.current) {
          if (!soundsRef.current?.running.playing() && !muted) {
            soundsRef.current?.footsteps.stop();
            soundsRef.current?.running.play();
          }
        } else {
          if (!soundsRef.current?.footsteps.playing() && !muted) {
            soundsRef.current?.running.stop();
            soundsRef.current?.footsteps.play();
          }
        }
      } else {
        soundsRef.current?.footsteps.stop();
        soundsRef.current?.running.stop();
      }

      setPlayer(prevPlayer => {
        const cameraYaw = cameraRotationRef.current.y;
        const updatedPlayer = { ...prevPlayer, lookRotationY: cameraYaw };
        if (isMovingNow) {
          let deltaX = 0;
          let deltaZ = 0; 
          const playerRadius = commonConfig.playerRadius || 15; // Default radius if not defined
          
          const forward = { x: -Math.sin(cameraYaw), z: -Math.cos(cameraYaw) };
          const right = { x: Math.cos(cameraYaw), z: -Math.sin(cameraYaw) };
          
          if (thirdPerson) {
            // Inverted controls for third-person view
            if (keys.s) { // S moves forward
              deltaX += forward.x * speed;
              deltaZ += forward.z * speed;
            }
            if (keys.w) { // W moves backward
              deltaX -= forward.x * speed;
              deltaZ -= forward.z * speed;
            }
            if (keys.d) { // D moves left
              deltaX -= right.x * speed;
              deltaZ -= right.z * speed;
            }
            if (keys.a) { // A moves right
              deltaX += right.x * speed;
              deltaZ += right.z * speed;
            }
          } else {
            // Normal controls for first-person view
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

      powerUps.forEach((pUp, index) => {
        if (!pUp.collected) {
          const dx = player.x - pUp.x;
          const dy = player.y - pUp.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 40) {
            handlePowerUpClick(index);
          }
        }
      });

    }, 16);
    return () => clearInterval(moveInterval);
  }, [isActive, gameState, memoryOrbs, powerUps, player, handleOrbClick, handlePowerUpClick, checkCollision, cameraRotationRef, onPlayerPositionUpdate, onPlayerLookRotationUpdate, thirdPerson]); 

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
        const isAlert = distance < commonConfig.guardianAlertRadius;

        let newX = guardian.x;
        let newY = guardian.y;
        const guardianRadius = commonConfig.guardianRadius;
        let newDirectionX = guardian.directionX;
        let newDirectionY = guardian.directionY;
        let angle = guardian.rotationY;
        let stuckCounter = guardian.stuckCounter;

        if (isAlert) {
          const chaseSpeed = config.guardSpeed * 1.5;
          angle = Math.atan2(dx, dy); 
          
          const chaseX = Math.cos(angle) * chaseSpeed;
          const chaseY = Math.sin(angle) * chaseSpeed;
          
          if (!checkCollision(newX + chaseX, newY + chaseY, guardianRadius)) {
            newX += chaseX;
            newY += chaseY;
            stuckCounter = 0;
          } else {
            const alternatives = [
              { x: Math.sin(angle + Math.PI/6) * chaseSpeed, y: Math.cos(angle + Math.PI/6) * chaseSpeed },
              { x: Math.sin(angle - Math.PI/6) * chaseSpeed, y: Math.cos(angle - Math.PI/6) * chaseSpeed },
              { x: Math.sin(angle + Math.PI/2) * chaseSpeed * 0.5, y: Math.cos(angle + Math.PI/2) * chaseSpeed * 0.5 },
              { x: Math.sin(angle - Math.PI/2) * chaseSpeed * 0.5, y: Math.cos(angle - Math.PI/2) * chaseSpeed * 0.5 }
            ];
            
            let moved = false;
            for (const alt of alternatives) {
              if (!checkCollision(newX + alt.x, newY + alt.y, guardianRadius)) {
                newX += alt.x;
                newY += alt.y;
                angle = Math.atan2(alt.x, alt.y);
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
          const patrolSpeed = config.guardSpeed * 0.6;
          
          const timeSinceLastChange = currentTime - guardian.lastDirectionChange;
          const shouldChangeDirection = stuckCounter > 2 || timeSinceLastChange > 2500 + Math.random() * 2000;
          
          const potentialX = newX + newDirectionX * patrolSpeed;
          const potentialY = newY + newDirectionY * patrolSpeed;
          
          const willCollide = checkCollision(potentialX, potentialY, guardianRadius);
          
          if (willCollide || shouldChangeDirection) {
            const directions = [
              { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, // Cardinal
              { x: 0.707, y: 0.707 }, { x: -0.707, y: 0.707 }, { x: 0.707, y: -0.707 }, { x: -0.707, y: -0.707 } // Diagonal
            ];
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
                  newDirectionX = -guardian.directionX;
                  newDirectionY = -guardian.directionY;
                  guardian.lastDirectionChange = currentTime;
                  stuckCounter++;
              }
            }
          }
          
          const moveX = newDirectionX * patrolSpeed;
          const moveY = newDirectionY * patrolSpeed;
          
          if (!checkCollision(newX + moveX, newY + moveY, guardianRadius)) {
            newX += moveX;
            newY += moveY;
            angle = Math.atan2(newDirectionX, newDirectionY);
            stuckCounter = Math.max(0, stuckCounter - 1);
          } else {
            stuckCounter++;
          }
        }

        if (stuckCounter > 5) {
          console.warn(`Guardian ${JSON.stringify(guardian)} stuck, teleporting.`);
          const safePos = getRandomSafePosition();
          newX = safePos.x;
          newY = safePos.y;
          stuckCounter = 0;
          guardian.lastDirectionChange = currentTime;
        }

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
    }, 100);
    return () => clearInterval(guardianInterval);
  }, [isActive, gameState, getCurrentRoomLayout, player, currentLevel, getLevelConfig, onGameStateChange, muted, playerName, timeRemaining, difficulty, score, mind, checkCollision, getRandomSafePosition]);

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

  useEffect(() => {
    const collectedOrbs = memoryOrbs.filter(orb => orb.collected).length;
    const totalOrbs = memoryOrbs.length;
    
    if (totalOrbs > 0 && collectedOrbs === totalOrbs && gameState === 'playing' && isSpawningComplete) {
      if (currentLevel < commonConfig.MAX_LEVELS) {               
        setTimeout(() => {
          const nextLevel = currentLevel + 1;
          setCurrentLevel(nextLevel);
          onLevelChange?.(nextLevel);
          resetGameState(nextLevel);
        }, 7000);
      } else {
        onGameStateChange('victory');
        if (soundsRef.current && !muted) soundsRef.current.victory.play();
        saveScore(playerName, timeRemaining, difficulty, score, mind);
        setGameState('idle'); 
      }
    }
  }, [memoryOrbs, gameState, onGameStateChange, muted, playerName, timeRemaining, difficulty, score, mind, currentLevel, onLevelChange, resetGameState, isSpawningComplete]);

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
          texturePath={texturePath} 
        />
      </Canvas>
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-sm max-w-xs">
        <div className="font-bold mb-2 text-green-400">✅ FIXED Controls:</div>
        <div>{thirdPerson ? 'S: Forward, W: Backward, A: Right, D: Left' : 'WASD: Move (Camera-Relative)'}</div>
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
      {activePowerUps.length > 0 && (
  <div className="absolute top-4 centre-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-sm">
    <div className="font-bold mb-2 text-yellow-400">⚡ Active PowerUps</div>
    {activePowerUps.map((p, i) => (
      <div key={i} className="flex justify-between">
        <span>{p.type}</span>
        <span>{Math.ceil(p.duration)}s</span>
      </div>
    ))}
  </div>
)}
    </div>
  );
});

GameCanvas3D.displayName = 'GameCanvas3D';