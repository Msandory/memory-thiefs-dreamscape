import React from 'react';
import { Joystick } from 'react-joystick-component';


interface MobileControlsProps {
    onMove: (e: any) => void;
  onStop: (e: any) => void;
  onSpacePress: () => void;
  onToggleView: () => void;
   onLookMove: (e: any) => void;
   isThirdPerson: boolean;
}


export const MobileControls = ({ 
    onMove, 
    onStop, 
    onLookMove,
    onSpacePress, 
    onToggleView,
    isThirdPerson
  }: MobileControlsProps) => {
    return (
      <>
        {/* Movement Joystick on the left */}
        <div className="fixed bottom-16 left-8 md:left-16 z-50">
          <Joystick
            size={100}
            baseColor="rgba(100, 100, 100, 0.5)"
            stickColor="rgba(200, 200, 200, 0.7)"
            move={onMove}
            stop={onStop}
          />
        </div>
  
        {/* CHANGE: Look Joystick on the right */}
        <div className="fixed bottom-16 right-8 md:right-16 z-50">
          <Joystick
            size={100}
            baseColor="rgba(100, 100, 100, 0.5)"
            stickColor="rgba(200, 200, 200, 0.7)"
            move={onLookMove}
            // The stop event can be the same to ensure it stops looking
            stop={onLookMove} 
          />
        </div>
  
        {/* CHANGE: Action buttons at the bottom-center */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
          <button
            className="w-24 h-16 bg-blue-500/50 backdrop-blur-sm rounded-lg flex items-center justify-center touch-none text-white text-sm font-bold"
            onTouchStart={onToggleView}
            onMouseDown={onToggleView}
          >
            {/* Dynamic text based on current view */}
            {isThirdPerson ? '1st Person' : '3rd Person'}
          </button>
          <button
            className="w-24 h-20 bg-yellow-500/50 backdrop-blur-sm rounded-lg flex items-center justify-center touch-none text-white font-bold"
            onTouchStart={onSpacePress}
            onMouseDown={onSpacePress}
          >
            THUNDER
          </button>
        </div>
      </>
    );
  };