import { useEffect } from "react";
import memoryOrbImg from "@/assets/memory-orb.jpg";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, Clock } from "lucide-react";

interface GameHUDProps {
  memoriesCollected: number;
  totalMemories: number;
  score: number;
  playerName: string;
  gameMessage: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  muted: boolean;
  onToggleMute: () => void;
  timeRemaining: number;
  timerActive: boolean;
  currentLevel: number;
}

export const GameHUD = ({
  memoriesCollected,
  totalMemories,
  score,
  playerName,
  gameMessage,
  isPlaying,
  onTogglePlay,
  muted,
  onToggleMute,
  timeRemaining,
  timerActive,
  currentLevel,
}: GameHUDProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        onToggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onToggleMute]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (seconds: number) => {
    if (seconds <= 10) return 'text-red-400 animate-pulse';
    if (seconds <= 30) return 'text-yellow-400';
    return 'text-primary';
  };

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: '800px',
        height: '600px',
        margin: 'auto',
        contain: 'layout',
      }}
    >
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-4 pointer-events-auto">
        {/* Left-aligned group: Memory orbs, score, level, timer */}
        <div className="flex flex-wrap gap-2">
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 flex items-center gap-2 min-w-0">
            <img
              src={memoryOrbImg}
              alt="Memory Orb"
              className="w-5 h-5 rounded-full animate-pulse-glow"
            />
            <span className="font-dream text-sm sm:text-base truncate">
              {memoriesCollected}/{totalMemories}
            </span>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 min-w-0">
            <span className="font-dream text-sm sm:text-base truncate">Score: {score}</span>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 min-w-0">
            <span className="font-dream text-sm sm:text-base truncate">Level: {currentLevel}</span>
          </div>

          {timerActive && (
            <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 flex items-center gap-1 min-w-0">
              <Clock className={`w-4 h-4 ${getTimerColor(timeRemaining)}`} />
              <span className={`font-dream text-sm sm:text-base font-bold ${getTimerColor(timeRemaining)} truncate`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>

        {/* Right-aligned group: Pause/mute buttons, player name, map */}
        <div className="flex flex-wrap gap-2 items-center ml-auto" style={{ marginRight: '-555px' }}>
          <Button
            variant="ethereal"
            size="sm"
            onClick={onTogglePlay}
            className="bg-card/50 backdrop-blur-sm border border-primary/30 p-2"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="ethereal"
            size="sm"
            onClick={onToggleMute}
            className="bg-card/50 backdrop-blur-sm border border-primary/30 p-2"
            title={muted ? "Unmute (M)" : "Mute (M)"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <div className="bg-card/50 backdrop-blur-sm border border-primary/30 rounded-lg px-2 py-1 min-w-0">
            <span className="font-dream text-sm sm:text-base truncate">{playerName}</span>
          </div>
          
        </div>
      </div>

      <div
        className="absolute bottom-[1%] left-[1%] right-auto"
        style={{
          width: '30%',
          maxWidth: '300px',
        }}
      >
        <div
          className="bg-card/70 backdrop-blur-sm border border-primary/30 rounded-lg p-3 text-left relative shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            color: '#e0e0e0',
          }}
        >
          <p
            className="font-dream text-sm sm:text-base text-foreground/90 animate-fade-in truncate"
            style={{ padding: '0.25rem' }}
          >
            {gameMessage}
          </p>
          {timerActive && timeRemaining <= 10 && timeRemaining > 0 && (
            <p
              className="font-dream text-xs sm:text-sm text-red-400 animate-pulse mt-1 truncate"
              style={{ padding: '0.25rem' }}
            >
              Time is running out! Hurry!
            </p>
          )}
          <div
            className="absolute bottom-[-10px] left-4 w-0 h-0 border-left-[10px] border-top-[10px] border-right-[10px] border-transparent border-top-color-[#16213e]"
            style={{
              transform: 'rotate(45deg)',
              borderLeftWidth: '10px',
              borderTopWidth: '10px',
              borderRightWidth: '10px',
            }}
          />
        </div>
      </div>
    </div>
  );
};