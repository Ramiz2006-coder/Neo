/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Zap, Info, Settings } from 'lucide-react';

// Configuration
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const LANE_COUNT = 3;
const LANE_WIDTH = CANVAS_WIDTH / LANE_COUNT;
const PLAYER_START_Y = CANVAS_HEIGHT - 120;
const INITIAL_SPEED = 5;
const SPEED_INCREMENT = 0.001;
const OBSTACLE_SPAWN_RATE = 0.02; // Probability per frame

// Asset paths (from generation)
const ASSETS = {
  player: "/src/assets/images/player_car_cyan_1779001828616.png",
  enemy: "/src/assets/images/enemy_car_red_1779001844523.png",
  road: "/src/assets/images/road_pattern_1779001860252.png",
};

type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface Car {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  lane: number;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('highScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<{
    player: Car;
    obstacles: Car[];
    speed: number;
    frame: number;
    keys: { [key: string]: boolean };
    images: { [key: string]: HTMLImageElement };
    lastScoreUpdate: number;
  }>({
    player: { x: LANE_WIDTH + (LANE_WIDTH - 60) / 2, y: PLAYER_START_Y, width: 60, height: 100, speed: 0, lane: 1 },
    obstacles: [],
    speed: INITIAL_SPEED,
    frame: 0,
    keys: {},
    images: {},
    lastScoreUpdate: 0,
  });

  // Preload Images
  useEffect(() => {
    const images = engineRef.current.images;
    Object.entries(ASSETS).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      images[key] = img;
    });
  }, []);

  const startGame = () => {
    engineRef.current.player = { x: LANE_WIDTH + (LANE_WIDTH - 60) / 2, y: PLAYER_START_Y, width: 60, height: 100, speed: 0, lane: 1 };
    engineRef.current.obstacles = [];
    engineRef.current.speed = INITIAL_SPEED;
    engineRef.current.frame = 0;
    setScore(0);
    setGameState('PLAYING');
  };

  const handleGameOver = useCallback(() => {
    setGameState('GAMEOVER');
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('highScore', score.toString());
    }
  }, [score, highScore]);

  // Main Game Loop
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const update = () => {
      const engine = engineRef.current;
      engine.frame++;
      engine.speed += SPEED_INCREMENT;

      // Handle Input
      const targetX = engine.player.lane * LANE_WIDTH + (LANE_WIDTH - engine.player.width) / 2;
      engine.player.x += (targetX - engine.player.x) * 0.2; // Smooth transition

      // Spawn Obstacles
      if (Math.random() < OBSTACLE_SPAWN_RATE) {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        // Ensure no overlapping spawns in same lane too close
        const tooClose = engine.obstacles.some(obs => obs.lane === lane && obs.y < 150);
        if (!tooClose) {
          engine.obstacles.push({
            lane,
            x: lane * LANE_WIDTH + (LANE_WIDTH - 60) / 2,
            y: -100,
            width: 60,
            height: 100,
            speed: engine.speed * 0.8,
          });
        }
      }

      // Move Obstacles
      engine.obstacles.forEach(obs => {
        obs.y += engine.speed;
      });

      // Filter out off-screen obstacles and update score
      const activeObstacles = engine.obstacles.filter(obs => {
        if (obs.y > CANVAS_HEIGHT) {
          setScore(s => s + 10);
          return false;
        }
        return true;
      });
      engine.obstacles = activeObstacles;

      // Collision Detection
      for (const obs of engine.obstacles) {
        if (
          engine.player.x < obs.x + obs.width - 10 &&
          engine.player.x + engine.player.width - 10 > obs.x &&
          engine.player.y < obs.y + obs.height - 10 &&
          engine.player.y + engine.player.height - 10 > obs.y
        ) {
          handleGameOver();
          return;
        }
      }
    };

    const draw = () => {
      const engine = engineRef.current;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Road (Scrolling)
      const roadImg = engine.images.road;
      if (roadImg && roadImg.complete) {
        const scroll = (engine.frame * engine.speed) % CANVAS_HEIGHT;
        ctx.drawImage(roadImg, 0, scroll, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(roadImg, 0, scroll - CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        // Fallback Road
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.strokeStyle = '#333';
        for (let i = 1; i < LANE_COUNT; i++) {
          ctx.beginPath();
          ctx.setLineDash([20, 20]);
          ctx.moveTo(i * LANE_WIDTH, 0);
          ctx.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT);
          ctx.stroke();
        }
      }

      // Draw Obstacles
      const enemyImg = engine.images.enemy;
      engine.obstacles.forEach(obs => {
        if (enemyImg && enemyImg.complete) {
          ctx.drawImage(enemyImg, obs.x, obs.y, obs.width, obs.height);
        } else {
          ctx.fillStyle = '#ff4b2b';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
      });

      // Draw Player
      const playerImg = engine.images.player;
      if (playerImg && playerImg.complete) {
        ctx.drawImage(playerImg, engine.player.x, engine.player.y, engine.player.width, engine.player.height);
      } else {
        ctx.fillStyle = '#00f2fe';
        ctx.fillRect(engine.player.x, engine.player.y, engine.player.width, engine.player.height);
      }

      // UI Overlay (Internal speed)
      ctx.fillStyle = 'rgba(0, 242, 254, 0.5)';
      ctx.font = '10px monospace';
      ctx.fillText(`${(engine.speed * 10).toFixed(0)} KM/H`, 10, 20);
    };

    const loop = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, handleGameOver]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        engine.player.lane = Math.max(0, engine.player.lane - 1);
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        engine.player.lane = Math.min(LANE_COUNT - 1, engine.player.lane + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden relative">
      {/* Background Ambience & Perspective Lines */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 w-full h-[60%] bg-zinc-900 shadow-[inset_0_100px_100px_-50px_rgba(0,0,0,0.8)]" style={{ backgroundImage: 'linear-gradient(180deg, transparent 0%, #111 100%)' }}>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[800px] h-full border-x-4 border-zinc-700 opacity-20" style={{ clipPath: 'polygon(10% 0, 90% 0, 100% 100%, 0% 100%)' }}></div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[4px] h-full bg-zinc-800 opacity-10" style={{ clipPath: 'polygon(48% 0, 52% 0, 100% 100%, 0% 100%)' }}></div>
        </div>
        <div className="absolute top-0 w-full h-[40%] bg-zinc-950">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent"></div>
        </div>
        
        {/* Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        {/* Top Header - Glassmorphism */}
        <div className="w-full flex justify-between items-start mb-8">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-1 w-56">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold">Session ID</div>
            <div className="text-xl font-mono tracking-tight text-blue-400 italic">V-NEO.0722</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-2">Driver</div>
            <div className="text-sm font-mono text-zinc-300 uppercase tracking-tighter">Unit_01</div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="bg-blue-600/20 border border-blue-500/30 text-blue-400 px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(37,99,235,0.2)] animate-pulse">
              Live Feed Active
            </div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              Velocity <span className="text-blue-500">Neo</span>
            </h1>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col items-end w-56 text-right">
            <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Records</div>
            <div className="text-2xl font-mono tracking-tight text-emerald-400 italic">{highScore.toLocaleString()}</div>
            <div className="mt-4 flex flex-col items-end gap-1 w-full">
              <div className="flex items-center gap-3 w-full justify-end">
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">SYNC</div>
                <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: gameState === 'PLAYING' ? '85%' : '20%' }}
                    className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 w-full justify-end">
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">TEMP</div>
                <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: gameState === 'PLAYING' ? `${Math.min(100, 40 + score/100)}%` : '0%' }}
                    className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-8 items-stretch w-full justify-center">
          {/* Left Side: Minimap/Radar Style (Static Decor) */}
          <div className="hidden lg:flex flex-col justify-between w-64 py-4">
             <div className="w-full aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <svg className="w-full h-full text-blue-500/30" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M20,50 Q20,20 50,20 T80,50 T50,80 T20,50" strokeDasharray="2 4" />
                  <motion.circle 
                    animate={{ 
                      cx: [20, 50, 80, 50, 20],
                      cy: [50, 20, 50, 80, 50]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    r="3" fill="#fff" 
                  />
                </svg>
                <div className="absolute bottom-4 left-6 text-[9px] text-zinc-500 uppercase tracking-[0.3em] font-bold">Vector Scope v2</div>
             </div>
             
             <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl">
                <div className="text-[9px] text-zinc-400 uppercase tracking-widest mb-4 font-bold">Pilot Status</div>
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[8px] font-mono opacity-50">
                        <span>CHANNEL_{i}</span>
                        <span>0.{i * 2}ms</span>
                      </div>
                      <div className="w-full h-1 bg-white/5 overflow-hidden">
                        <motion.div 
                          animate={{ x: [-100, 100] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
                          className="w-1/2 h-full bg-blue-400/30" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>

          {/* Center: Game Canvas */}
          <div className="relative rounded-3xl overflow-hidden border-8 border-zinc-900 shadow-[20px_20px_60px_#000,-20px_-20px_60px_#000]">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="bg-black block"
            />

            {/* Scanline Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20" style={{ backgroundSize: '100% 4px, 3px 100%' }}></div>
            
            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,1)] z-20"></div>

            {/* Current Score Overlay */}
            <div className="absolute top-6 right-8 pointer-events-none z-30">
              <div className="text-[10px] font-mono text-blue-400/50 text-right font-bold uppercase tracking-widest">DRIVE_SCORE</div>
              <div className="text-4xl font-black text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] italic">{score.toLocaleString()}</div>
            </div>

            {/* Bottom Controls Hint */}
            <div className="absolute bottom-6 left-0 right-0 z-30 px-8 flex justify-between items-center pointer-events-none opacity-50">
               <div className="flex gap-2">
                  <div className="w-7 h-7 rounded border border-white/20 bg-black/40 flex items-center justify-center text-[10px] font-bold">A</div>
                  <div className="w-7 h-7 rounded border border-white/20 bg-black/40 flex items-center justify-center text-[10px] font-bold">D</div>
               </div>
               <div className="flex gap-2">
                  <div className="w-7 h-7 rounded border border-white/20 bg-black/40 flex items-center justify-center text-[10px] font-bold text-blue-400">←</div>
                  <div className="w-7 h-7 rounded border border-white/20 bg-black/40 flex items-center justify-center text-[10px] font-bold text-blue-400">→</div>
               </div>
            </div>

            {/* Screen Transitions */}
            <AnimatePresence>
              {gameState === 'START' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-40"
                >
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="mb-10 relative"
                  >
                    <div className="absolute -inset-12 bg-blue-500/20 blur-3xl rounded-full" />
                    <Play className="w-24 h-24 text-blue-400 relative z-10 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
                  </motion.div>
                  <h2 className="text-5xl font-black uppercase tracking-tighter mb-4 italic text-white">Initialize?</h2>
                  <p className="text-zinc-500 text-sm font-mono mb-10 tracking-widest max-w-[200px]">NEO_SYSTEMS // READY FOR DEPLOYMENT</p>
                  <button
                    onClick={startGame}
                    className="group relative px-12 py-4 bg-blue-600 text-white font-black uppercase tracking-[0.2em] rounded-xl transition-all hover:bg-blue-500 hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.3)]"
                  >
                    <span className="relative z-10">Ignition</span>
                    <div className="absolute inset-0 bg-blue-400 blur-xl opacity-0 group-hover:opacity-40 transition-opacity" />
                  </button>
                </motion.div>
              )}

              {gameState === 'GAMEOVER' && (
                <motion.div
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-red-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center z-40 border-[20px] border-red-500/10"
                >
                  <Zap className="w-20 h-20 text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
                  <h2 className="text-6xl font-black uppercase tracking-tighter mb-2 italic text-red-500">Critical Fail</h2>
                  <div className="mb-10 mt-6 bg-black/40 p-6 rounded-2xl border border-red-500/20 w-full">
                    <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.3em] mb-2">Final Telemetry</p>
                    <p className="text-5xl font-black text-white italic tracking-tighter">{score.toLocaleString()}</p>
                  </div>
                  
                  <AnimatePresence>
                    {score >= highScore && score > 0 && (
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="flex items-center gap-3 mb-10 bg-blue-500/20 text-blue-400 px-6 py-3 rounded-full border border-blue-500/30 backdrop-blur-md"
                      >
                        <Trophy className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-[0.2em]">Record Updated</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={startGame}
                    className="flex justify-center items-center gap-4 px-10 py-5 bg-white text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-500 hover:text-white transition-all transform hover:-translate-y-1 active:translate-y-0 shadow-2xl"
                  >
                    <RotateCcw className="w-6 h-6" />
                    Reset
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Side: Telemetry/Gauges Style */}
          <div className="hidden lg:flex flex-col justify-between w-64 py-4">
             <div className="flex flex-col items-end">
                <div className="text-zinc-500 text-[10px] font-bold uppercase mb-1 tracking-[0.3em]">GEAR_S</div>
                <motion.div 
                  key={Math.floor(score/100)}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-[120px] leading-none font-black text-white italic drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  {Math.min(6, Math.floor(score/200) + 1)}
                </motion.div>
             </div>

             <div className="flex flex-col items-end gap-6">
                <div className="flex flex-col items-end">
                   <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-6xl font-mono font-black text-white tabular-nums drop-shadow-[0_0_20px_rgba(37,99,235,0.2)]">{(engineRef.current.speed * 25).toFixed(0)}</span>
                      <span className="text-sm font-black text-zinc-500 uppercase italic tracking-widest">km/h</span>
                   </div>
                   <div className="relative w-full h-16 flex items-end gap-1 px-1">
                      {[...Array(15)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 h-${Math.floor(4 + i*0.8)} rounded-sm transition-all duration-300 ${
                            i < 10 ? (gameState === 'PLAYING' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-zinc-800') : 'bg-red-600/30'
                          }`}
                          style={{ height: `${20 + i * 5}%`, opacity: i < (engineRef.current.speed * 1.5) ? 1 : 0.2 }}
                        ></div>
                      ))}
                   </div>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl w-full">
                   <div className="text-[9px] text-emerald-400 uppercase tracking-widest mb-4 font-bold">Signal Quality</div>
                   <div className="flex gap-1 h-3 items-end">
                      {[...Array(8)].map((_, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: [`${30 + Math.random()*70}%`, `${30 + Math.random()*70}%`] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                          className="flex-1 bg-emerald-500/40 rounded-t-sm" 
                        />
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Bottom Metadata */}
        <div className="w-full flex justify-between items-center mt-12 px-10 opacity-30">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span className="text-[10px] font-mono tracking-widest uppercase">Encryption_STD</span>
             </div>
             <div className="text-[10px] font-mono tracking-widest uppercase">v0.7.22_STABLE</div>
          </div>
          <div className="text-[10px] font-mono tracking-[0.5em] uppercase italic">
            Neo Drive Systems // Hyperion
          </div>
        </div>
      </div>
    </div>

  );
}
