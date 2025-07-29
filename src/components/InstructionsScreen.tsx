import { Button } from "@/components/ui/button";

interface InstructionsScreenProps {
  onBack: () => void;
}

export const InstructionsScreen = ({ onBack }: InstructionsScreenProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-card/90 backdrop-blur-sm border border-primary/30 rounded-lg p-8 max-w-2xl space-y-6 animate-fade-in">
        <h2 className="font-dream text-4xl font-bold text-primary text-center">
          How to Play
        </h2>
        
        <div className="space-y-6 text-foreground">
          <div className="space-y-2">
            <h3 className="font-dream text-xl font-semibold text-accent">Movement</h3>
            <p>Use <kbd className="px-2 py-1 bg-muted rounded text-xs">WASD</kbd> or <kbd className="px-2 py-1 bg-muted rounded text-xs">Arrow Keys</kbd> to navigate the memory palace</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-dream text-xl font-semibold text-accent">Objective</h3>
            <p>Collect all glowing memory orbs while avoiding the ancient guardians that patrol the palace</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-dream text-xl font-semibold text-accent">Guardians</h3>
            <p>Red glowing entities that follow patrol paths. If they detect you, the theft fails</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-dream text-xl font-semibold text-accent">Memory Orbs</h3>
            <p>Purple glowing spheres containing stolen memories. Collect all to escape the palace</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-dream text-xl font-semibold text-accent">Controls</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><kbd className="px-2 py-1 bg-muted rounded text-xs">ESC</kbd> - Pause game</p>
              <p><kbd className="px-2 py-1 bg-muted rounded text-xs">WASD</kbd> - Move player</p>
            </div>
          </div>
        </div>

        <div className="text-center pt-4">
          <Button 
            variant="dream" 
            size="lg" 
            onClick={onBack}
            className="min-w-32"
          >
            Back
          </Button>
        </div>

        <p className="text-sm text-muted-foreground text-center italic">
          "Navigate the surreal dreamscape and claim what was forgotten..."
        </p>
      </div>
    </div>
  );
};