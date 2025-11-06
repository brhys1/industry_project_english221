'use client';

import { useEffect, useState, useRef, useMemo, memo, useCallback } from 'react';

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4300;

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
  additionalInfo?: string; // Optional additional info to display when clicked
  grading?: (response: string) => string; // Optional grading function that returns feedback
  hasInput?: boolean; // Whether this sign should show a text input field
  title?: string; // Optional title for the task (used in completion feedback)
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
  const BOTTOM_RAISE = 200;         // raise bottom trees up by this many pixels
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
        y: Math.round((WORLD_HEIGHT + layer - BOTTOM_RAISE + rand(RANDOM_OFFSET / 2, seed2)) * 100) / 100,
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
const TextBoxComponent = memo(function TextBoxComponent({ 
  textBox, 
  onClick,
  responseText,
  isCompleted
}: { 
  textBox: TextBox;
  onClick?: () => void;
  responseText?: string;
  isCompleted?: boolean;
}) {
  // Split text by newlines
  const lines = textBox.text.split('\n');
  
  // Find the longest line for width calculation (including response text if present)
  const responseLines = responseText ? responseText.split('\n') : [];
  const allLines = [...lines, ...responseLines];
  const longestLine = allLines.reduce((longest, line) => line.length > longest.length ? line : longest, '');
  const maxLineLength = longestLine.length;
  
  // Estimate sign size based on longest line and number of lines (including response)
  const totalLines = lines.length + (responseText ? responseLines.length + 1 : 0); // +1 for separator
  const textWidth = maxLineLength * textBox.fontSize * 0.6;
  const signPadding = textBox.fontSize * 0.8;
  const lineHeight = textBox.fontSize * 1.3;
  const signWidth = textWidth + signPadding * 2;
  const signHeight = (lineHeight * totalLines) + signPadding;
  const poleHeight = signHeight * .5;
  const poleWidth = signHeight * 0.15;
  
  // Opacity for completed tasks
  const opacity = isCompleted ? 0.5 : 1;

  return (
    <div
      className="absolute"
      style={{
        left: `${textBox.left}px`,
        top: `${textBox.top}px`,
        zIndex: 20, // Ensure text appears above trees and paths
        opacity: opacity,
      }}
    >
      {/* Sign panel - light brown wood color */}
      <div
        onClick={onClick}
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
          cursor: onClick ? 'pointer' : 'default',
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
        
        {/* Response text if present */}
        {responseText && (
          <>
            <div
              style={{
                width: '80%',
                height: '2px',
                backgroundColor: '#8b6914',
                margin: `${signPadding / 4}px 0`,
              }}
            />
            <div
              style={{
                fontSize: `${textBox.fontSize * 0.85}px`,
                color: '#2c2416',
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontWeight: 'normal',
                fontStyle: 'italic',
                textShadow: '1px 1px 2px rgba(255, 255, 255, 0.5)',
                lineHeight: `${lineHeight * 0.9}px`,
                textAlign: 'center',
                width: '100%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {responseText}
            </div>
          </>
        )}
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
  const [worldPosition, setWorldPosition] = useState({ x: 850, y: 850 });
  // Use consistent default for SSR and client to prevent hydration mismatch
  const [viewportCenter, setViewportCenter] = useState({ x: 400, y: 300 });
  const [allTrees, setAllTrees] = useState<{ x: number; y: number }[]>([]);
  
  const initialTreeBlocks: TreeBlock[] = [
    { length: 400, width: 400, density: 0.5, top: 900, left: 200},
    { length: 400, width: 1800, density: 0.5, top: 900, left: 800},
    { length: 400, width: 600, density: 0.5, top: 900, left: 2700},
    { length: 400, width: 3000, density: 0.5, top: 2200, left: 800},
    { length: 800, width: 1500, density: 0.5, top: 3300, left: 200},
    { length: 400, width: 500, density: 0.5, top: 3300, left: 1700},
    { length: 800, width: 800, density: 0.5, top: 3300, left: 2900},
    { length: 400, width: 800, density: 0.5, top: 3300, left: 2600},
  ];

  const initialPaths: Path[] = [
    { length: 1000, width: 50, top: 850, left: 800, angle: 0 },
    { length: 400, width: 50, top: 850, left: 1800, angle: -45 },
    { length: 700, width: 50, top: 600, left: 2100, angle: 30 },
    { length: 800, width: 50, top: 900, left: 2670, angle: 0 },
    { length: 800, width: 50, top: 900, left: 3470, angle: 60 },
    { length: 1100, width: 50, top: 900, left: 2800, angle: 90},
    { length: 800, width: 50, top: 1600, left: 3870, angle: 150},
    { length: 2300, width: 50, top: 2000, left: 950, angle: 0},
    { length: 600, width: 50, top: 2000, left: 950, angle: 120},
    { length: 350, width: 50, top: 1300, left: 800, angle: 90},
    { length: 450, width: 50, top: 2000, left: 950, angle: 240},
    { length: 500, width: 50, top: 2520, left: 640, angle: 90},
    { length: 400, width: 50, top: 3020, left: 640, angle: 20},
    { length: 3000, width: 50, top: 3180, left: 1000, angle: 0},
    { length: 600, width: 50, top: 3580, left: 2700, angle: 90},

  ]

  const initialTextBoxes: TextBox[] = [
    {
      text: 'Welcome to the Picture Book Forest!\nIn order for you to escape the forest,\nyou must complete all the tasks on the signs!',
      fontSize: 24,
      top: 600,
      left: 550,
    },
    {
      text: 'Beans is your guide.\nUse the arrow keys\nto move around the world.',
      fontSize: 16,
      top: 750,
      left: 500,
      additionalInfo:
        'Beans is a friendly dog and will help you explore! You can even rename Beans in the box below to make your own helper.',
      hasInput: true,
    },
    {
      text: 'Excited to learn,\ngo this way!\n→',
      fontSize: 24,
      top: 600,
      left: 1400,
    },
    {
      title: 'Author Task 1',
      text: 'The journey starts\nwith Authors!\nClick here and write down\nan idea for a picture book!',
      fontSize: 18,
      top: 750,
      left: 2000,
      additionalInfo:
        'Picture books can just be fun. They don\'t always need to teach a lesson! Words don\'t have to explain everything, because pictures can do the talking too. Kids already understand big feelings like love, joy, and sadness. (Mac & Jon talk)\n\nBelow, write a small idea for your own picture book!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Great job! You've written a creative idea!" : "Please write down an idea for your picture book.";
      },
      hasInput: true,
    },
    {
      title: 'Author Task 2',
      text: 'Authors want everyone\nto read their words and\nfeel understood.\nClick and write down\na part of you you really like!',
      fontSize: 18,
      top: 600,
      left: 2400,
      additionalInfo:
        'When writing picture books it is important that kids feel seen in the writing. Whether that is through actions, emotions, or demographics, we want various experiences across picture books. It is also important that what is being writen comes from what you as the author know, describing some aspect of what you experience in life. Trust kids—they understand emotions even when you don\'t spell them out. Write about something real and special to you. (Mac & Jon & Dr. Thomas talk) \n\nBelow, write your favorite thing about yourself!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Excellent! You've shared something special about yourself!" : "Please write down a part of you that you really like.";
      },
      hasInput: true,
    },
    {
      text: 'Once an author has an idea\nand has done their first\ndraft, they bring it to their agent!',
      fontSize: 18,
      top: 700,
      left: 2900,
    },
    {
      title: 'Agent Task (Option 1)',
      text: 'Already have an\nagent? Take a\nshortcut this way! ↓',
      fontSize: 18,
      top: 950,
      left: 2950,
      additionalInfo:
        'Below, enter your agent\'s information (name & email) to get started finding your publishing partner!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Perfect! Your agent information has been recorded!" : "Please enter your agent's information (name & email).";
      },
      hasInput: true,
    },
    {
      title: 'Author Task (Option 2)',
      text: 'Find an Agent by\nclicking here!',
      fontSize: 18,
      top: 1450,
      left: 3500,
      additionalInfo:
        'Agents know many people in the book world. They help connect authors and publishers, and they take care of contracts and rights. They usually earn about 15% of what the author makes. Agents choose carefully who to represent and often stay loyal to their writers.(Galtt & Zacker talk)\n\nTo find an agent for yourself, write the first sentence of your picture book idea!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Wonderful! You've written the first sentence of your picture book idea!" : "Please write the first sentence of your picture book idea.";
      },
      hasInput: true,
    },
    {
      title: 'Agent -> Editor',
      text: 'Now that our agent\nhas our draft, they will\nhelp us move it forwards!\nClick to move your\nbook forwards!',
      fontSize: 18,
      top: 1700,
      left: 2950,
      additionalInfo:
        'Agents share your book with editors at publishing houses. They talk about money, contracts, and rights. Making a book can take 1–2 years, so everyone has to be patient and keep working together. (Galtt & Zacker talk)\n\nType a motivational quote to keep your book going!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Great motivational quote! Keep your book going!" : "Please type a motivational quote.";
      },
      hasInput: true,
    },
    {
      title: 'Editor Task',
      text: 'Nice, the book was\nliked by an editor!\nThe publishing house said\nthey will move forwards\nwith it! Click and try\nediting like an editor!',
      fontSize: 18,
      top: 1700,
      left: 2000,
      additionalInfo:
        'Editors help polish the story and make sure it fits the publisher\'s style. They care about clear writing and teamwork. Books can show everyday life—they don\'t have to always show pain. (Galtt & Zacker talk)\n\nTry to improve this sentence while keeping it short like in picture books:\n"The man with the great big red hat loved eating ice cream on the beach."',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Nice editing! You've improved the sentence!" : "Please try improving the sentence.";
      },
      hasInput: true,
    },
    {
      title: 'Illustrator Task',
      text: 'They found an\nillustrator for the book!\nType an emoji\nfor illustrations!',
      fontSize: 18,
      top: 2100,
      left: 1100,
      additionalInfo:
        'The illustrator draws after reading the author\'s story. Illustrations can add new meaning or tell a different part of the story. Artists can use pencils, paint, or computers. Sometimes they talk with the author to trade ideas, but not always. Remember—pictures can say things words can\'t! (Erin Stead talk)\n\nType an emoji that shows what your book feels like!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Perfect! You've chosen a great emoji for your book!" : "Please type an emoji that shows what your book feels like.";
      },
      hasInput: true,
    },
    {
      text: 'We have a pathing going\n back up here to let the\n illustrator sneak off and talk\n with the author. Sometimes\n this happens, sometimes it doesn\'t! ↑',
      fontSize: 18,
      top: 1900,
      left: 350,
    },
    {
      title: 'Publishing Task',
      text: 'Your idea has been\nmade into a real book!\nClick and to help the publishing house,\nread the section and answer\na question.',
      fontSize: 18,
      top: 3200,
      left: 450,
      additionalInfo:
        'When a book is made, the author, illustrator, and publisher sign a contract. The publisher pays them and gives a bit of money for each book sold. Should the agent also get paid in the contract? (Galtt & Zacker talk)\n\nWrite "Yes" or "No" below.',
      grading: (response: string) => {
        const trimmed = response.trim().toLowerCase();
        if (trimmed === 'no') {
          return "Correct! The agent should not be involved in the contract.";
        } else if (trimmed === 'yes') {
          return "Actually, the agent should not be involved in the contract because they have a seperate contract with the author! The correct answer is 'No'.";
        } else if (trimmed.length > 0) {
          return "Good try! The correct answer is 'No' - the agent should not be involved in the contract.";
        } else {
          return "Please write 'Yes' or 'No' below.";
        }
      },
      hasInput: true,
    },
    {
      text: 'Edelweiss',
      fontSize: 18,
      top: 3300,
      left: 1300,
      additionalInfo:
        'Edelweiss is a website where bookstores and clubs look at new books before they come out. They read reviews, place orders, and plan displays for their stores. (Literati visit)',
      hasInput: false,
    },
    {
      text: 'Ingram',
      fontSize: 18,
      top: 3000,
      left: 1300,
      additionalInfo:
        'Ingram is a large company that ships books to stores and libraries. Most libraries order from Ingram before books come out so they can have them ready for readers. (AADL visit)',
      hasInput: false,
    },
    {
      title: 'Promotion Task',
      text: 'The book needs someone\nto promote it!\nClick to help with reviews!',
      fontSize: 18,
      top: 3000,
      left: 2000,
      additionalInfo:
        'Bookstores order books 6–12 months early! They read and write reviews to help families find great reads. They also work hard to support small or indie authors. (Literati visit) \n\n Write one part of picture books you like to see!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Great work helping with reviews!" : "Please help with reviews.";
      },
      hasInput: true,
    },
    {
      title: 'Bookstore Task',
      text: 'The book store is\nexcited about your book\nand is ordering it!\nClick to design a display\ntheme at a bookstore.',
      fontSize: 18,
      top: 3300,
      left: 2600,
      additionalInfo:
        'Stores use sites like Edelweiss to choose books months ahead of time. They think hard about what to show on tables or in windows to make kids excited to read. (Literati visit)\n\nGive the bookstore a fun theme for their next display!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Fantastic! You've created a fun display theme!" : "Please give the bookstore a fun theme for their next display.";
      },
      hasInput: true,
    },
    {
      title: 'Library Task',
      text: 'Libraries want everyone\nto access your book! A favorite\nis story time. Click and practice\nreading aloud!',
      fontSize: 18,
      top: 2950,
      left: 2800,
      additionalInfo:
        'Libraries are for everyone and are paid for by local taxes. They order books about 3 months before they come out. Librarians love books with big pictures, repetition, and rhythm for read-aloud time. They use review magazines to help them choose. (AADL visit)\n\nPretend you\'re at story time—read this part out loud, then type "Done"!',
      grading: (response: string) => {
        const trimmed = response.trim().toLowerCase();
        if (trimmed === 'done') {
          return "Perfect! You've completed the story time reading!";
        } else if (trimmed.length > 0) {
          return "Great job reading! Don't forget to type 'Done' when you're finished.";
        } else {
          return "Please read the part out loud, then type 'Done'.";
        }
      },
      hasInput: true,
    },
    {
      text: 'The book has made it\nto readers\' homes!\nCongrats your work\nis done!!',
      fontSize: 18,
      top: 3300,
      left: 3500,
    },
    {
      title: 'Secret Task (look near the bottom)',
      text: 'You found the secret\npath: Awards!!\nLearn more about what\nyour book might win!',
      fontSize: 18,
      top: 4100,
      left: 2300,
      additionalInfo:
        'The Caldecott Medal is a special award for the best illustrated picture book each year. It celebrates stories that mix art and words in powerful ways and honors both creativity and heart. It is a huge deal for books to win this as it cements the author in the industry and boosts book sales.\n\nWrite a smiley face for finding this secret area!',
      grading: (response: string) => {
        return response.trim().length > 0 ? "Awesome! You found the secret area! 🎉" : "Please write a smiley face for finding this secret area.";
      },
      hasInput: true,
    },
  ];
  
  const [paths, setPaths] = useState<Path[]>(initialPaths);
  const [treeBlocks, setTreeBlocks] = useState<TreeBlock[]>(initialTreeBlocks);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>(initialTextBoxes);
  const [facingRight, setFacingRight] = useState(true); // true = facing right, false = facing left
  const [clickedTextBox, setClickedTextBox] = useState<{ index: number; info: string; hasInput?: boolean } | null>(null);
  const [signResponses, setSignResponses] = useState<{ index: number; response: string; timestamp: number }[]>([]);
  const [currentResponse, setCurrentResponse] = useState<string>("");
  const [completionFeedback, setCompletionFeedback] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [elapsedTime, setElapsedTime] = useState<number>(0); // elapsed time in seconds
  const [dogName, setDogName] = useState<string>("Beans"); // dog's name, default "Beans"
  const containerRef = useRef<HTMLDivElement>(null);
  const keysPressed = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Timer effect - starts when component mounts
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000); // Update every second

    return () => clearInterval(timerInterval);
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
    (window as any).getSignResponses = () => signResponses;
    
    return () => {
      delete (window as any).addTreeBlock;
      delete (window as any).addPath;
      delete (window as any).addTextBox;
      delete (window as any).clearAll;
      delete (window as any).getSignResponses;
    };
  }, [addTreeBlock, addPath, addTextBox, clearAll, signResponses]);

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

  // Track key presses and direction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        keysPressed.current.add(e.key);
        
        // Update direction when left/right keys are pressed
        if (e.key === 'ArrowRight') {
          setFacingRight(true);
        } else if (e.key === 'ArrowLeft') {
          setFacingRight(false);
        }
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
      {/* Timer display in top left */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 100,
          backgroundColor: '#d4a574',
          border: '3px solid #8b6914',
          borderRadius: '8px',
          padding: '12px 20px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div
          style={{
            fontSize: '24px',
            color: '#2c2416',
            fontFamily: '"Georgia", "Times New Roman", serif',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {formatTime(elapsedTime)}
        </div>
      </div>
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
        {textBoxes.map((textBox, index) => {
          const response = signResponses.find(r => r.index === index);
          const responseText = response?.response || undefined;
          
          // Indices for the two agent-related tasks (either one completes both)
          const agentTaskIndices = [6, 7]; // "Already have an agent" and "Find an Agent"
          
          let isCompleted = response && response.response.trim().length > 0;
          
          // If this is an agent task, check if either one is completed
          if (agentTaskIndices.includes(index)) {
            const agentTaskCompleted = agentTaskIndices.some(agentIndex => {
              const agentResponse = signResponses.find(r => r.index === agentIndex);
              return agentResponse && agentResponse.response.trim().length > 0;
            });
            isCompleted = agentTaskCompleted;
          }
          
          return (
            <TextBoxComponent 
              key={`textbox-${index}`} 
              textBox={textBox}
              onClick={textBox.additionalInfo ? () => setClickedTextBox({ index, info: textBox.additionalInfo || '', hasInput: textBox.hasInput }) : undefined}
              responseText={responseText}
              isCompleted={isCompleted}
            />
          );
        })}
        
        {/* Completion button */}
        <button
          className="absolute z-20"
          style={{
            left: `3800px`,
            top: `3050px`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#8b6914',
            color: '#ffffff',
            border: '2px solid #5e4510',
            borderRadius: '8px',
            padding: '10px 16px',
            fontFamily: '"Georgia", "Times New Roman", serif',
            fontSize: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            cursor: 'pointer',
          }}
          onClick={() => {
            // Find all text boxes that have grading functions
            const textBoxesWithGrading = textBoxes
              .map((tb, idx) => ({ textBox: tb, index: idx }))
              .filter(({ textBox }) => textBox.grading);

            // Indices for the two agent-related tasks (either one completes both)
            const agentTaskIndices = [6, 7]; // "Already have an agent" and "Find an Agent"
            const beansRenameIndex = 1; // Beans rename sign - doesn't count towards completion
            
            // Check if either agent task is completed
            const agentTaskCompleted = agentTaskIndices.some(index => {
              const response = signResponses.find(r => r.index === index);
              return response && response.response.trim().length > 0;
            });

            // Check if all required responses have been submitted
            const missingResponses: number[] = [];
            const gradingResults: { index: number; feedback: string }[] = [];

            textBoxesWithGrading.forEach(({ textBox, index }) => {
              // Skip Beans rename sign - it doesn't count towards completion
              if (index === beansRenameIndex) {
                return;
              }
              
              // Skip agent tasks if at least one is completed
              if (agentTaskIndices.includes(index)) {
                if (!agentTaskCompleted) {
                  missingResponses.push(index);
                }
                return;
              }
              
              const response = signResponses.find(r => r.index === index);
              if (!response || !response.response.trim()) {
                missingResponses.push(index);
              } else if (textBox.grading) {
                const feedback = textBox.grading(response.response);
                gradingResults.push({ index, feedback });
              }
            });

            if (missingResponses.length > 0) {
              // Build list of missing task names
              const missingTaskNames: string[] = [];
              
              // Check if agent tasks are missing (special handling)
              const agentTasksMissing = missingResponses.filter(idx => agentTaskIndices.includes(idx));
              if (agentTasksMissing.length > 0) {
                // Use titles if available, otherwise use default text
                const agentTask1 = textBoxes[agentTaskIndices[0]];
                const agentTask2 = textBoxes[agentTaskIndices[1]];
                const task1Name = agentTask1?.title || 'Find an Agent';
                const task2Name = agentTask2?.title || 'Already have an agent';
                missingTaskNames.push(`${task1Name} or ${task2Name}`);
              }
              
              // Add other missing tasks
              missingResponses.forEach(index => {
                if (!agentTaskIndices.includes(index)) {
                  const textBox = textBoxes[index];
                  if (textBox) {
                    // Use title if available, otherwise use the first line of the sign text
                    const taskName = textBox.title || textBox.text.split('\n')[0];
                    missingTaskNames.push(taskName);
                  }
                }
              });
              
              const missingCount = missingTaskNames.length;
              const taskList = missingTaskNames.map((name, idx) => `  ${idx + 1}. ${name}`).join('\n');
              
              setCompletionFeedback({
                show: true,
                message: `You still need to complete ${missingCount} task${missingCount > 1 ? 's' : ''}:\n\n${taskList}\n\nPlease go back and complete all the tasks on the signs!`
              });
            } else {
              // All tasks completed - show success message with time and all responses
              const timeString = formatTime(elapsedTime);
              
              // Collect all responses with their task titles
              const allResponses: { title: string; response: string }[] = [];
              
              textBoxesWithGrading.forEach(({ textBox, index }) => {
                // Skip Beans rename sign - it doesn't count towards completion
                if (index === beansRenameIndex) {
                  return;
                }
                
                // For agent tasks, only include the one that was completed
                if (agentTaskIndices.includes(index)) {
                  const response = signResponses.find(r => r.index === index);
                  if (response && response.response.trim().length > 0) {
                    const taskName = textBox.title || textBox.text.split('\n')[0];
                    allResponses.push({ title: taskName, response: response.response });
                  }
                  return;
                }
                
                const response = signResponses.find(r => r.index === index);
                if (response && response.response.trim().length > 0) {
                  const taskName = textBox.title || textBox.text.split('\n')[0];
                  allResponses.push({ title: taskName, response: response.response });
                }
              });
              
              // Format responses for display
              const responsesList = allResponses.map((item, idx) => 
                `${idx + 1}. ${item.title}:\n   "${item.response}"`
              ).join('\n\n');
              
              setCompletionFeedback({
                show: true,
                message: `Congratulations! You've completed all the tasks! You've successfully escaped the Picture Book Forest! 🎉\n\nYour time: ${timeString}\n\nYour responses:\n\n${responsesList}`
              });
            }
          }}
        >
          Click me when you've <br></br>completed all the tasks
        </button>
        
        {/* Moveable dog - stays in world coordinates */}
        <div
          className="absolute z-10"
          style={{
            left: `${worldPosition.x}px`,
            top: `${worldPosition.y}px`,
            transform: `translate(-50%, -50%)`,
          }}
        >
          <img
            src="/dog.png"
            alt="dog"
            style={{
              width: '180px',
              height: '120px',
              transform: `${facingRight ? 'scaleX(-1)' : 'scaleX(1)'}`,
              imageRendering: 'pixelated',
            }}
          />
          {/* Dog name display */}
          <div
            style={{
              position: 'absolute',
              top: '120px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '18px',
              color: '#2c2416',
              fontFamily: '"Georgia", "Times New Roman", serif',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(255, 255, 255, 0.8)',
              whiteSpace: 'nowrap',
              backgroundColor: 'rgba(212, 165, 116, 0.9)',
              padding: '4px 12px',
              borderRadius: '8px',
              border: '2px solid #8b6914',
            }}
          >
            {dogName}
          </div>
        </div>
      </div>
      
      {/* Modal overlay for displaying additional info and collecting response */}
      {clickedTextBox && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer',
          }}
          onClick={() => setClickedTextBox(null)}
        >
          <div
            style={{
              backgroundColor: '#d4a574',
              border: '4px solid #8b6914',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '600px',
              maxHeight: '70vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              cursor: 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: '20px',
                color: '#2c2416',
                fontFamily: '"Georgia", "Times New Roman", serif',
                lineHeight: '1.6',
                whiteSpace: 'pre-line',
                textAlign: 'left',
              }}
            >
              {clickedTextBox.info}
            </div>
            {clickedTextBox.hasInput !== false && (
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: '#2c2416', fontFamily: '"Georgia", "Times New Roman", serif' }}>
                  Your response:
                </label>
                <textarea
                  value={currentResponse}
                  onChange={(e) => setCurrentResponse(e.target.value)}
                  placeholder=""
                  style={{
                    width: '100%',
                    minHeight: '90px',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #8b6914',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button
                    onClick={() => {
                      if (!clickedTextBox) return;
                      const trimmedResponse = currentResponse.trim();
                      
                      // If this is the Beans rename sign (index 1), update the dog's name
                      if (clickedTextBox.index === 1 && trimmedResponse.length > 0) {
                        setDogName(trimmedResponse);
                      }
                      
                      setSignResponses((prev) => [
                        ...prev,
                        { index: clickedTextBox.index, response: trimmedResponse, timestamp: Date.now() },
                      ]);
                      setCurrentResponse('');
                      setClickedTextBox(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#8b6914',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontFamily: '"Georgia", "Times New Roman", serif',
                      fontWeight: 'bold',
                    }}
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => {
                      setCurrentResponse('');
                      setClickedTextBox(null);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#c7b299',
                      color: '#2c2416',
                      border: '1px solid #8b6914',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontFamily: '"Georgia", "Times New Roman", serif',
                      fontWeight: 'bold',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {clickedTextBox.hasInput === false && (
              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={() => {
                    setClickedTextBox(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#8b6914',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontFamily: '"Georgia", "Times New Roman", serif',
                    fontWeight: 'bold',
                    width: '100%',
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Completion feedback modal */}
      {completionFeedback.show && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer',
          }}
          onClick={() => setCompletionFeedback({ show: false, message: '' })}
        >
          <div
            style={{
              backgroundColor: '#d4a574',
              border: '4px solid #8b6914',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '600px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
              cursor: 'default',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: '20px',
                color: '#2c2416',
                fontFamily: '"Georgia", "Times New Roman", serif',
                lineHeight: '1.6',
                whiteSpace: 'pre-line',
                textAlign: 'left',
                overflowY: 'auto',
                flex: 1,
                marginBottom: '20px',
                paddingRight: '10px',
              }}
            >
              {completionFeedback.message}
            </div>
            <button
              onClick={() => setCompletionFeedback({ show: false, message: '' })}
              style={{
                padding: '10px 20px',
                backgroundColor: '#8b6914',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontWeight: 'bold',
                width: '100%',
                flexShrink: 0,
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
