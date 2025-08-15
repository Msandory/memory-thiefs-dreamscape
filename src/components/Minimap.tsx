import React from 'react';

interface MinimapProps {
  mazeLayout: number[][];
  playerPosition: { x: number; y: number };
  orbs: Array<{ x: number; y: number; collected: boolean }>;
  guardians: Array<{ x: number; y: number; alert: boolean }>;
  tileSize: number;
  className?: string;
}

export function Minimap({ 
  mazeLayout, 
  playerPosition, 
  orbs, 
  guardians, 
  tileSize, 
  className = "" 
}: MinimapProps) {
  const minimapSize = 200;
  const cellSize = minimapSize / Math.max(mazeLayout[0]?.length || 1, mazeLayout.length);
  
  // Convert world coordinates to minimap coordinates
  const worldToMinimap = (worldX: number, worldY: number) => {
    const col = Math.floor(worldX / tileSize);
    const row = Math.floor(worldY / tileSize);
    return {
      x: col * cellSize,
      y: row * cellSize
    };
  };

  const playerMiniPos = worldToMinimap(playerPosition.x, playerPosition.y);

  return (
    <div className={`relative bg-black/80 border border-white/20 rounded-lg overflow-hidden ${className}`} 
         style={{ width: minimapSize, height: minimapSize }}>
      {/* Maze walls */}
      <svg width={minimapSize} height={minimapSize} className="absolute inset-0">
        {mazeLayout.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            if (cell === 1) {
              return (
                <rect
                  key={`wall-${rowIndex}-${colIndex}`}
                  x={colIndex * cellSize}
                  y={rowIndex * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="#555"
                  stroke="#777"
                  strokeWidth="0.5"
                />
              );
            }
            return (
              <rect
                key={`floor-${rowIndex}-${colIndex}`}
                x={colIndex * cellSize}
                y={rowIndex * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#222"
              />
            );
          })
        )}
        
        {/* Memory orbs */}
        {orbs.map((orb, index) => {
          if (orb.collected) return null;
          const orbPos = worldToMinimap(orb.x, orb.y);
          return (
            <circle
              key={`orb-${index}`}
              cx={orbPos.x + cellSize / 2}
              cy={orbPos.y + cellSize / 2}
              r={Math.max(2, cellSize / 4)}
              fill="#9B59B6"
              stroke="#E74C3C"
              strokeWidth="1"
            />
          );
        })}
        
        {/* Guardians */}
        {guardians.map((guardian, index) => {
          const guardPos = worldToMinimap(guardian.x, guardian.y);
          return (
            <circle
              key={`guard-${index}`}
              cx={guardPos.x + cellSize / 2}
              cy={guardPos.y + cellSize / 2}
              r={Math.max(2, cellSize / 3)}
              fill={guardian.alert ? "#E74C3C" : "#F39C12"}
              stroke="#FFF"
              strokeWidth="1"
            />
          );
        })}
        
        {/* Player */}
        <circle
          cx={playerMiniPos.x + cellSize / 2}
          cy={playerMiniPos.y + cellSize / 2}
          r={Math.max(3, cellSize / 2.5)}
          fill="#3498DB"
          stroke="#FFF"
          strokeWidth="2"
        />
        
        {/* Player direction indicator */}
        <line
          x1={playerMiniPos.x + cellSize / 2}
          y1={playerMiniPos.y + cellSize / 2}
          x2={playerMiniPos.x + cellSize / 2 + Math.cos(0) * cellSize / 2}
          y2={playerMiniPos.y + cellSize / 2 + Math.sin(0) * cellSize / 2}
          stroke="#FFF"
          strokeWidth="1"
        />
      </svg>
      
      {/* Legend */}
      <div className="absolute bottom-1 left-1 text-xs text-white/70">
        <div className="flex items-center gap-1 mb-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>You</span>
        </div>
        <div className="flex items-center gap-1 mb-1">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span>Orbs</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <span>Guards</span>
        </div>
      </div>
    </div>
  );
}