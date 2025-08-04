import { useState, useCallback, useRef, useEffect } from "react";
import { Howl } from "howler";
import { MainMenu } from "@/components/MainMenu";
import { GameCanvas } from "@/components/GameCanvas";
import { GameHUD } from "@/components/GameHUD";
import { PauseMenu } from "@/components/PauseMenu";
import { GameOverScreen } from "@/components/GameOverScreen";
import { InstructionsScreen } from "@/components/InstructionsScreen";
import { toast } from "sonner";
import backgroundMusic from '@/assets/audio/background-music.mp3';
import React from "react";

type GameState = 'menu' | 'instructions' | 'playing' | 'paused' | 'gameOver' | 'victory';

interface SavedGameState {
  playerName: string;
  player: { x: number; y: number; size: number };
  memoryOrbs: { x: number; y: number; collected: boolean; pulse: number; collectingTime: number }[];
  guardians: { x: number; y: number; direction: number; patrol: { start: number; end: number }; alert: boolean }[];
  memoriesCollected: number;
  currentLevel: number;
  timeRemaining: number;
}

// Virtual Joystick component with fixes
const VirtualJoystick = ({ onMove }: { onMove: (dir: { up: boolean, down: boolean, left: boolean, right: boolean }) => void }) => {
  const stickRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number, y: number } | null>(null);
  const touchId = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (touch && baseRef.current) {
      touchId.current = touch.identifier;
      const baseRect = baseRef.current.getBoundingClientRect();
      dragStart.current = {
        x: baseRect.left + baseRect.width / 2,
        y: baseRect.top + baseRect.height / 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragStart.current === null || touchId.current === null) return;

    // FIX: Use Array.find for cleaner and safer touch identification
    const touch = Array.from(e.changedTouches).find(
      (t) => t.identifier === touchId.current
    );

    if (!touch || !stickRef.current || !baseRef.current) return;

    const baseRect = baseRef.current.getBoundingClientRect();
    const maxDistance = baseRect.width / 2 - stickRef.current.offsetWidth / 2;
    
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const stickX = Math.min(maxDistance, distance) * Math.cos(angle);
    const stickY = Math.min(maxDistance, distance) * Math.sin(angle);

    stickRef.current.style.transform = `translate(${stickX}px, ${stickY}px)`;
    
    const deadZone = 0.2;
    const normX = dx / maxDistance;
    const normY = dy / maxDistance;
    
    onMove({
      up: normY < -deadZone,
      down: normY > deadZone,
      left: normX < -deadZone,
      right: normX > deadZone,
    });
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touchEnded = Array.from(e.changedTouches).some(
      (t) => t.identifier === touchId.current
    );

    if (!touchEnded) return;

    dragStart.current = null;
    touchId.current = null;
    if (stickRef.current) {
      stickRef.current.style.transform = `translate(0px, 0px)`;
    }
    onMove({ up: false, down: false, left: false, right: false });
  };
  
  return (
    <div 
      ref={baseRef}
      // FIX: Added z-index (z-40) and made colors more opaque for visibility
      className="fixed bottom-8 left-8 w-32 h-32 bg-slate-400/50 backdrop-blur-sm rounded-full flex items-center justify-center touch-none z-40"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div 
        ref={stickRef}
        // FIX: Made stick more visible
        className="w-16 h-16 bg-slate-200/70 rounded-full pointer-events-none transition-transform duration-75"
      ></div>
    </div>
  );
};


const Index = () => {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [memoriesCollected, setMemoriesCollected] = useState(0);
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [playerName, setPlayerName] = useState(() => {
    const saved = localStorage.getItem('gameState');
    if (saved) {
      const parsed: SavedGameState = JSON.parse(saved);
      return parsed.playerName || '';
    }
    return '';
  });
  const [gameMessage, setGameMessage] = useState("Enter the memory palace and begin your theft...");
  const [muted, setMuted] = useState(() => {
    const saved = localStorage.getItem('muted');
    return saved ? JSON.parse(saved) : false;
  });
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [mobileDirection, setMobileDirection] = useState({ up: false, down: false, left: false, right: false });

  const gameCanvasRef = useRef<{ reset: () => void }>(null);
  const backgroundMusicRef = useRef<Howl | null>(null);
  
  useEffect(() => {
    const checkIsMobile = () => /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    setIsMobile(checkIsMobile());
  }, []);

  useEffect(() => {
    backgroundMusicRef.current = new Howl({
      src: [backgroundMusic],
      loop: true,
      volume: 0.3,
      onloaderror: (id, error) => console.error('Failed to load background-music.mp3:', error),
    });

    if (gameState === 'menu' && !muted) {
      backgroundMusicRef.current.play();
    }

    return () => {
      backgroundMusicRef.current?.unload();
    };
  }, []);

  useEffect(() => {
    if (backgroundMusicRef.current) {
      if ((gameState === 'menu' || gameState === 'instructions') && !muted) {
        if (!backgroundMusicRef.current.playing()) {
          backgroundMusicRef.current.play();
        }
      } else {
        backgroundMusicRef.current.stop();
      }
    }
  }, [gameState, muted]);

  useEffect(() => {
    localStorage.setItem('muted', JSON.stringify(muted));
  }, [muted]);

  const handleStartGame = useCallback((name: string) => {
    setPlayerName(name);
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    setCurrentLevel(1);
    setTimeRemaining(0);
    setTimerActive(false);
    setGameMessage(`${name}, you feel the ancient presence...`);
    toast("The memory palace awakens...", {
      description: isMobile ? "Use the joystick to move." : "Use WASD or Arrow Keys to move.",
    });
    gameCanvasRef.current?.reset();
  }, [isMobile]);

  // ... (all other handler functions remain the same) ...
  const handleGameStateChange = useCallback((state: 'playing' | 'paused' | 'gameOver' | 'victory') => {
    setGameState(state);
    if (state === 'gameOver') { setGameMessage("The guardians have sensed your presence!"); setTimerActive(false); toast.error("You were caught!"); } 
    else if (state === 'victory') { setGameMessage("You have successfully stolen all the memories!"); setTimerActive(false); toast.success("Victory!"); }
    else if (state === 'paused') { setGameMessage("The palace waits in silence..."); }
    else if (state === 'playing') { setGameMessage(`${playerName}, you feel the ancient presence...`); }
  }, [playerName]);
  const handleMemoryCollected = useCallback(() => {
    const newCount = memoriesCollected + 1;
    const newScore = score + 100;
    const totalMemories = 2 + (currentLevel - 1);
    setMemoriesCollected(newCount);
    setScore(newScore);
    setGameMessage(`A memory whispers its secrets... (${newCount}/${totalMemories})`);
    toast(`Memory collected! (${newCount}/${totalMemories})`);
  }, [memoriesCollected, score, currentLevel]);
  const handleRestart = useCallback(() => { setGameState('playing'); setMemoriesCollected(0); setScore(0); setCurrentLevel(1); setGameMessage(`${playerName}, the palace resets...`); gameCanvasRef.current?.reset(); }, [playerName]);
  const handleMainMenu = useCallback(() => { setGameState('menu'); }, []);
  const handleClearPlayerName = useCallback(() => {
    setPlayerName('');
    const saved = localStorage.getItem('gameState');
    if (saved) {
      const parsed: SavedGameState = JSON.parse(saved);
      parsed.playerName = '';
      localStorage.setItem('gameState', JSON.stringify(parsed));
    }
  }, []);
  const handleTogglePlay = useCallback(() => { setGameState(prev => prev === 'playing' ? 'paused' : 'playing'); }, []);
  const handleToggleMute = useCallback(() => setMuted(prev => !prev), []);
  const handlePlayerNameLoaded = useCallback((name: string) => { if (name && name !== playerName) setPlayerName(name); }, [playerName]);
  const handleTimerUpdate = useCallback((time: number) => setTimeRemaining(time), []);
  const handleTimerActive = useCallback((isActive: boolean) => setTimerActive(isActive), []);
  const handleLevelChange = useCallback((level: number) => setCurrentLevel(level), []);

  return (
    <div className="min-h-screen w-screen h-screen relative overflow-hidden bg-background">
      {gameState === 'menu' && (
        <MainMenu onStartGame={handleStartGame} onShowInstructions={() => setGameState('instructions')} muted={muted} savedPlayerName={playerName} onClearPlayerName={handleClearPlayerName} />
      )}

      {gameState === 'instructions' && (
        <InstructionsScreen onBack={() => setGameState('menu')} muted={muted} />
      )}
      
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameOver' || gameState === 'victory') && (
        // FIX: The outer container now centers its child perfectly
        <div className="w-full h-full flex items-center justify-center p-1 sm:p-4">
          {/* 
            FIX: This container is now constrained by height as well as width.
            - `aspect-[4/3]` maintains the shape.
            - `w-full` lets it expand horizontally.
            - `max-h-full` stops it from growing taller than the viewport.
            - `max-w-5xl` is an upper limit for huge screens.
            This combination correctly handles both wide (laptop) and tall (mobile) screens.
          */}
          <div className="relative aspect-[4/3] w-full max-w-5xl max-h-full">
            <GameCanvas
              ref={gameCanvasRef}
              isActive={gameState === 'playing'}
              onGameStateChange={handleGameStateChange}
              memoriesCollected={memoriesCollected}
              onMemoryCollected={handleMemoryCollected}
              playerName={playerName}
              onPlayerNameLoaded={handlePlayerNameLoaded}
              muted={muted}
              onTimerUpdate={handleTimerUpdate}
              onTimerActive={handleTimerActive}
              onLevelChange={handleLevelChange}
              mobileDirection={mobileDirection}
            />
            <GameHUD
              memoriesCollected={memoriesCollected}
              totalMemories={2 + (currentLevel - 1)}
              score={score}
              playerName={playerName}
              gameMessage={gameMessage}
              isPlaying={gameState === 'playing'}
              onTogglePlay={handleTogglePlay}
              muted={muted}
              onToggleMute={handleToggleMute}
              timeRemaining={timeRemaining}
              timerActive={timerActive}
              currentLevel={currentLevel}
            />
            {gameState === 'paused' && (
              <PauseMenu onResume={() => setGameState('playing')} onRestart={handleRestart} onMainMenu={handleMainMenu} muted={muted} />
            )}
            {(gameState === 'gameOver' || gameState === 'victory') && (
              <GameOverScreen isVictory={gameState === 'victory'} memoriesCollected={memoriesCollected} totalMemories={2 + (currentLevel - 1)} playerName={playerName} onRestart={handleRestart} onMainMenu={handleMainMenu} muted={muted} />
            )}
          </div>
          {isMobile && gameState === 'playing' && (
             <VirtualJoystick onMove={setMobileDirection} />
          )}
        </div>
      )}
    </div>
  );
};

export default Index;