import React, { useState, useEffect } from 'react';
import { Minimap } from './Minimap';
import { TILE_SIZE } from '../config/gameConfig'; // Import TILE_SIZE from gameConfig for passing

interface MinimapContainerProps {
  gameCanvasRef: React.RefObject<any>;
  isThirdPerson: boolean; // Add this prop to pass through from parent GameCanvas3D
}

export function MinimapContainer({ gameCanvasRef, isThirdPerson }: MinimapContainerProps) {
  const [mapData, setMapData] = useState<{
    mazeLayout?: number[][];
    playerPosition?: { x: number; y: number };
    orbs?: Array<{ x: number; y: number; collected: boolean }>;
    guardians?: Array<{ x: number; y: number; alert: boolean; rotationY: number }>;
    powerUps?: Array<{ x: number; y: number; type: string; collected: boolean }>;
    playerLookRotation?: number; // Renamed to accurately reflect the data
  }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameCanvasRef.current) {
        setMapData({
          mazeLayout: gameCanvasRef.current.getMazeLayout?.(),
          playerPosition: gameCanvasRef.current.getPlayerPosition?.(),
          orbs: gameCanvasRef.current.getOrbs?.(),
          guardians: gameCanvasRef.current.getGuardians?.(),
          powerUps: gameCanvasRef.current.getPowerUps?.(),
          playerLookRotation: gameCanvasRef.current.getPlayerLookRotation?.() // Use the correct imperative handle name
        });
      }
    }, 100); // Update 10 times per second

    return () => clearInterval(interval);
  }, [gameCanvasRef]);

  if (!mapData.mazeLayout || !mapData.playerPosition || !mapData.orbs || !mapData.guardians) {
    return null; // Don't render minimap until all necessary data is loaded
  }

  return (
    <div className="absolute bottom-4 right-4">
      <Minimap
        mazeLayout={mapData.mazeLayout}
        playerPosition={mapData.playerPosition}
        orbs={mapData.orbs}
        guardians={mapData.guardians}
        powerUps={mapData.powerUps}
        playerRotation={mapData.playerLookRotation} // Pass the player's look rotation
        isThirdPerson={isThirdPerson} // Pass isThirdPerson to Minimap
        // tileSize={TILE_SIZE} // Pass TILE_SIZE directly from gameConfig (globally available for convenience)
        className=""
      />
    </div>
  );
}