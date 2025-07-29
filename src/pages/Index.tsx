import { useState } from "react";
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
  
  const totalMemories = 5;

  const handleStartGame = (name: string) => {
    setPlayerName(name);
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    setGameMessage(`${name}, you feel the ancient presence of forgotten memories...`);
    toast("The memory palace awakens...", { 
      description: "Use WASD or Arrow Keys to move" 
    });
  };

  const handleGameStateChange = (state: 'playing' | 'paused' | 'gameOver' | 'victory') => {
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
  };

  const handleMemoryCollected = () => {
    const newCount = memoriesCollected + 1;
    const newScore = score + 1;
    setMemoriesCollected(newCount);
    setScore(newScore);
    setGameMessage(`A memory whispers its secrets... (${newCount}/${totalMemories})`);
    toast(`Memory collected! (${newCount}/${totalMemories})`, {
      description: "The orb dissolves into your consciousness"
    });
  };

  const handleRestart = () => {
    setGameState('playing');
    setMemoriesCollected(0);
    setScore(0);
    setGameMessage("The palace resets, memories await once more...");
  };

  const handleMainMenu = () => {
    setGameState('menu');
    setMemoriesCollected(0);
    setScore(0);
    setGameMessage("Enter the memory palace and begin your theft...");
  };

  const handleTogglePlay = () => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {gameState === 'menu' && (
        <MainMenu 
          onStartGame={handleStartGame}
          onShowInstructions={() => setGameState('instructions')}
        />
      )}

      {gameState === 'instructions' && (
        <InstructionsScreen onBack={() => setGameState('menu')} />
      )}

      {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameOver' || gameState === 'victory') && (
        <div className="relative">
          <GameCanvas
            isActive={gameState === 'playing'}
            onGameStateChange={handleGameStateChange}
            memoriesCollected={memoriesCollected}
            onMemoryCollected={handleMemoryCollected}
          />
          
          <GameHUD
            memoriesCollected={memoriesCollected}
            totalMemories={totalMemories}
            score={score}
            playerName={playerName}
            gameMessage={gameMessage}
            isPlaying={gameState === 'playing'}
            onTogglePlay={handleTogglePlay}
          />

          {gameState === 'paused' && (
            <PauseMenu
              onResume={() => setGameState('playing')}
              onRestart={handleRestart}
              onMainMenu={handleMainMenu}
            />
          )}

          {(gameState === 'gameOver' || gameState === 'victory') && (
            <GameOverScreen
              isVictory={gameState === 'victory'}
              memoriesCollected={memoriesCollected}
              totalMemories={totalMemories}
              onRestart={handleRestart}
              onMainMenu={handleMainMenu}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Index;
