"use client";

import type React from "react";
import { memo, useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Timer,
} from "lucide-react";
import useWebSocket from "react-use-websocket";

const CELL_SIZE = 25;
const PLAYER_SIZE = 15;
const MAZE_WIDTH = 10;
const MAZE_HEIGHT = 8;

type Cell = {
  x: number;
  y: number;
  walls: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  visited: boolean;
};

const MazeRunner: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [maze, setMaze] = useState<Cell[][]>([]);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [gameWon, setGameWon] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const lastMoveTime = useRef(Date.now());
  const MOVE_DELAY = 100; // Minimum time (ms) between moves

  // Basic WebSocket setup
  const { sendMessage, lastMessage } = useWebSocket("ws://localhost:5000", {
    onOpen: () => {
      console.log("WebSocket connection established.");
      sendMessage(JSON.stringify({ type: "test" }));
    },
    onClose: () => console.log("WebSocket connection closed."),
    onError: (error) => console.error("WebSocket error:", error),
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    reconnectAttempts: 10,
    share: true, // Enable sharing the WebSocket connection
  });

  const generateMaze = useCallback(() => {
    const newMaze: Cell[][] = Array(MAZE_HEIGHT)
      .fill(null)
      .map((_, y) =>
        Array(MAZE_WIDTH)
          .fill(null)
          .map((_, x) => ({
            x,
            y,
            walls: { top: true, right: true, bottom: true, left: true },
            visited: false,
          }))
      );

    const stack: Cell[] = [];
    const startCell = newMaze[0][0];
    startCell.visited = true;
    stack.push(startCell);

    while (stack.length > 0) {
      const currentCell = stack.pop()!;
      const neighbors = getUnvisitedNeighbors(currentCell, newMaze);

      if (neighbors.length > 0) {
        stack.push(currentCell);
        const [nextCell, direction] =
          neighbors[Math.floor(Math.random() * neighbors.length)];
        removeWall(currentCell, nextCell, direction);
        nextCell.visited = true;
        stack.push(nextCell);
      }
    }
    
    // Add shortcuts to simplify the maze by removing additional walls
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        // 30% chance to remove an additional wall if it's not an exterior wall
        if (Math.random() < 0.3) {
          const cell = newMaze[y][x];
          const possibleWalls = [];
          
          if (y > 0 && cell.walls.top) possibleWalls.push('top');
          if (x < MAZE_WIDTH - 1 && cell.walls.right) possibleWalls.push('right');
          if (y < MAZE_HEIGHT - 1 && cell.walls.bottom) possibleWalls.push('bottom');
          if (x > 0 && cell.walls.left) possibleWalls.push('left');
          
          if (possibleWalls.length > 0) {
            const wallToRemove = possibleWalls[Math.floor(Math.random() * possibleWalls.length)];
            let neighborCell;
            
            if (wallToRemove === 'top' && y > 0) {
              neighborCell = newMaze[y-1][x];
              removeWall(cell, neighborCell, 'top');
            } else if (wallToRemove === 'right' && x < MAZE_WIDTH - 1) {
              neighborCell = newMaze[y][x+1];
              removeWall(cell, neighborCell, 'right');
            } else if (wallToRemove === 'bottom' && y < MAZE_HEIGHT - 1) {
              neighborCell = newMaze[y+1][x];
              removeWall(cell, neighborCell, 'bottom');
            } else if (wallToRemove === 'left' && x > 0) {
              neighborCell = newMaze[y][x-1];
              removeWall(cell, neighborCell, 'left');
            }
          }
        }
      }
    }

    setMaze(newMaze);
    setPlayerPos({ x: 0, y: 0 });
    setGameWon(false);
    setTimeElapsed(0);
    setIsPlaying(true);
  }, []);

  const getUnvisitedNeighbors = (cell: Cell, maze: Cell[][]) => {
    const neighbors: [Cell, string][] = [];
    const { x, y } = cell;

    if (y > 0 && !maze[y - 1][x].visited)
      neighbors.push([maze[y - 1][x], "top"]);
    if (x < MAZE_WIDTH - 1 && !maze[y][x + 1].visited)
      neighbors.push([maze[y][x + 1], "right"]);
    if (y < MAZE_HEIGHT - 1 && !maze[y + 1][x].visited)
      neighbors.push([maze[y + 1][x], "bottom"]);
    if (x > 0 && !maze[y][x - 1].visited)
      neighbors.push([maze[y][x - 1], "left"]);

    return neighbors;
  };

  const removeWall = (cell1: Cell, cell2: Cell, direction: string) => {
    if (direction === "top") {
      cell1.walls.top = false;
      cell2.walls.bottom = false;
    } else if (direction === "right") {
      cell1.walls.right = false;
      cell2.walls.left = false;
    } else if (direction === "bottom") {
      cell1.walls.bottom = false;
      cell2.walls.top = false;
    } else if (direction === "left") {
      cell1.walls.left = false;
      cell2.walls.right = false;
    }
  };

  const drawMaze = useCallback(
    (currentPlayerPos = playerPos) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw maze
      ctx.strokeStyle = "#4a5568";
      ctx.lineWidth = 2;
      maze.forEach((row) => {
        row.forEach((cell) => {
          const x = cell.x * CELL_SIZE;
          const y = cell.y * CELL_SIZE;

          if (cell.walls.top) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + CELL_SIZE, y);
            ctx.stroke();
          }
          if (cell.walls.right) {
            ctx.beginPath();
            ctx.moveTo(x + CELL_SIZE, y);
            ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
            ctx.stroke();
          }
          if (cell.walls.bottom) {
            ctx.beginPath();
            ctx.moveTo(x, y + CELL_SIZE);
            ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
            ctx.stroke();
          }
          if (cell.walls.left) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + CELL_SIZE);
            ctx.stroke();
          }
        });
      });

      // Draw player
      ctx.fillStyle = "#e53e3e";
      ctx.beginPath();
      ctx.arc(
        currentPlayerPos.x * CELL_SIZE + CELL_SIZE / 2,
        currentPlayerPos.y * CELL_SIZE + CELL_SIZE / 2,
        PLAYER_SIZE / 2,
        0,
        2 * Math.PI
      );
      ctx.fill();

      // Draw end point
      ctx.fillStyle = "#38a169";
      ctx.beginPath();
      ctx.arc(
        (MAZE_WIDTH - 0.5) * CELL_SIZE,
        (MAZE_HEIGHT - 0.5) * CELL_SIZE,
        PLAYER_SIZE / 2,
        0,
        2 * Math.PI
      );
      ctx.fill();
    },
    [playerPos]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const simulateKeyPress = useCallback(
    (key: string) => {
      if (gameWon || !isPlaying) return;

      setPlayerPos((prevPos) => {
        const newPos = { ...prevPos };
        let moved = false;

        switch (key) {
          case "ArrowUp":
            if (prevPos.y > 0 && !maze[prevPos.y][prevPos.x].walls.top) {
              newPos.y--;
              moved = true;
            }
            break;
          case "ArrowRight":
            if (
              prevPos.x < MAZE_WIDTH - 1 &&
              !maze[prevPos.y][prevPos.x].walls.right
            ) {
              newPos.x++;
              moved = true;
            }
            break;
          case "ArrowDown":
            if (
              prevPos.y < MAZE_HEIGHT - 1 &&
              !maze[prevPos.y][prevPos.x].walls.bottom
            ) {
              newPos.y++;
              moved = true;
            }
            break;
          case "ArrowLeft":
            if (prevPos.x > 0 && !maze[prevPos.y][prevPos.x].walls.left) {
              newPos.x--;
              moved = true;
            }
            break;
        }

        if (moved) {
          if (newPos.x === MAZE_WIDTH - 1 && newPos.y === MAZE_HEIGHT - 1) {
            setGameWon(true);
            setIsPlaying(false);
            sendMessage(
              JSON.stringify({
                event: "gameWon",
                time: timeElapsed,
              })
            );
          }

          return newPos;
        }

        return prevPos;
      });
    },
    [gameWon, isPlaying, maze, sendMessage, timeElapsed]
  );

  const handleWebSocketMove = useCallback(
    (x: number, y: number, reset: boolean = false) => {
      const now = Date.now();
      if (now - lastMoveTime.current < MOVE_DELAY) {
        return;
      }

      // Divide the space into regions (1023x1023)
      const centerX = 511.5; // 1023/2
      const centerY = 511.5;
      const deadZone = 50; // Creates a small dead zone in the center

      // Calculate distances from center
      const deltaX = x - centerX;
      const deltaY = y - centerY;

      // Only trigger a move if we're outside the dead zone
      if (Math.abs(deltaX) > deadZone || Math.abs(deltaY) > deadZone) {
        // Determine the dominant direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal movement
          const key = deltaX > 0 ? "ArrowRight" : "ArrowLeft";
          simulateKeyPress(key);
        } else {
          // Vertical movement - Inverted Y logic
          const key = deltaY > 0 ? "ArrowUp" : "ArrowDown";
          simulateKeyPress(key);
        }
        lastMoveTime.current = now;
      }
      if (reset) {
        generateMaze();
      }
    },
    [generateMaze, simulateKeyPress]
  );

  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const data = JSON.parse(lastMessage.data);
        handleWebSocketMove(data.x, data.y, data.button);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    }
  }, [lastMessage, handleWebSocketMove]);

  useEffect(() => {
    generateMaze();
  }, [generateMaze]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && !gameWon) {
      interval = setInterval(() => {
        setTimeElapsed((prevTime) => {
          const newTime = prevTime + 1;
          // Send current time through WebSocket
          sendMessage(
            JSON.stringify({
              event: "currentTime",
              time: newTime,
            })
          );
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, gameWon, sendMessage]);

  useEffect(() => {
    if (maze.length > 0) {
      drawMaze();
    }
  }, [maze, drawMaze]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameWon || !isPlaying) return;

      if (["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        simulateKeyPress(e.key);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gameWon, isPlaying, simulateKeyPress]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-4xl font-bold mb-6 text-gray-800">Maze Runner</h1>
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex flex-col md:flex-row gap-6">
          <div>
            <canvas
              ref={canvasRef}
              width={MAZE_WIDTH * CELL_SIZE}
              height={MAZE_HEIGHT * CELL_SIZE}
              className="border-2 border-gray-300 rounded"
              tabIndex={0}
            />
          </div>
          <div className="flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-700">
                <Timer size={24} />
                <span>Time: {formatTime(timeElapsed)}</span>
              </div>
            </div>
            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={generateMaze}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50"
              >
                New Maze
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowInstructions(!showInstructions)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
              >
                {showInstructions ? "Hide Instructions" : "Show Instructions"}
              </motion.button>
            </div>
          </div>
        </div>
        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 bg-gray-100 p-4 rounded"
            >
              <h2 className="text-lg font-semibold mb-2">How to Play:</h2>
              <ul className="list-disc list-inside space-y-2">
                <li className="flex items-center">
                  <ArrowUp className="mr-2" /> Move Up
                </li>
                <li className="flex items-center">
                  <ArrowRight className="mr-2" /> Move Right
                </li>
                <li className="flex items-center">
                  <ArrowDown className="mr-2" /> Move Down
                </li>
                <li className="flex items-center">
                  <ArrowLeft className="mr-2" /> Move Left
                </li>
                <li className="flex items-center">
                  <Flag className="mr-2" /> Reach the green circle to win
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {gameWon && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-6 text-2xl font-semibold text-green-600 bg-green-100 px-6 py-3 rounded-full"
          >
            Congratulations! You&apos;ve reached the end in{" "}
            {formatTime(timeElapsed)}!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(MazeRunner);
