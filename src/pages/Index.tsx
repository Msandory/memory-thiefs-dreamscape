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
import { Difficulty, MindType } from '@/config/gameConfig';

type GameState = 'menu' | 'instructions' | 'playing' | 'paused' | 'gameOver' | 'victory';

interface SavedGameState {
  playerName: string;
  // ... other saved state properties
}

const VirtualArrowKeys = ({ onMove, onSpacePress }: { onMove: (dir: { up: boolean, down: boolean, left: boolean, right: boolean }) => void; onSpacePress: () => void }) => {
  const [direction, setDirection] = useState({ up: false, down: false, left: false, right: false });

  // Handle button press (touch start or mouse down)
  const handlePress = (key: keyof typeof direction) => {
    setDirection((prev) => {
      const newDirection = { ...prev, [key]: true };
      onMove(newDirection);
      return newDirection;
    });
  };

  // Handle button release (touch end or mouse up)
  const handleRelease = (key: keyof typeof direction) => {
    setDirection((prev) => {
      const newDirection = { ...prev, [key]: false };
      onMove(newDirection);
      return newDirection;
    });
  };

  return (
    <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 grid grid-cols-4 grid-rows-2 gap-3 w-60 h-36 z-40">
      {/* Up Button */}
      <div className="col-start-2 row-start-1">
        <button
          className="w-14 h-14 bg-slate-400/50 backdrop-blur-sm rounded-lg flex items-center justify-center touch-none text-2xl"
          onTouchStart={() => handlePress('up')}
          onTouchEnd={() => handleRelease('up')}
          onMouseDown={() => handlePress('up')}
          onMouseUp={() => handleRelease('up')}
        >
          ↑
        </button>
      </div>
      {/* Left Button */}
      <div className="col-start-1 row-start-2">
        <button
          className="w-14 h-14 bg-slate-400/50 backdrop-blur-sm rounded-lg flex items-center justify-center touch-none text-2xl"
          onTouchStart={() => handlePress('left')}
          onTouchEnd={() => handleRelease('left')}
          onMouseDown={() => handlePress('left')}
          onMouseUp={() => handleRelease('left')}
        >
          ←
        </button>
      </div>
      {/* Right Button */}
      <div className="col-start-3 row-start-2">
        <button
          className="w-14 h-14 bg-slate-400/50 backdrop-blur-sm rounded-lg flex items-center justify-center touch-none text-2xl"
          onTouchStart={() => handlePress('right')}
          onTouchEnd={() => handleRelease('right')}
          onMouseDown={() => handlePress('right')}
          onMouseUp={() => handleRelease('right')}
        >
          →
        </button>
      </div>
      {/* Down Button */}
      <div className="col-start-2 row-start-2">
        <button
          className="w-14 h-14 bg-slate-400/50 backdrop-blur-sm rounded-lg flex items-center justify-center touch-none text-2xl"
          onTouchStart={() => handlePress('down')}
          onTouchEnd={() => handleRelease('down')}
          onMouseDown={() => handlePress('down')}
          onMouseUp={() => handleRelease('down')}
        >
          ↓
        </button>
      </div>
      {/* Space Button */}
      <div className="col-start-4 row-start-1 row-span-2">
        <button
          className="w-14 h-[116px] bg-slate-400/50 backdrop-blur-sm rounded-lg flex items-center justify-center touch-none text-xl"
          onTouchStart={onSpacePress}
          onTouchEnd={(e) => e.preventDefault()} // Prevent default to avoid scrolling
          onMouseDown={onSpacePress}
          onMouseUp={(e) => e.preventDefault()}
        >
          SPACE
        </button>
      </div>
    </div>
  );
};

const Index = () => {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [memoriesCollected, setMemoriesCollected] = useState(0);
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [gameMessage, setGameMessage] = useState("Enter the memory palace and begin your theft...");
  const [muted, setMuted] = useState(() => JSON.parse(localStorage.getItem('muted') || 'false'));
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDirection, setMobileDirection] = useState({ up: false, down: false, left: false, right: false });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [selectedMind, setSelectedMind] = useState<MindType>('scholar');
  const [selectedMazeId, setSelectedMazeId] = useState('scholar_medium_1');

  const gameCanvasRef = useRef<{ reset: () => void; retry: () => void; useThunder: () => void }>(null);
  const backgroundMusicRef = useRef<Howl | null>(null);
  
  useEffect(() => { setIsMobile(/Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768); }, []);

  useEffect(() => {
    backgroundMusicRef.current = new Howl({ src: [backgroundMusic], loop: true, volume: 0.3 });
    return () => { backgroundMusicRef.current?.unload(); };
  }, []);

  useEffect(() => {
    if (backgroundMusicRef.current) {
      if ((gameState === 'menu' || gameState === 'instructions') && !muted) {
        if (!backgroundMusicRef.current.playing()) backgroundMusicRef.current.play();
      } else {
        backgroundMusicRef.current.stop();
      }
    }
  }, [gameState, muted]);

  useEffect(() => { localStorage.setItem('muted', JSON.stringify(muted)); }, [muted]);
  useEffect(() => { localStorage.setItem('playerName', playerName); }, [playerName]);

  const handleStartGame = useCallback((name: string, selectedDifficulty: Difficulty, mind: MindType, mazeId: string) => {
    setPlayerName(name);
    setDifficulty(selectedDifficulty);
    setSelectedMind(mind);
    setSelectedMazeId(mazeId);
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    setCurrentLevel(1);
    setTimeRemaining(0);
    setTimerActive(false);
    setGameMessage(`${name}, you feel the ancient presence...`);
    gameCanvasRef.current?.reset();
  }, []);

  const handleGameStateChange = useCallback((state: 'playing' | 'paused' | 'gameOver' | 'victory') => {
    setGameState(state);
    if (state === 'gameOver') { setGameMessage("The guardians have sensed your presence!"); setTimerActive(false);  } 
    else if (state === 'victory') { setGameMessage("You have successfully stolen all the memories!"); setTimerActive(false); toast.success("Victory!"); }
    else if (state === 'paused') { setGameMessage("The palace waits in silence..."); }
    else if (state === 'playing') { setGameMessage(`${playerName}, you feel the ancient presence...`); }
  }, [playerName]);
  
  const handleMemoryCollected = useCallback(() => {
    const newCount = memoriesCollected + 1;
    const newScore = score + 100;
    setMemoriesCollected(newCount);
    setScore(newScore);
  }, [memoriesCollected, score]);
  
  const handleRestart = useCallback(() => {
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    gameCanvasRef.current?.reset();
  }, [playerName]);

  const handleRetry = useCallback(() => {
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(prev => Math.floor(prev / 2));
    gameCanvasRef.current?.retry();
  }, [playerName]);

  const handleMainMenu = useCallback(() => { setGameState('menu'); }, []);
  const handleClearPlayerName = useCallback(() => { setPlayerName(''); localStorage.removeItem('playerName'); }, []);
  const handleTogglePlay = useCallback(() => { setGameState(prev => prev === 'playing' ? 'paused' : 'playing'); }, []);
  const handleToggleMute = useCallback(() => setMuted(prev => !prev), []);
  const handlePlayerNameLoaded = useCallback((name: string) => { if (name && name !== playerName) setPlayerName(name); }, [playerName]);
  const handleTimerUpdate = useCallback((time: number) => setTimeRemaining(time), []);
  const handleTimerActive = useCallback((isActive: boolean) => setTimerActive(isActive), []);
  const handleLevelChange = useCallback((level: number) => setCurrentLevel(level), []);

  // NEW: Callback to trigger useThunder from GameCanvas
  const handleSpacePress = useCallback(() => {
    if (gameCanvasRef.current?.useThunder) {
      gameCanvasRef.current.useThunder();
    }
  }, []);

  return (
    <div className="min-h-screen w-screen h-screen relative overflow-hidden bg-background">
      {gameState === 'menu' && (
        <MainMenu onStartGame={handleStartGame} onShowInstructions={() => setGameState('instructions')} muted={muted} savedPlayerName={playerName} onClearPlayerName={handleClearPlayerName} />
      )}

      {gameState === 'instructions' && (
        <InstructionsScreen onBack={() => setGameState('menu')} muted={muted} />
      )}
      
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameOver' || gameState === 'victory') && (
        <div className="w-full h-full flex items-center justify-center p-1 sm:p-4">
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
              difficulty={difficulty}
              mind={selectedMind}
              mazeId={selectedMazeId}
              onScoreUpdate={setScore}
            />
            <GameHUD
              memoriesCollected={memoriesCollected}
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
              totalMemories={2 + (currentLevel - 1)}
            />
            {gameState === 'paused' && (
              <PauseMenu onResume={() => setGameState('playing')} onRestart={handleRestart} onMainMenu={handleMainMenu} muted={muted} />
            )}
            {(gameState === 'gameOver' || gameState === 'victory') && (
              <GameOverScreen 
                isVictory={gameState === 'victory'} 
                memoriesCollected={memoriesCollected} 
                totalMemories={0}
                playerName={playerName} 
                onRetry={handleRetry}
                onMainMenu={handleMainMenu} 
                muted={muted} 
              />
            )}
          </div>
          {isMobile && gameState === 'playing' && (
            <VirtualArrowKeys onMove={setMobileDirection} onSpacePress={handleSpacePress} />
          )}
        </div>
      )}
    </div>
  );
};

export default Index;