import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Howl } from "howler";
// Optional: Import audio files if required by your build tool
 import orbCollect from '@/assets/audio/orb-collect.mp3';
 import guardianAlert from '@/assets/audio/guardian-alert.mp3';
 import gameOver from '@/assets/audio/game-over.mp3';
 import victory from '@/assets/audio/victory.mp3';
 import backgroundMusic from '@/assets/audio/background-music.mp3';

interface GameCanvasProps {
  isActive: boolean;
  onGameStateChange: (state: 'playing' | 'paused' | 'gameOver' | 'victory') => void;
  memoriesCollected: number;
  onMemoryCollected: () => void;
  playerName: string;
  onPlayerNameLoaded: (name: string) => void;
  muted: boolean;
}

interface Guardian {
  x: number;
  y: number;
  direction: number;
  patrol: { start: number; end: number };
  alert: boolean;
}

interface SavedGameState {
  player: { x: number; y: number; size: number };
  memoryOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[];
  guardians: Guardian[];
  memoriesCollected: number;
  playerName: string;
}

export const GameCanvas = forwardRef(({
  isActive,
  onGameStateChange,
  memoriesCollected,
  onMemoryCollected,
  playerName,
  onPlayerNameLoaded,
  muted
}: GameCanvasProps, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const soundsRef = useRef<{
    orbCollect: Howl;
    guardianAlert: Howl;
    gameOver: Howl;
    victory: Howl;
    background: Howl;
  } | null>(null);

  // Initialize default state
  const defaultOrbs = [
    { x: 200, y: 150, collected: false, pulse: 0, collectingTime: 0 },
    { x: 600, y: 200, collected: false, pulse: 0, collectingTime: 0 },
    { x: 300, y: 450, collected: false, pulse: 0, collectingTime: 0 },
    { x: 700, y: 400, collected: false, pulse: 0, collectingTime: 0 },
    { x: 150, y: 500, collected: false, pulse: 0, collectingTime: 0 },
  ];
  const defaultGuardians = [
    { x: 500, y: 100, direction: 1, patrol: { start: 450, end: 550 }, alert: false },
    { x: 250, y: 350, direction: 1, patrol: { start: 200, end: 400 }, alert: false },
  ];
  const defaultPlayer = { x: 400, y: 300, size: 20 };
  const defaultPlayerName = playerName || "Player";

  // Load saved state from localStorage, if available
  const savedState = localStorage.getItem('gameState');
  const initialState: SavedGameState = savedState
    ? JSON.parse(savedState)
    : {
        player: defaultPlayer,
        memoryOrbs: defaultOrbs,
        guardians: defaultGuardians,
        memoriesCollected: 0,
        playerName: defaultPlayerName,
      };

  const player = useRef(initialState.player);
  const memoryOrbs = useRef(initialState.memoryOrbs);
  const guardians = useRef<Guardian[]>(initialState.guardians);
  const previousMemoryCount = useRef(initialState.memoriesCollected);
  const alertedGuardians = useRef<Set<number>>(new Set());

  // Initialize sounds with error handling
  useEffect(() => {
    soundsRef.current = {
      orbCollect: new Howl({
        src: [orbCollect], // or [orbCollect] if imported
        volume: 0.5,
        onloaderror: (id, error) => console.error('Failed to load orb-collect.mp3:', error),
      }),
      guardianAlert: new Howl({
        //src: ['/assets/audio/guardian-alert.mp3'], // or [guardianAlert]
        src:  [guardianAlert],
        volume: 0.6,
        onloaderror: (id, error) => console.error('Failed to load guardian-alert.mp3:', error),
      }),
      gameOver: new Howl({
        src: [gameOver], // or [gameOver]
        volume: 0.7,
        onloaderror: (id, error) => console.error('Failed to load game-over.mp3:', error),
      }),
      victory: new Howl({
        src: [victory], // or [victory]
        volume: 0.7,
        onloaderror: (id, error) => console.error('Failed to load victory.mp3:', error),
      }),
      background: new Howl({
        src: [backgroundMusic], // or [backgroundMusic]
        loop: true,
        volume: 0.3,
        onloaderror: (id, error) => console.error('Failed to load background-music.mp3:', error),
      }),
    };

    // Play background music if not muted
    if (!muted) {
      soundsRef.current.background.play();
    }

    // Cleanup sounds on unmount
    return () => {
      if (soundsRef.current) {
        Object.values(soundsRef.current).forEach(sound => sound.unload());
        soundsRef.current = null;
      }
    };
  }, []);

  // Handle mute state changes
  useEffect(() => {
    if (soundsRef.current) {
      if (muted) {
        soundsRef.current.background.pause();
      } else {
        soundsRef.current.background.play();
      }
    }
  }, [muted]);

  // Notify parent of loaded playerName
  useEffect(() => {
    onPlayerNameLoaded(initialState.playerName);
  }, [onPlayerNameLoaded]);

  // Function to save game state to localStorage
  const saveGameState = () => {
    const state: SavedGameState = {
      player: { ...player.current },
      memoryOrbs: memoryOrbs.current.map(orb => ({ ...orb })),
      guardians: guardians.current.map(guard => ({ ...guard })),
      memoriesCollected: memoryOrbs.current.filter(orb => orb.collected).length,
      playerName,
    };
    localStorage.setItem('gameState', JSON.stringify(state));
  };

  // Function to reset game state
  const resetGameState = () => {
    player.current = { ...defaultPlayer };
    memoryOrbs.current = defaultOrbs.map(orb => ({ ...orb }));
    guardians.current = defaultGuardians.map(guard => ({ ...guard }));
    previousMemoryCount.current = 0;
    alertedGuardians.current.clear();
    localStorage.removeItem('gameState');
    onGameStateChange('playing');
    // Restart background music if not muted
    if (soundsRef.current && !muted) {
      soundsRef.current.background.stop().play();
    }
  };

  // Expose resetGameState to parent via ref
  useImperativeHandle(ref, () => ({
    reset: resetGameState,
  }));

  useEffect(() => {
    if (!canvasRef.current || !isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;

    let animationId: number;
    let roomShift = { x: 0, y: 0, intensity: 0 };

    const keys: { [key: string]: boolean } = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape') {
        onGameStateChange('paused');
      }
      if (e.key.toLowerCase() === 'r') {
        resetGameState();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const render = () => {
      if (!ctx) return;

      const orbs = memoryOrbs.current;
      const guards = guardians.current;

      const currentMemoryCount = orbs.filter(orb => orb.collected).length;
      if (currentMemoryCount > previousMemoryCount.current) {
        roomShift.intensity = 1.0;
        previousMemoryCount.current = currentMemoryCount;

        // Reset guards to patrol state
        guards.forEach(g => {
          g.alert = false;
        });
        alertedGuardians.current.clear();

        // Play orb collect sound
        if (soundsRef.current && !muted) {
          soundsRef.current.orbCollect.play();
        }

        // Save game state after orb collection
        saveGameState();
      }

      if (roomShift.intensity > 0) {
        roomShift.intensity -= 0.02;
        roomShift.x = (Math.random() - 0.5) * roomShift.intensity * 20;
        roomShift.y = (Math.random() - 0.5) * roomShift.intensity * 20;
      }

      ctx.save();
      ctx.translate(roomShift.x, roomShift.y);

      // Clear canvas with dream-like gradient
      const gradient = ctx.createLinearGradient(0, 0, 800, 600);
      gradient.addColorStop(0, 'hsl(225, 25%, 8%)');
      gradient.addColorStop(0.5, 'hsl(270, 40%, 15%)');
      gradient.addColorStop(1, 'hsl(280, 30%, 20%)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 600);

      // Draw visible boundaries
      ctx.strokeStyle = 'hsl(280, 50%, 40%)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(10, 10, 780, 580);
      ctx.setLineDash([]);

      // Add floating mist particles
      ctx.save();
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 20; i++) {
        const x = (Date.now() * 0.01 + i * 50) % 850;
        const y = 100 + Math.sin(Date.now() * 0.001 + i) * 50;
        const radius = 20 + Math.sin(Date.now() * 0.002 + i) * 10;
        
        const mistGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        mistGradient.addColorStop(0, 'hsl(240, 15%, 85%)');
        mistGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = mistGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Update and render memory orbs
      orbs.forEach((orb) => {
        if (orb.collected) return;

        orb.pulse += 0.05;

        const dx = player.current.x - orb.x;
        const dy = player.current.y - orb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < player.current.size && orb.collectingTime === 0) {
          orb.collectingTime = 1;
        }

        if (orb.collectingTime > 0) {
          orb.collectingTime += 0.03;
          if (orb.collectingTime >= 1) {
            orb.collected = true;
            onMemoryCollected();
            return;
          }
        }

        const glowSize = 15 + Math.sin(orb.pulse) * 5;
        const alpha = orb.collectingTime > 0 ? 1 - orb.collectingTime : 1;
        
        // Glow effect
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

      // Update and render guardians
      guards.forEach((guardian, index) => {
        // Check if player is within vision radius (100px)
        const dxToPlayer = player.current.x - guardian.x;
        const dyToPlayer = player.current.y - guardian.y;
        const distanceToPlayer = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer);
        const isPlayerInRange = distanceToPlayer < 100;

        // Set alert state based on player proximity
        const wasAlert = guardian.alert;
        guardian.alert = isPlayerInRange;

        // Play guardian alert sound once per alert transition
        if (!wasAlert && guardian.alert && !alertedGuardians.current.has(index)) {
          alertedGuardians.current.add(index);
          if (soundsRef.current && !muted) {
            soundsRef.current.guardianAlert.play();
          }
        } else if (wasAlert && !guardian.alert) {
          alertedGuardians.current.delete(index);
        }

        // Calculate speed based on collected orbs (increase by 0.5 per orb)
        const collectedCount = orbs.filter(orb => orb.collected).length;
        const baseSpeed = guardian.alert ? 3 : 1.5;
        const speed = baseSpeed + collectedCount * 0.5;

        if (guardian.alert) {
          // Chase player if within vision radius
          if (distanceToPlayer > 5) {
            guardian.x += (dxToPlayer / distanceToPlayer) * speed;
            guardian.y += (dyToPlayer / distanceToPlayer) * speed;

            // Wrap around canvas boundaries when chasing
            if (guardian.x < 10) guardian.x += 780;
            else if (guardian.x > 790) guardian.x -= 780;
            if (guardian.y < 10) guardian.y += 580;
            else if (guardian.y > 590) guardian.y -= 580;
          }
        } else {
          // Normal patrol
          guardian.x += guardian.direction * speed;
          if (guardian.x >= guardian.patrol.end || guardian.x <= guardian.patrol.start) {
            guardian.direction *= -1;
          }
        }

        // Guardian glow
        const guardianGradient = ctx.createRadialGradient(guardian.x, guardian.y, 0, guardian.x, guardian.y, 25);
        guardianGradient.addColorStop(0, 'hsl(340, 60%, 60%)');
        guardianGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = guardianGradient;
        ctx.beginPath();
        ctx.arc(guardian.x, guardian.y, 25, 0, Math.PI * 2);
        ctx.fill();

        // Guardian body
        ctx.fillStyle = 'hsl(340, 60%, 60%)';
        ctx.beginPath();
        ctx.arc(guardian.x, guardian.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Draw guardian vision cone
        const visionRadius = 100;
        const visionGradient = ctx.createRadialGradient(guardian.x, guardian.y, 0, guardian.x, guardian.y, visionRadius);
        visionGradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        visionGradient.addColorStop(1, 'rgba(255, 0, 0, 0.15)');

        ctx.fillStyle = visionGradient;
        ctx.beginPath();
        ctx.arc(guardian.x, guardian.y, visionRadius, 0, Math.PI * 2);
        ctx.fill();

        // Check collision with player (game over condition)
        if (distanceToPlayer < 30) {
          saveGameState();
          onGameStateChange('gameOver');
          if (soundsRef.current && !muted) {
            soundsRef.current.gameOver.play();
          }
        }
      });

      // Handle player movement (respect boundaries)
      const speed = 3;
      if (keys['w'] || keys['arrowup']) player.current.y = Math.max(20 + player.current.size, player.current.y - speed);
      if (keys['s'] || keys['arrowdown']) player.current.y = Math.min(580 - player.current.size, player.current.y + speed);
      if (keys['a'] || keys['arrowleft']) player.current.x = Math.max(20 + player.current.size, player.current.x - speed);
      if (keys['d'] || keys['arrowright']) player.current.x = Math.min(780 - player.current.size, player.current.x + speed);

      // Render player
      const playerGradient = ctx.createRadialGradient(player.current.x, player.current.y, 0, player.current.x, player.current.y, player.current.size);
      playerGradient.addColorStop(0, 'hsl(240, 20%, 95%)');
      playerGradient.addColorStop(1, 'hsl(240, 15%, 70%)');
      
      ctx.fillStyle = playerGradient;
      ctx.beginPath();
      ctx.arc(player.current.x, player.current.y, player.current.size, 0, Math.PI * 2);
      ctx.fill();

      // Check victory condition
      if (currentMemoryCount === orbs.length) {
        saveGameState();
        onGameStateChange('victory');
        if (soundsRef.current && !muted) {
          soundsRef.current.victory.play();
        }
        ctx.restore();
        return;
      }
      // Restore canvas transform
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    setGameState('playing');
    render();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, onGameStateChange, onMemoryCollected, playerName, onPlayerNameLoaded, muted]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <canvas
        ref={canvasRef}
        className="border-2 border-primary/30 rounded-lg shadow-2xl shadow-primary/20 bg-card"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
});

GameCanvas.displayName = 'GameCanvas';