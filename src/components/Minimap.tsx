import React, { useCallback } from 'react';
import { commonConfig, TILE_SIZE, MAP_COLS, MAP_ROWS } from '../config/gameConfig'; // Import commonConfig and global TILE_SIZE constants

interface MinimapProps {
  mazeLayout: number[][];
  playerPosition: { x: number; y: number };
  orbs: Array<{ x: number; y: number; collected: boolean }>;
  guardians: Array<{ x: number; y: number; alert: boolean; rotationY: number }>;
  powerUps?: Array<{ x: number; y: number; type: string; collected: boolean }>;
  playerRotation?: number; // Player's look rotation (Three.js Y-rotation)
  isThirdPerson?: boolean; // To allow minimap to behave differently if needed for camera views
  className?: string;
}

export function Minimap({ 
  mazeLayout, 
  playerPosition, 
  orbs, 
  guardians, 
  powerUps = [],
  playerRotation = 0,
  isThirdPerson = false, // Received from GameCanvas3D now
  className = "" 
}: MinimapProps) {
  const minimapSize = 200;
  // Calculate cellSize based on actual maze dimensions from config for consistent scaling
  const mapWidthInTiles = MAP_COLS;
  const mapHeightInTiles = MAP_ROWS;
  const cellSize = minimapSize / Math.max(mapWidthInTiles, mapHeightInTiles); // Base cell size on the larger dimension for fit

  // Calculate vision cone properties
  const visionConeLengthInMinimapPixels = (commonConfig.guardianVisionRange / TILE_SIZE) * cellSize;
  const visionConeAngleRad = commonConfig.guardianVisionAngle * (Math.PI / 180);

  // Helper to convert game world coordinates (TILE_SIZE-based) to minimap pixels
  const worldToMinimap = useCallback((worldX: number, worldY: number) => {
    // Map game world coordinates to a grid index (column, row)
    const col = worldX / TILE_SIZE;
    const row = worldY / TILE_SIZE;
    
    // Map grid index to minimap pixel coordinates
    // Adjusting mapX/Y relative to the full minimap size so the map is centered if cellSize is not uniform for width/height
    const actualMapWidthPixels = mapWidthInTiles * cellSize;
    const actualMapHeightPixels = mapHeightInTiles * cellSize;

    const offsetX = (minimapSize - actualMapWidthPixels) / 2;
    const offsetY = (minimapSize - actualMapHeightPixels) / 2;

    return {
      x: col * cellSize + offsetX,
      y: row * cellSize + offsetY
    };
  }, [cellSize, mapWidthInTiles, mapHeightInTiles, minimapSize]);


  const playerMiniPos = worldToMinimap(playerPosition.x, playerPosition.y);
  
  // Player & Guardian Rotation Logic:
  // - GameCanvas3D Player: playerRotation (`cameraRotationRef.current.y`)
  //   - Assumed: `playerRotation = 0` implies facing World `-Z` (logical "North").
  // - GameCanvas3D Guardian: `guardian.rotationY` (from `Math.atan2(dx, dy)`)
  //   - Assumed: `guardian.rotationY = 0` implies facing Game `+Y` (logical "South", World `+Z`).
  // - Minimap drawing logic: `sin(angle)*len` for X, `-cos(angle)*len` for Y (results in `angle=0` pointing UP, "North").

  // Player's Minimap Rotation: If playerRotation = 0 is North (-Z), and Minimap's 0 is North (Up), then it's direct.
  const finalPlayerRotationOnMinimap = playerRotation; 

  return (
    <div className={`relative bg-black/80 border border-white/20 rounded-lg overflow-hidden ${className}`} 
         style={{ width: minimapSize, height: minimapSize }}>
      <svg width={minimapSize} height={minimapSize} className="absolute inset-0">
        {/* Draw Floor/Walls */}
        {mazeLayout.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const mapPos = worldToMinimap(colIndex * TILE_SIZE + TILE_SIZE/2, rowIndex * TILE_SIZE + TILE_SIZE/2);
            const x = mapPos.x - cellSize / 2;
            const y = mapPos.y - cellSize / 2;

            if (cell === 1) { // Wall
              return (
                <rect
                  key={`wall-${rowIndex}-${colIndex}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill="#555"
                  stroke="#777"
                  strokeWidth="0.5"
                />
              );
            }
            return ( // Floor
              <rect
                key={`floor-${rowIndex}-${colIndex}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill="#222"
              />
            );
          })
        )}
        
        {/* Draw Orbs */}
        {orbs.map((orb, index) => {
          if (orb.collected) return null;
          const orbPos = worldToMinimap(orb.x, orb.y);
          return (
            <circle
              key={`orb-${index}`}
              cx={orbPos.x}
              cy={orbPos.y}
              r={Math.max(2, cellSize / 4)}
              fill="#9B59B6"
              stroke="#E74C3C"
              strokeWidth="1"
            />
          );
        })}
        
        {/* Draw Power-ups */}
        {powerUps.map((powerUp, index) => {
          if (powerUp.collected) return null;
          const powerUpPos = worldToMinimap(powerUp.x, powerUp.y);
          const getColor = (type: string) => {
            switch (type) {
              case 'speed': return '#00FF00';
              case 'immunity': return '#FFD700';
              case 'thunder': return '#FF6600';
              case 'timer': return '#00CCFF';
              default: return '#FFFFFF';
            }
          };
          return (
            <rect
              key={`powerup-${index}`}
              x={powerUpPos.x - cellSize / 4} // Center it
              y={powerUpPos.y - cellSize / 4} // Center it
              width={cellSize / 2}
              height={cellSize / 2}
              fill={getColor(powerUp.type)}
              stroke="#FFF"
              strokeWidth="1"
            />
          );
        })}
        
        {/* Draw Guardians and their vision cones */}
        {guardians.map((guardian, index) => {
          const guardMiniPos = worldToMinimap(guardian.x, guardian.y);
          const centerX = guardMiniPos.x;
          const centerY = guardMiniPos.y;
          
          // Apply +Math.PI offset: guardian.rotationY=0 (facing +Z/South) -> minimap +PI (Down/South)
          const minimapGuardRotation = guardian.rotationY + Math.PI; 
          
          const startAngle = minimapGuardRotation - visionConeAngleRad / 2;
          const endAngle = minimapGuardRotation + visionConeAngleRad / 2;

          const x1 = centerX + Math.sin(startAngle) * visionConeLengthInMinimapPixels;
          const y1 = centerY - Math.cos(startAngle) * visionConeLengthInMinimapPixels; // SVG Y-axis inverted
          const x2 = centerX + Math.sin(endAngle) * visionConeLengthInMinimapPixels;
          const y2 = centerY - Math.cos(endAngle) * visionConeLengthInMinimapPixels; // SVG Y-axis inverted

          return (
            <g key={`guard-${index}`}>
              {/* Vision Cone */}
              <path
                d={`M ${centerX} ${centerY}
                    L ${x1} ${y1}
                    A ${visionConeLengthInMinimapPixels} ${visionConeLengthInMinimapPixels} 0 0 1 ${x2} ${y2}
                    Z`}
                fill={guardian.alert ? "rgba(231, 76, 60, 0.3)" : "rgba(243, 156, 18, 0.3)"}
                stroke={guardian.alert ? "rgba(231, 76, 60, 0.6)" : "rgba(243, 156, 18, 0.6)"}
                strokeWidth="1"
              />
              <circle
                cx={centerX}
                cy={centerY}
                r={Math.max(2, cellSize / 3)}
                fill={guardian.alert ? "#E74C3C" : "#F39C12"}
                stroke="#FFF"
                strokeWidth="1"
              />
              {/* Guardian Direction Line */}
              <line
                x1={centerX}
                y1={centerY}
                x2={centerX + Math.sin(minimapGuardRotation) * cellSize / 3}
                y2={centerY - Math.cos(minimapGuardRotation) * cellSize / 3}
                stroke="#FFF"
                strokeWidth="1"
              />
            </g>
          );
        })}
        
        {/* Draw Player */}
        <circle
          cx={playerMiniPos.x}
          cy={playerMiniPos.y}
          r={Math.max(3, cellSize / 2.5)}
          fill="#3498DB"
          stroke="#FFF"
          strokeWidth="2"
        />
        
        {/* Player Direction Arrow - Simplified to a triangle */}
        <polygon
          points={`${playerMiniPos.x + Math.sin(finalPlayerRotationOnMinimap) * (Math.max(3, cellSize/2.5) + cellSize / 3)},${playerMiniPos.y - Math.cos(finalPlayerRotationOnMinimap) * (Math.max(3, cellSize/2.5) + cellSize / 3)}
                  ${playerMiniPos.x + Math.sin(finalPlayerRotationOnMinimap - 0.4) * (Math.max(3, cellSize/2.5))},${playerMiniPos.y - Math.cos(finalPlayerRotationOnMinimap - 0.4) * (Math.max(3, cellSize/2.5))}
                  ${playerMiniPos.x + Math.sin(finalPlayerRotationOnMinimap + 0.4) * (Math.max(3, cellSize/2.5))},${playerMiniPos.y - Math.cos(finalPlayerRotationOnMinimap + 0.4) * (Math.max(3, cellSize/2.5))}`}
          fill="#FFF"
          stroke="#3498DB" 
          strokeWidth="0.5"
        />
      </svg>
      
      {/* Minimap Legend */}
      <div className="absolute bottom-1 left-1 text-xs text-white/70">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>You</span>
        </div>
        <div className="flex items-center gap-1 mb-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span>Orbs</span>
        </div>
        <div className="flex items-center gap-1 mb-1">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <span>Guards</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500"></div>
          <span>Power-ups</span>
        </div>
      </div>
    </div>
  );
}