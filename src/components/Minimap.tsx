import React from 'react';

interface MinimapProps {
  mazeLayout: number[][];
  playerPosition: { x: number; y: number };
  orbs: Array<{ x: number; y: number; collected: boolean }>;
  guardians: Array<{ x: number; y: number; alert: boolean; rotationY: number }>;
  powerUps?: Array<{ x: number; y: number; type: string; collected: boolean }>;
  playerRotation?: number;
  tileSize: number;
  className?: string;
}

export function Minimap({ 
  mazeLayout, 
  playerPosition, 
  orbs, 
  guardians, 
  powerUps = [],
  playerRotation = 0,
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
        
        {/* Power-ups */}
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
              x={powerUpPos.x + cellSize / 4}
              y={powerUpPos.y + cellSize / 4}
              width={cellSize / 2}
              height={cellSize / 2}
              fill={getColor(powerUp.type)}
              stroke="#FFF"
              strokeWidth="1"
            />
          );
        })}
        
        {/* Guardians */}
        {guardians.map((guardian, index) => {
          const guardPos = worldToMinimap(guardian.x, guardian.y);
          return (
            <g key={`guard-${index}`}>
              <circle
                cx={guardPos.x + cellSize / 2}
                cy={guardPos.y + cellSize / 2}
                r={Math.max(2, cellSize / 3)}
                fill={guardian.alert ? "#E74C3C" : "#F39C12"}
                stroke="#FFF"
                strokeWidth="1"
              />
              {/* Guardian direction indicator */}
              <line
                x1={guardPos.x + cellSize / 2}
                y1={guardPos.y + cellSize / 2}
                x2={guardPos.x + cellSize / 2 + Math.sin(guardian.rotationY) * cellSize / 3}
                y2={guardPos.y + cellSize / 2 - Math.cos(guardian.rotationY) * cellSize / 3}
                stroke="#FFF"
                strokeWidth="1"
              />
            </g>
          );
        })}
        
        {/* Player vision cone */}
        <path
          d={`M ${playerMiniPos.x + cellSize / 2} ${playerMiniPos.y + cellSize / 2}
              L ${playerMiniPos.x + cellSize / 2 + Math.sin(playerRotation - Math.PI/6) * cellSize * 2} ${playerMiniPos.y + cellSize / 2 - Math.cos(playerRotation - Math.PI/6) * cellSize * 2}
              A ${cellSize * 2} ${cellSize * 2} 0 0 1 ${playerMiniPos.x + cellSize / 2 + Math.sin(playerRotation + Math.PI/6) * cellSize * 2} ${playerMiniPos.y + cellSize / 2 - Math.cos(playerRotation + Math.PI/6) * cellSize * 2}
              Z`}
          fill="rgba(52, 152, 219, 0.3)"
          stroke="rgba(52, 152, 219, 0.6)"
          strokeWidth="1"
        />
        
        {/* Player */}
        <circle
          cx={playerMiniPos.x + cellSize / 2}
          cy={playerMiniPos.y + cellSize / 2}
          r={Math.max(3, cellSize / 2.5)}
          fill="#3498DB"
          stroke="#FFF"
          strokeWidth="2"
        />
        
        {/* Player direction indicator (arrow) */}
        <line
          x1={playerMiniPos.x + cellSize / 2}
          y1={playerMiniPos.y + cellSize / 2}
          x2={playerMiniPos.x + cellSize / 2 + Math.sin(playerRotation) * cellSize / 1.5}
          y2={playerMiniPos.y + cellSize / 2 - Math.cos(playerRotation) * cellSize / 1.5}
          stroke="#FFF"
          strokeWidth="2"
        />
        {/* Arrowhead */}
        <polygon
          points={`${playerMiniPos.x + cellSize / 2 + Math.sin(playerRotation) * cellSize / 1.5},${playerMiniPos.y + cellSize / 2 - Math.cos(playerRotation) * cellSize / 1.5}
                   ${playerMiniPos.x + cellSize / 2 + Math.sin(playerRotation - 0.5) * cellSize / 2.5},${playerMiniPos.y + cellSize / 2 - Math.cos(playerRotation - 0.5) * cellSize / 2.5}
                   ${playerMiniPos.x + cellSize / 2 + Math.sin(playerRotation + 0.5) * cellSize / 2.5},${playerMiniPos.y + cellSize / 2 - Math.cos(playerRotation + 0.5) * cellSize / 2.5}`}
          fill="#FFF"
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