'use client';

import { useEffect, useState, useRef, useMemo, memo, useCallback } from 'react';

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

// Type definitions
type Path = {
  length: number;
  width: number;
  top: number;
  left: number;
  angle: number; // in degrees
};

type TreeBlock = {
  length: number;
  width: number;
  density: number; // trees per 100px (e.g., 0.5 = 1 tree every 200px)
  top: number;
  left: number;
};

type TextBox = {
  text: string;
  fontSize: number; // in pixels
  top: number;
  left: number;
};

// Deterministic seeded random function for consistent server/client rendering
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Helper function to check if a point is inside a rotated rectangle (path)
function isPointInPath(x: number, y: number, path: Path): boolean {
  // Convert angle from degrees to radians
  const angleRad = (path.angle * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // Translate point to origin (top-left corner of path)
  const dx = x - path.left;
  const dy = y - path.top;

  // Rotate point back to axis-aligned coordinates
  const rotatedX = dx * cos + dy * sin;
  const rotatedY = -dx * sin + dy * cos;

  // Check if point is within the axis-aligned rectangle
  return rotatedX >= 0 && rotatedX <= path.length && Math.abs(rotatedY) <= path.width / 2;
}

// Function to generate a block of trees
function generateTreeBlock(
  block: TreeBlock,
  paths: Path[] = []
): { x: number; y: number }[] {
  const trees: { x: number; y: number }[] = [];
  const spacing = 100 / block.density; // Calculate spacing based on density
  // Create a deterministic seed based on block properties
  const blockSeed = block.left * 1000 + block.top * 100 + block.width + block.length;

  // Generate trees in a grid pattern within the block bounds
  let treeIndex = 0;
  for (let x = block.left; x < block.left + block.width; x += spacing) {
    for (let y = block.top; y < block.top + block.length; y += spacing) {
      // Use deterministic seeded random for consistent rendering
      const seedX = blockSeed + treeIndex * 11;
      const seedY = blockSeed + treeIndex * 13 + 1000;
      const offsetX = (seededRandom(seedX) - 0.5) * spacing * 0.4;
      const offsetY = (seededRandom(seedY) - 0.5) * spacing * 0.4;
      // Round to avoid floating-point precision issues
      const treeX = Math.round((x + offsetX) * 100) / 100;
      const treeY = Math.round((y + offsetY) * 100) / 100;
      treeIndex++;

      // Check if this position is within the block bounds
      if (
        treeX >= block.left &&
        treeX <= block.left + block.width &&
        treeY >= block.top &&
        treeY <= block.top + block.length
      ) {
        // Check if tree is not in any path
        let isInPath = false;
        for (const path of paths) {
          if (isPointInPath(treeX, treeY, path)) {
            isInPath = true;
            break;
          }
        }

        if (!isInPath) {
          trees.push({ x: treeX, y: treeY });
        }
      }
    }
  }

  return trees;
}

// Function to generate border trees around the world edges
function generateBorderTrees(): { x: number; y: number }[] {
  const borderTrees: { x: number; y: number }[] = [];
  const TREE_SPACING = 250;         // moderate density
  const BORDER_DEPTH = 800;         // how far the forest extends offscreen
  const RANDOM_OFFSET = 200;        // randomness to break up the grid
  // Fixed seed for border trees to ensure consistency
  const borderSeed = 12345;

  // Helper for deterministic random noise
  const rand = (range: number, seed: number) => (seededRandom(seed) - 0.5) * range;

  let treeCounter = 0;
  // Generate a few layers of trees around each border
  for (let layer = 0; layer < BORDER_DEPTH; layer += TREE_SPACING / 2) {
    // Top border (above world)
    for (let x = -TREE_SPACING; x <= WORLD_WIDTH + TREE_SPACING; x += TREE_SPACING) {
      const seed1 = borderSeed + treeCounter * 17;
      const seed2 = borderSeed + treeCounter * 19 + 5000;
      borderTrees.push({ 
        x: Math.round((x + rand(RANDOM_OFFSET, seed1)) * 100) / 100, 
        y: Math.round((-layer + rand(RANDOM_OFFSET / 2, seed2)) * 100) / 100 
      });
      treeCounter++;
    }

    // Bottom border (below world)
    for (let x = -TREE_SPACING; x <= WORLD_WIDTH + TREE_SPACING; x += TREE_SPACING) {
      const seed1 = borderSeed + treeCounter * 17;
      const seed2 = borderSeed + treeCounter * 19 + 5000;
      borderTrees.push({
        x: Math.round((x + rand(RANDOM_OFFSET, seed1)) * 100) / 100,
        y: Math.round((WORLD_HEIGHT + layer + rand(RANDOM_OFFSET / 2, seed2)) * 100) / 100,
      });
      treeCounter++;
    }

    // Left border (left of world)
    for (let y = -TREE_SPACING; y <= WORLD_HEIGHT + TREE_SPACING; y += TREE_SPACING) {
      const seed1 = borderSeed + treeCounter * 17;
      const seed2 = borderSeed + treeCounter * 19 + 5000;
      borderTrees.push({ 
        x: Math.round((-layer + rand(RANDOM_OFFSET / 2, seed1)) * 100) / 100, 
        y: Math.round((y + rand(RANDOM_OFFSET, seed2)) * 100) / 100 
      });
      treeCounter++;
    }

    // Right border (right of world)
    for (let y = -TREE_SPACING; y <= WORLD_HEIGHT + TREE_SPACING; y += TREE_SPACING) {
      const seed1 = borderSeed + treeCounter * 17;
      const seed2 = borderSeed + treeCounter * 19 + 5000;
      borderTrees.push({
        x: Math.round((WORLD_WIDTH + layer + rand(RANDOM_OFFSET / 2, seed1)) * 100) / 100,
        y: Math.round((y + rand(RANDOM_OFFSET, seed2)) * 100) / 100,
      });
      treeCounter++;
    }
  }

  return borderTrees;
}

// Path component - stepping stones
const PathVisual = memo(function PathVisual({ path }: { path: Path }) {
  const baseStoneSize = Math.min(path.width * 0.9, 80); // Bigger base size
  const spacing = baseStoneSize * 1.2; // Space between stones
  const numStones = Math.floor(path.length / spacing);
  
  // Create a deterministic seed based on path properties
  const pathSeed = path.left * 1000 + path.top * 100 + path.length + path.angle;
  
  // Convert angle to radians for calculations
  const angleRad = (path.angle * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  
  // Perpendicular direction (90 degrees from path angle) for curving
  const perpCos = Math.cos(angleRad + Math.PI / 2);
  const perpSin = Math.sin(angleRad + Math.PI / 2);
  
  // Curve parameters
  const curveAmplitude = path.width * 0.3; // How far left/right the curve goes
  const curveFrequency = 0.02; // How often it curves (lower = fewer curves)

  return (
    <>
      {Array.from({ length: numStones }).map((_, i) => {
        // Use deterministic seeded random for consistent server/client rendering
        const seed = pathSeed + i * 7; // Multiply by prime for better distribution
        const sizeVariation = 0.85 + seededRandom(seed) * 0.3; // Deterministic between 0.85 and 1.15
        // Round to 2 decimal places to avoid floating-point precision issues
        const stoneSize = Math.round((baseStoneSize * sizeVariation) * 100) / 100;
        
        // Position along the path (from start to end)
        const distanceAlongPath = (i + 1) * spacing - baseStoneSize / 2;
        
        // Create a curving path using sine wave
        const curveOffset = Math.sin(distanceAlongPath * curveFrequency) * curveAmplitude;
        
        // Calculate position: forward along path angle + curve perpendicular to path
        const xOffset = distanceAlongPath * cos + curveOffset * perpCos;
        const yOffset = distanceAlongPath * sin + curveOffset * perpSin;
        
        // Round positions to 2 decimal places to avoid floating-point precision issues
        const left = Math.round((path.left + xOffset - stoneSize / 2) * 100) / 100;
        const top = Math.round((path.top + yOffset - stoneSize / 2) * 100) / 100;
        
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${stoneSize}px`,
              height: `${stoneSize}px`,
              left: `${left}px`,
              top: `${top}px`,
              backgroundColor: '#808080', // grey color
              border: '2px solid #606060',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
            }}
          />
        );
      })}
    </>
  );
});

// Tree component - memoized for performance (larger trees)
const Tree = memo(function Tree({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {/* Tree trunk */}
      <div
        className="absolute bg-amber-900"
        style={{
          width: '64px',
          height: '100px',
          left: '160px',
          top: '460px',
          borderRadius: '4px',
          zIndex: -1,
        }}
      />
      {/* Tree leaves - bottom layer */}
      <div
        className="absolute"
        style={{
          width: 0,
          height: 0,
          borderLeft: '180px solid transparent',
          borderRight: '180px solid transparent',
          borderBottom: '260px solid #2d5016',
          left: '4px',
          top: '0px',
        }}
      />
      {/* Tree leaves - middle layer */}
      <div
        className="absolute"
        style={{
          width: 0,
          height: 0,
          borderLeft: '180px solid transparent',
          borderRight: '180px solid transparent',
          borderBottom: '260px solid #2d5016',
          left: '4px',
          top: '100px',
        }}
      />
      {/* Tree leaves - top layer */}
      <div
        className="absolute"
        style={{
          width: 0,
          height: 0,
          borderLeft: '180px solid transparent',
          borderRight: '180px solid transparent',
          borderBottom: '260px solid #2d5016',
          left: '4px',
          top: '200px', 
        }}
      />
    </div>
  );
});

// TextBox component with sign panel
const TextBoxComponent = memo(function TextBoxComponent({ textBox }: { textBox: TextBox }) {
  // Split text by newlines
  const lines = textBox.text.split('\n');
  
  // Find the longest line for width calculation
  const longestLine = lines.reduce((longest, line) => line.length > longest.length ? line : longest, '');
  const maxLineLength = longestLine.length;
  
  // Estimate sign size based on longest line and number of lines
  const textWidth = maxLineLength * textBox.fontSize * 0.6;
  const signPadding = textBox.fontSize * 0.8;
  const lineHeight = textBox.fontSize * 1.3;
  const signWidth = textWidth + signPadding * 2;
  const signHeight = (lineHeight * lines.length) + signPadding;
  const poleHeight = signHeight * .5;
  const poleWidth = signHeight * 0.15;

  return (
    <div
      className="absolute"
      style={{
        left: `${textBox.left}px`,
        top: `${textBox.top}px`,
        zIndex: 20, // Ensure text appears above trees and paths
      }}
    >
      {/* Sign panel - light brown wood color */}
      <div
        style={{
          position: 'absolute',
          width: `${signWidth}px`,
          height: `${signHeight}px`,
          backgroundColor: '#d4a574', // light brown/wood color
          border: '3px solid #8b6914', // darker brown border
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          left: '0',
          top: '0',
          padding: `${signPadding / 2}px ${signPadding / 2}px`,
        }}
      >
        {/* Text on sign - each line */}
        {lines.map((line, index) => (
          <div
            key={index}
            style={{
              fontSize: `${textBox.fontSize}px`,
              color: '#2c2416', // dark brown text
              fontFamily: '"Georgia", "Times New Roman", serif', // better serif font
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(255, 255, 255, 0.5)',
              lineHeight: `${lineHeight}px`,
              textAlign: 'center',
              width: '100%',
            }}
          >
            {line}
          </div>
        ))}
      </div>
      
      {/* Stick/pole going down */}
      <div
        style={{
          position: 'absolute',
          width: `${poleWidth}px`,
          height: `${poleHeight}px`,
          backgroundColor: '#6b5539', // darker brown for pole
          left: `${signWidth / 2 - poleWidth / 2}px`, // centered under sign
          top: `${signHeight}px`,
          borderRadius: '0 0 2px 2px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
        }}
      />
    </div>
  );
});

export default function Home() {
  const [worldPosition, setWorldPosition] = useState({ x: 590, y: 805 });
  // Use consistent default for SSR and client to prevent hydration mismatch
  const [viewportCenter, setViewportCenter] = useState({ x: 400, y: 300 });
  const [allTrees, setAllTrees] = useState<{ x: number; y: number }[]>([]);
  
  const initialTreeBlocks: TreeBlock[] = [
    { length: 400, width: 1000, density: 0.5, top: 900, left: 800},
  ];

  const initialPaths: Path[] = [
    { length: 1000, width: 50, top: 800, left: 550, angle: 0 },
  ];

  const initialTextBoxes: TextBox[] = [
    { text: 'Welcome to the Picture Book Forest!\n Explore to learn more about how picture books make it\n out of the author\'s mind and into the world!', fontSize: 24, top: 600, left: 550 },
  ];
  
  const [paths, setPaths] = useState<Path[]>(initialPaths);
  const [treeBlocks, setTreeBlocks] = useState<TreeBlock[]>(initialTreeBlocks);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>(initialTextBoxes);
  const containerRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Regenerate trees when treeBlocks or paths change
  useEffect(() => {
    const allGeneratedTrees: { x: number; y: number }[] = [];
    
    // Generate border trees (always included)
    const borderTrees = generateBorderTrees();
    allGeneratedTrees.push(...borderTrees);
    
    // Generate trees for each block
    for (const block of treeBlocks) {
      const blockTrees = generateTreeBlock(block, paths);
      allGeneratedTrees.push(...blockTrees);
    }

    setAllTrees(allGeneratedTrees);
  }, [treeBlocks, paths]);

  // Functions to manage tree blocks, paths, and text boxes
  // You can call these from browser console or your code:
  // window.addTreeBlock({ length: 1000, width: 1000, density: 0.5, top: 0, left: 0 })
  // window.addPath({ length: 500, width: 200, top: 100, left: 100, angle: 45 })
  // window.addTextBox({ text: 'Hello', fontSize: 24, top: 100, left: 100 })
  // window.clearAll()
  const addTreeBlock = useCallback((block: TreeBlock) => {
    setTreeBlocks((prev) => [...prev, block]);
  }, []);

  const addPath = useCallback((path: Path) => {
    setPaths((prev) => [...prev, path]);
  }, []);

  const addTextBox = useCallback((textBox: TextBox) => {
    setTextBoxes((prev) => [...prev, textBox]);
  }, []);

  const clearAll = useCallback(() => {
    setTreeBlocks([]);
    setPaths([]);
    setTextBoxes([]);
  }, []);

  // Expose functions to window for easy access
  useEffect(() => {
    (window as any).addTreeBlock = addTreeBlock;
    (window as any).addPath = addPath;
    (window as any).addTextBox = addTextBox;
    (window as any).clearAll = clearAll;
    
    return () => {
      delete (window as any).addTreeBlock;
      delete (window as any).addPath;
      delete (window as any).addTextBox;
      delete (window as any).clearAll;
    };
  }, [addTreeBlock, addPath, addTextBox, clearAll]);

  const SPEED = 8; // pixels per frame

  // Calculate viewport center
  useEffect(() => {
    const updateViewportCenter = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setViewportCenter({
          x: rect.width / 2,
          y: rect.height / 2,
        });
      } else {
        // Fallback to window dimensions
        setViewportCenter({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      }
    };

    updateViewportCenter();
    window.addEventListener('resize', updateViewportCenter);
    
    return () => {
      window.removeEventListener('resize', updateViewportCenter);
    };
  }, []);

  // Smooth movement loop using requestAnimationFrame
  useEffect(() => {
    const updatePosition = () => {
      setWorldPosition((prev) => {
        let newX = prev.x;
        let newY = prev.y;


        if (keysPressed.current.has('ArrowUp')) {
          newY = Math.max(650, prev.y - SPEED);
        }
        if (keysPressed.current.has('ArrowDown')) {
          newY = Math.min(WORLD_HEIGHT - 200, prev.y + SPEED);
        }
        if (keysPressed.current.has('ArrowLeft')) {
          newX = Math.max(550, prev.x - SPEED);
        }
        if (keysPressed.current.has('ArrowRight')) {
          newX = Math.min(WORLD_WIDTH - 200, prev.x + SPEED);
        }

        return { x: newX, y: newY };
      });

      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Track key presses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        keysPressed.current.add(e.key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        keysPressed.current.delete(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Calculate world container transform to keep circle centered
  const worldTransformX = viewportCenter.x - worldPosition.x;
  const worldTransformY = viewportCenter.y - worldPosition.y;

  return (
    <div
      ref={containerRef}
      className="w-full h-screen bg-pink-400 relative overflow-hidden"
      style={{ backgroundColor: '#99ff99' }}
    >
      {/* World container that moves as you explore */}
      <div
        className="absolute"
        style={{
          width: `${WORLD_WIDTH}px`,
          height: `${WORLD_HEIGHT}px`,
          transform: `translate3d(${worldTransformX}px, ${worldTransformY}px, 0)`,
          willChange: 'transform',
        }}
      >
        {/* Render paths for visual debugging */}
        {paths.map((path, index) => (
          <PathVisual key={`path-${index}`} path={path} />
        ))}
        
        {/* All trees - border trees and generated from tree blocks */}
        {allTrees.map((tree, index) => (
          <Tree key={index} x={tree.x} y={tree.y} />
        ))}
        
        {/* Text boxes */}
        {textBoxes.map((textBox, index) => (
          <TextBoxComponent key={`textbox-${index}`} textBox={textBox} />
        ))}
        
        {/* Moveable circle - stays in world coordinates */}
        <div
          className="absolute rounded-full bg-black z-10"
          style={{
            width: '20px',
            height: '20px',
            left: `${worldPosition.x}px`,
            top: `${worldPosition.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}
