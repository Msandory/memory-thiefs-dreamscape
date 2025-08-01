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

  const gameCanvasRef = useRef<{ reset: () => void }>(null);
  const backgroundMusicRef = useRef<Howl | null>(null);

  // Initialize background music
  useEffect(() => {
    backgroundMusicRef.current = new Howl({
      src: [backgroundMusic],
      loop: true,
      volume: 0.3,
      onloaderror: (id, error) => console.error('Failed to load background-music.mp3:', error),
    });

    if (gameState === 'menu' && !muted) {
      console.log('Playing background music on menu');
      backgroundMusicRef.current.play();
    }

    return () => {
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.unload();
        backgroundMusicRef.current = null;
      }
    };
  }, []); // Run only once on mount

  // Handle gameState and muted changes
  useEffect(() => {
    if (backgroundMusicRef.current) {
      if (gameState === 'menu' && !muted) {
        console.log('Resuming background music on menu');
        if (!backgroundMusicRef.current.playing()) {
          backgroundMusicRef.current.play();
        }
      } else {
        console.log('Stopping background music (not on menu or muted)');
        backgroundMusicRef.current.stop();
      }
    }
  }, [gameState, muted]);

  // Persist mute state in localStorage
  useEffect(() => {
    localStorage.setItem('muted', JSON.stringify(muted));
  }, [muted]);

  const handleStartGame = useCallback((name: string) => {
    console.log('handleStartGame called with name:', name);
    setPlayerName(name);
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    setCurrentLevel(1);
    setTimeRemaining(0);
    setTimerActive(false);
    setGameMessage(`${name}, you feel the ancient presence of forgotten memories...`);
    toast("The memory palace awakens...", {
      description: "Use WASD or Arrow Keys to move",
    });
    if (gameCanvasRef.current) {
      gameCanvasRef.current.reset();
    }
  }, []);

  const handleGameStateChange = useCallback((state: 'playing' | 'paused' | 'gameOver' | 'victory') => {
    console.log(`handleGameStateChange called with state: ${state}`);
    setGameState(state);
    if (state === 'gameOver') {
      setGameMessage("The guardians have sensed your presence!");
      setTimerActive(false);
      toast.error("You were caught!", {
        description: "The memory theft has failed",
      });
    } else if (state === 'victory') {
      setGameMessage("You have successfully stolen all the memories!");
      setTimerActive(false);
      toast.success("Victory!", {
        description: "You escaped with all the memories",
      });
    } else if (state === 'paused') {
      setGameMessage("The palace waits in silence...");
    } else if (state === 'playing') {
      setGameMessage(`${playerName}, you feel the ancient presence of forgotten memories...`);
    }
  }, [playerName]);

  const handleMemoryCollected = useCallback(() => {
    const newCount = memoriesCollected + 1;
    const newScore = score + 100;
    setMemoriesCollected(newCount);
    setScore(newScore);
    setGameMessage(`A memory whispers its secrets... (${newCount}/${2 + (currentLevel - 1)})`);
    toast(`Memory collected! (${newCount}/${2 + (currentLevel - 1)})`, {
      description: "The orb dissolves into your consciousness",
    });
  }, [memoriesCollected, score, currentLevel]);

  const handleRestart = useCallback(() => {
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    setCurrentLevel(1);
    setGameMessage(`${playerName}, the palace resets, memories await once more...`);
    if (gameCanvasRef.current) {
      gameCanvasRef.current.reset();
    }
  }, [playerName]);

  const handleMainMenu = useCallback(() => {
    // FIX: Set gameState to 'menu' instead of 'paused'
    setGameState('menu');
    setMemoriesCollected(0);
    setScore(0);
    setCurrentLevel(1);
    setTimeRemaining(0);
    setTimerActive(false);
    setGameMessage("Enter the memory palace and begin your theft...");
    if (gameCanvasRef.current) {
      gameCanvasRef.current.reset();
    }
  }, []);

  // NEW: Add handler for clearing saved player name
  const handleClearPlayerName = useCallback(() => {
    console.log('handleClearPlayerName called');
    setPlayerName('');
    // Also clear from localStorage if needed
    const saved = localStorage.getItem('gameState');
    if (saved) {
      const parsed: SavedGameState = JSON.parse(saved);
      parsed.playerName = '';
      localStorage.setItem('gameState', JSON.stringify(parsed));
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    console.log('handleTogglePlay called, current gameState:', gameState);
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  const handleToggleMute = useCallback(() => {
    console.log('handleToggleMute called');
    setMuted(prev => !prev);
  }, []);

  const handlePlayerNameLoaded = useCallback((name: string) => {
    if (name && name !== playerName) {
      console.log('handlePlayerNameLoaded called with name:', name);
      setPlayerName(name);
    }
  }, [playerName]);

  const handleTimerUpdate = useCallback((time: number) => {
    setTimeRemaining(time);
  }, []);

  const handleTimerActive = useCallback((isActive: boolean) => {
    setTimerActive(isActive);
  }, []);

  const handleLevelChange = useCallback((level: number) => {
    console.log('handleLevelChange called with level:', level);
    setCurrentLevel(level);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {gameState === 'menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          onShowInstructions={() => setGameState('instructions')}
          muted={muted}
          savedPlayerName={playerName}
          onClearPlayerName={handleClearPlayerName} // NEW: Pass the clear function
        />
      )}

      {gameState === 'instructions' && (
        <InstructionsScreen onBack={() => setGameState('menu')} muted={muted} />
      )}

      {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameOver' || gameState === 'victory') && (
        <div className="relative">
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
            <PauseMenu
              onResume={() => setGameState('playing')}
              onRestart={handleRestart}
              onMainMenu={handleMainMenu}
              muted={muted}
            />
          )}
          {(gameState === 'gameOver' || gameState === 'victory') && (
            <GameOverScreen
              isVictory={gameState === 'victory'}
              memoriesCollected={memoriesCollected}
              totalMemories={2 + (currentLevel - 1)}
              playerName={playerName}
              onRestart={handleRestart}
              onMainMenu={handleMainMenu}
              muted={muted}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Index;