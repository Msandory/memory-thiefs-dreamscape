import { Skeleton } from "@/components/ui/skeleton";

interface GameLoaderProps {
  progress: number;
  stage: string;
}

export const GameLoader = ({ progress, stage }: GameLoaderProps) => {
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-6 p-8">
        <h2 className="text-2xl font-bold text-foreground mb-4">Loading Memory Palace</h2>
        
        <div className="space-y-4 w-64">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
        </div>

        <div className="space-y-2">
          <div className="w-64 bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">{stage}</p>
          <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>
      </div>
    </div>
  );
};