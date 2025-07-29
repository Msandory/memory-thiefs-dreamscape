import { useEffect, useRef, useState } from "react";

interface GameCanvasProps {
  isActive: boolean;
  onGameStateChange: (state: 'playing' | 'paused' | 'gameOver' | 'victory') => void;
  memoriesCollected: number;
  onMemoryCollected: () => void;
}

export const GameCanvas = ({ isActive, onGameStateChange, memoriesCollected, onMemoryCollected }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');

  useEffect(() => {
    if (!canvasRef.current || !isActive) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    let animationId: number;
    let player = { x: 400, y: 300, size: 20 };
    let memoryOrbs = [
      { x: 200, y: 150, collected: false, pulse: 0, collectingTime: 0 },
      { x: 600, y: 200, collected: false, pulse: 0, collectingTime: 0 },
      { x: 300, y: 450, collected: false, pulse: 0, collectingTime: 0 },
      { x: 700, y: 400, collected: false, pulse: 0, collectingTime: 0 },
      { x: 150, y: 500, collected: false, pulse: 0, collectingTime: 0 },
    ];
    let guardians = [
      { x: 500, y: 100, direction: 1, patrol: { start: 450, end: 550 } },
      { x: 250, y: 350, direction: 1, patrol: { start: 200, end: 400 } },
    ];

    const keys: { [key: string]: boolean } = {};

    // Event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'Escape') {
        onGameStateChange('paused');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const render = () => {
      if (!ctx) return;

      // Clear canvas with dream-like gradient
      const gradient = ctx.createLinearGradient(0, 0, 800, 600);
      gradient.addColorStop(0, 'hsl(225, 25%, 8%)');
      gradient.addColorStop(0.5, 'hsl(270, 40%, 15%)');
      gradient.addColorStop(1, 'hsl(280, 30%, 20%)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 800, 600);

      // Draw visible boundaries
      ctx.strokeStyle = 'hsl(280, 50%, 40%)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(10, 10, 780, 580);
      ctx.setLineDash([]);

      // Add floating mist particles
      ctx.save();
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 20; i++) {
        const x = (Date.now() * 0.01 + i * 50) % 850;
        const y = 100 + Math.sin(Date.now() * 0.001 + i) * 50;
        const radius = 20 + Math.sin(Date.now() * 0.002 + i) * 10;
        
        const mistGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        mistGradient.addColorStop(0, 'hsl(240, 15%, 85%)');
        mistGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = mistGradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Update and render memory orbs
      memoryOrbs.forEach((orb, index) => {
        if (orb.collected) return;

        orb.pulse += 0.05;
        
        // Check collision with player
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.size && orb.collectingTime === 0) {
          orb.collectingTime = 1; // Start collection process
        }
        
        // Handle collection animation
        if (orb.collectingTime > 0) {
          orb.collectingTime += 0.03;
          if (orb.collectingTime >= 1) {
            orb.collected = true;
            onMemoryCollected();
            return;
          }
        }
        
        const glowSize = 15 + Math.sin(orb.pulse) * 5;
        const alpha = orb.collectingTime > 0 ? 1 - orb.collectingTime : 1;
        
        // Glow effect
        ctx.save();
        ctx.globalAlpha = alpha;
        const orbGradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, glowSize);
        orbGradient.addColorStop(0, 'hsl(280, 80%, 75%)');
        orbGradient.addColorStop(0.7, 'hsl(270, 70%, 65%)');
        orbGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, glowSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Update and render guardians
      const collectedCount = memoryOrbs.filter(orb => orb.collected).length;
      const shouldChase = collectedCount > 0;
      
      guardians.forEach(guardian => {
        if (shouldChase) {
          // Chase player
          const dx = player.x - guardian.x;
          const dy = player.y - guardian.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const speed = 1.5;
            guardian.x += (dx / distance) * speed;
            guardian.y += (dy / distance) * speed;
          }
        } else {
          // Normal patrol behavior
          guardian.x += guardian.direction * 1;
          if (guardian.x >= guardian.patrol.end || guardian.x <= guardian.patrol.start) {
            guardian.direction *= -1;
          }
        }

        // Guardian glow
        const guardianGradient = ctx.createRadialGradient(guardian.x, guardian.y, 0, guardian.x, guardian.y, 25);
        guardianGradient.addColorStop(0, 'hsl(340, 60%, 60%)');
        guardianGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = guardianGradient;
        ctx.beginPath();
        ctx.arc(guardian.x, guardian.y, 25, 0, Math.PI * 2);
        ctx.fill();

        // Guardian body
        ctx.fillStyle = 'hsl(340, 60%, 60%)';
        ctx.beginPath();
        ctx.arc(guardian.x, guardian.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Check collision with player
        const dx = player.x - guardian.x;
        const dy = player.y - guardian.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 30) {
          onGameStateChange('gameOver');
        }
      });

      // Handle player movement (respect boundaries)
      const speed = 3;
      if (keys['w'] || keys['arrowup']) player.y = Math.max(20 + player.size, player.y - speed);
      if (keys['s'] || keys['arrowdown']) player.y = Math.min(580 - player.size, player.y + speed);
      if (keys['a'] || keys['arrowleft']) player.x = Math.max(20 + player.size, player.x - speed);
      if (keys['d'] || keys['arrowright']) player.x = Math.min(780 - player.size, player.x + speed);

      // Render player
      const playerGradient = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, player.size);
      playerGradient.addColorStop(0, 'hsl(240, 20%, 95%)');
      playerGradient.addColorStop(1, 'hsl(240, 15%, 70%)');
      
      ctx.fillStyle = playerGradient;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
      ctx.fill();

      // Check victory condition
      if (collectedCount === memoryOrbs.length) {
        onGameStateChange('victory');
        return;
      }

      animationId = requestAnimationFrame(render);
    };

    setGameState('playing');
    render();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, onGameStateChange, onMemoryCollected]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <canvas
        ref={canvasRef}
        className="border-2 border-primary/30 rounded-lg shadow-2xl shadow-primary/20 bg-card"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
};