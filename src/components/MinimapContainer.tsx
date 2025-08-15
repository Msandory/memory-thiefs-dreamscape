import React, { useState, useEffect } from 'react';
import { Minimap } from './Minimap';

interface MinimapContainerProps {
  gameCanvasRef: React.RefObject<any>;
  tileSize?: number;
}

export function MinimapContainer({ gameCanvasRef, tileSize = 100 }: MinimapContainerProps) {
  const [mapData, setMapData] = useState<{
    mazeLayout?: number[][];
    playerPosition?: { x: number; y: number };
    orbs?: Array<{ x: number; y: number; collected: boolean }>;
    guardians?: Array<{ x: number; y: number; alert: boolean }>;
  }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameCanvasRef.current) {
        setMapData({
          mazeLayout: gameCanvasRef.current.getMazeLayout?.(),
          playerPosition: gameCanvasRef.current.getPlayerPosition?.(),
          orbs: gameCanvasRef.current.getOrbs?.(),
          guardians: gameCanvasRef.current.getGuardians?.()
        });
      }
    }, 100); // Update 10 times per second

    return () => clearInterval(interval);
  }, [gameCanvasRef]);

  if (!mapData.mazeLayout || !mapData.playerPosition || !mapData.orbs || !mapData.guardians) {
    return null;
  }

  return (
    <div className="absolute bottom-4 right-4">
      <Minimap
        mazeLayout={mapData.mazeLayout}
        playerPosition={mapData.playerPosition}
        orbs={mapData.orbs}
        guardians={mapData.guardians}
        tileSize={tileSize}
        className=""
      />
    </div>
  );
}