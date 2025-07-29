import { Button } from "@/components/ui/button";

interface GameOverScreenProps {
  isVictory: boolean;
  memoriesCollected: number;
  totalMemories: number;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const GameOverScreen = ({ 
  isVictory, 
  memoriesCollected, 
  totalMemories, 
  onRestart, 
  onMainMenu 
}: GameOverScreenProps) => {
  return (
    <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg p-8 space-y-6 min-w-96 text-center animate-fade-in">
        {isVictory ? (
          <>
            <h2 className="font-dream text-4xl font-bold text-primary animate-pulse-glow">
              Victory!
            </h2>
            <p className="text-lg text-foreground">
              You escaped with all the memories!
            </p>
            <div className="bg-memory-glow/20 border border-memory-glow/30 rounded-lg p-4">
              <p className="font-dream text-xl">
                Memories Collected: {memoriesCollected}/{totalMemories}
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-dream text-4xl font-bold text-destructive">
              Caught!
            </h2>
            <p className="text-lg text-foreground">
              The guardians sensed your presence...
            </p>
            <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-4">
              <p className="font-dream text-xl">
                Memories Collected: {memoriesCollected}/{totalMemories}
              </p>
            </div>
          </>
        )}
        
        <div className="space-y-3">
          <Button 
            variant="dream" 
            size="lg" 
            onClick={onRestart}
            className="w-full"
          >
            Try Again
          </Button>
          
          <Button 
            variant="ethereal" 
            size="lg" 
            onClick={onMainMenu}
            className="w-full"
          >
            Main Menu
          </Button>
        </div>

        {isVictory && (
          <p className="text-sm text-muted-foreground italic">
            "The memories whisper their secrets to you..."
          </p>
        )}
      </div>
    </div>
  );
};