import { useState, useCallback, useRef, useEffect } from "react";
import { MainMenu } from "@/components/MainMenu";
import { GameCanvas } from "@/components/GameCanvas";
import { GameHUD } from "@/components/GameHUD";
import { PauseMenu } from "@/components/PauseMenu";
import { GameOverScreen } from "@/components/GameOverScreen";
import { InstructionsScreen } from "@/components/InstructionsScreen";
import { toast } from "sonner";

type GameState = 'menu' | 'instructions' | 'playing' | 'paused' | 'gameOver' | 'victory';

const Index = () => {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [memoriesCollected, setMemoriesCollected] = useState(0);
  const [score, setScore] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [gameMessage, setGameMessage] = useState("Enter the memory palace and begin your theft...");
  const [muted, setMuted] = useState(() => {
    const saved = localStorage.getItem('muted');
    return saved ? JSON.parse(saved) : false;
  });
  const gameCanvasRef = useRef<{ reset: () => void }>(null);

  const totalMemories = 5;

  // Persist mute state in localStorage
  useEffect(() => {
    localStorage.setItem('muted', JSON.stringify(muted));
  }, [muted]);

  const handleStartGame = useCallback((name: string) => {
    setPlayerName(name);
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    setGameMessage(`${name}, you feel the ancient presence of forgotten memories...`);
    toast("The memory palace awakens...", { 
      description: "Use WASD or Arrow Keys to move" 
    });
  }, []);

  const handleGameStateChange = useCallback((state: 'playing' | 'paused' | 'gameOver' | 'victory') => {
    setGameState(state);
    
    if (state === 'gameOver') {
      setGameMessage("The guardians have sensed your presence!");
      toast.error("You were caught!", { 
        description: "The memory theft has failed" 
      });
    } else if (state === 'victory') {
      setGameMessage("You have successfully stolen all the memories!");
      toast.success("Victory!", { 
        description: "You escaped with all the memories" 
      });
    } else if (state === 'paused') {
      setGameMessage("The palace waits in silence...");
    }
  }, []);

  const handleMemoryCollected = useCallback(() => {
    const newCount = memoriesCollected + 1;
    const newScore = score + 100;
    setMemoriesCollected(newCount);
    setScore(newScore);
    setGameMessage(`A memory whispers its secrets... (${newCount}/${totalMemories})`);
    toast(`Memory collected! (${newCount}/${totalMemories})`, {
      description: "The orb dissolves into your consciousness"
    });
  }, [memoriesCollected, score]);

  const handleRestart = useCallback(() => {
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    setGameMessage(`${playerName}, the palace resets, memories await once more...`);
    if (gameCanvasRef.current) {
      gameCanvasRef.current.reset();
    }
  }, [playerName]);

  const handleMainMenu = useCallback(() => {
    setGameState('menu');
    setMemoriesCollected(0);
    setScore(0);
    setGameMessage("Enter the memory palace and begin your theft...");
    if (gameCanvasRef.current) {
      gameCanvasRef.current.reset();
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  const handleToggleMute = useCallback(() => {
    setMuted(prev => !prev);
  }, []);

  const handlePlayerNameLoaded = useCallback((name: string) => {
    if (name && name !== playerName) {
      setPlayerName(name);
    }
  }, [playerName]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {gameState === 'menu' && (
        <MainMenu 
          onStartGame={handleStartGame}
          onShowInstructions={() => setGameState('instructions')}
          muted={muted}
        />
      )}

      {gameState === 'instructions' && (
        <InstructionsScreen onBack={() => setGameState('menu')} />
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
          />
          
          <GameHUD
            memoriesCollected={memoriesCollected}
            totalMemories={totalMemories}
            score={score}
            playerName={playerName}
            gameMessage={gameMessage}
            isPlaying={gameState === 'playing'}
            onTogglePlay={handleTogglePlay}
            muted={muted}
            onToggleMute={handleToggleMute}
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
              totalMemories={totalMemories}
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