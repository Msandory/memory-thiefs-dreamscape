import { Button } from "@/components/ui/button";

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const PauseMenu = ({ onResume, onRestart, onMainMenu }: PauseMenuProps) => {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg p-8 space-y-6 min-w-80 text-center animate-fade-in">
        <h2 className="font-dream text-3xl font-bold text-foreground">Game Paused</h2>
        
        <div className="space-y-3">
          <Button 
            variant="dream" 
            size="lg" 
            onClick={onResume}
            className="w-full"
          >
            Resume
          </Button>
          
          <Button 
            variant="ethereal" 
            size="lg" 
            onClick={onRestart}
            className="w-full"
          >
            Restart
          </Button>
          
          <Button 
            variant="ghost" 
            size="lg" 
            onClick={onMainMenu}
            className="w-full"
          >
            Main Menu
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Press <kbd className="px-2 py-1 bg-muted rounded text-xs">ESC</kbd> to resume
        </p>
      </div>
    </div>
  );
};