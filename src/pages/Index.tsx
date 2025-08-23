import { useState, useCallback, useRef, useEffect } from "react";
import { Howl } from "howler";
import { MainMenu } from "@/components/MainMenu";
import { GameCanvas3D } from "@/components/GameCanvas3D";
import { GameHUD } from "@/components/GameHUD";
import { MinimapContainer } from "@/components/MinimapContainer";
import { PauseMenu } from "@/components/PauseMenu";
import { GameOverScreen } from "@/components/GameOverScreen";
import { InstructionsScreen } from "@/components/InstructionsScreen";
import { MobileControls } from "@/components/MobileControls"; 
import { RotationPrompt } from "@/components/RotationPrompt";
import { Joystick } from 'react-joystick-component';
import { toast } from "sonner";
import backgroundMusic from '@/assets/audio/background-music.mp3';
import React from "react";
import { Difficulty, MindType } from '@/config/gameConfig';
import screenfull from 'screenfull';
type GameState = 'menu' | 'instructions' | 'playing' | 'paused' | 'gameOver' | 'victory';

interface SavedGameState {
  playerName: string;
  // ... other saved state properties
}


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
 // const [mobileDirection, setMobileDirection] = useState({ up: false, down: false, left: false, right: false });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [selectedMind, setSelectedMind] = useState<MindType>('scholar');
  const [selectedMazeId, setSelectedMazeId] = useState('scholar_medium_1');
  const [gameSettings, setGameSettings] = useState({
    mouseSensitivity: 1.0,
    mouseInvert: false
  });
 
  const [selectedTexturePath, setSelectedTexturePath] = useState('');
  const [selectedFloorTexture, setselectedFloorTexture] = useState('');
  const gameCanvasRef = useRef<{ 
    reset: () => void; 
    retry: () => void; 
    useThunder: () => void;
    updateLookRotation: (dx: number | null, dy: number | null) => void;
  }>(null);
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

  const handleStartGame = useCallback((name: string, selectedDifficulty: Difficulty, mind: MindType, mazeId: string,texturePath:string, floorTexture:string) => {
    if (isMobile && screenfull.isEnabled) {
      screenfull.request(); // This makes the entire page go full screen
    }
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
    setSelectedTexturePath(texturePath);
    setselectedFloorTexture(floorTexture);
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
  const [isThirdPerson, setIsThirdPerson] = useState(true); 


  // NEW: Callback to trigger useThunder from GameCanvas
  const handleSpacePress = useCallback(() => {
    if (gameCanvasRef.current?.useThunder) {
      gameCanvasRef.current.useThunder();
    }
  }, []);

  // CHANGE: New handler to toggle the view from mobile controls
  const handleToggleView = useCallback(() => {
    setIsThirdPerson(prev => !prev);
  }, []);

  // CHANGE: Joystick move handler to simulate key presses
  const handleJoystickMove = useCallback((e: any)  => {
    const threshold = 0.3;
    // Simulate W (forward) and S (backward)
    if (e.y !== null) {
      if (e.y > threshold) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      else window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      
      if (e.y < -threshold) window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
      else window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
    }
    // Simulate A (left) and D (right)
    if (e.x !== null) {
      if (e.x < -threshold) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      else window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
      
      if (e.x > threshold) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
      else window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
    }
  }, []);

  // CHANGE: Joystick stop handler to release all keys
  const handleJoystickStop = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
  }, []);

  const handleLookJoystickMove = useCallback((e: any) => {
    // Pass the raw x and y from the joystick to the game canvas
    // The null check prevents sending data when the stick is released
    if (gameCanvasRef.current) {
        gameCanvasRef.current.updateLookRotation(e.x, e.y);
    }
  }, []);
  return (
    <div className="min-h-screen w-screen h-screen relative overflow-hidden bg-background">
      {/* CHANGE: Add the rotation prompt for mobile devices */}
      {isMobile && <RotationPrompt />}

      {gameState === 'menu' && (
        <MainMenu onStartGame={handleStartGame} onShowInstructions={() => setGameState('instructions')} muted={muted} savedPlayerName={playerName} onClearPlayerName={handleClearPlayerName} />
      )}

      {gameState === 'instructions' && (
        <InstructionsScreen onBack={() => setGameState('menu')} muted={muted} />
      )}
      
      {(gameState === 'playing' || gameState === 'paused' || gameState === 'gameOver' || gameState === 'victory') && (
        <div className="w-full h-full flex items-center justify-center p-1 sm:p-4">
          <div className="relative w-full h-screen max-w-none">
            <GameCanvas3D
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
              // mobileDirection is no longer needed
              difficulty={difficulty}
              mind={selectedMind}
              mazeId={selectedMazeId}
              onScoreUpdate={setScore}
              gameSettings={gameSettings}
              onSettingsChange={setGameSettings}
              texturePath={selectedTexturePath}
              floorTexturePath={selectedFloorTexture}
              thirdPerson={isThirdPerson}
              onToggleThirdPerson={setIsThirdPerson}
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
            <MinimapContainer gameCanvasRef={gameCanvasRef} isThirdPerson={isThirdPerson} />
          
            {gameState === 'paused' && (
              <PauseMenu 
                onResume={() => setGameState('playing')} 
                onRestart={handleRestart} 
                onMainMenu={handleMainMenu} 
                muted={muted} 
                gameSettings={gameSettings}
                onSettingsChange={setGameSettings}
              />
            )}
            {(gameState === 'gameOver' || gameState === 'victory') && (
              <GameOverScreen 
                isVictory={gameState === 'victory'} 
                memoriesCollected={memoriesCollected} 
                totalMemories={2 + (currentLevel - 1)}
                playerName={playerName} 
                onRetry={handleRetry}
                onMainMenu={handleMainMenu} 
                muted={muted} 
              />
            )}
          </div>
          {/* CHANGE: Replace VirtualArrowKeys with MobileControls */}
          {isMobile && gameState === 'playing' && (
            <MobileControls
              onMove={handleJoystickMove}
              onStop={handleJoystickStop}
              onSpacePress={handleSpacePress}
              onToggleView={handleToggleView}
              onLookMove={handleLookJoystickMove}
              isThirdPerson={isThirdPerson}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Index;