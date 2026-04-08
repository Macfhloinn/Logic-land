/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Lightbulb, 
  ToggleLeft, 
  ToggleRight, 
  Plus, 
  Trash2, 
  Play, 
  RotateCcw, 
  HelpCircle,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react';
import { Gate, GateType, Position, Switch, Bulb, Connection, Challenge } from './types';
import { GATE_CONFIGS, CHALLENGES } from './constants';

const GRID_SIZE = 20;

export default function App() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [switches, setSwitches] = useState<Switch[]>([
    { id: 'sw-1', position: { x: 80, y: 120 }, value: false },
    { id: 'sw-2', position: { x: 80, y: 240 }, value: false },
  ]);
  const [bulbs, setBulbs] = useState<Bulb[]>([
    { id: 'bulb-1', position: { x: 750, y: 220 }, inputValue: false, connectedTo: null },
  ]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [dragItem, setDragItem] = useState<{ type: 'gate' | 'switch' | 'bulb', id: string } | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ id: string, type: 'output' } | null>(null);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  
  const boardRef = useRef<HTMLDivElement>(null);

  // Logic calculation
  const calculateLogic = useCallback(() => {
    const newGates = [...gates];
    const newBulbs = [...bulbs];
    
    let changed = true;
    let iterations = 0;
    const maxIterations = 30;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      newGates.forEach(gate => {
        const inputValues = gate.inputs.map(inputId => {
          if (!inputId) return false;
          const sw = switches.find(s => s.id === inputId);
          if (sw) return sw.value;
          const otherGate = newGates.find(g => g.id === inputId);
          if (otherGate) return otherGate.outputValue;
          return false;
        });

        let result = false;
        switch (gate.type) {
          case 'AND': result = inputValues[0] && inputValues[1]; break;
          case 'OR': result = inputValues[0] || inputValues[1]; break;
          case 'NOT': result = !inputValues[0]; break;
          case 'NAND': result = !(inputValues[0] && inputValues[1]); break;
          case 'NOR': result = !(inputValues[0] || inputValues[1]); break;
          case 'XOR': result = inputValues[0] !== inputValues[1]; break;
        }

        if (gate.outputValue !== result) {
          gate.outputValue = result;
          changed = true;
        }
      });
    }

    newBulbs.forEach(bulb => {
      if (bulb.connectedTo) {
        const sw = switches.find(s => s.id === bulb.connectedTo);
        if (sw) bulb.inputValue = sw.value;
        const gate = newGates.find(g => g.id === bulb.connectedTo);
        if (gate) bulb.inputValue = gate.outputValue;
      } else {
        bulb.inputValue = false;
      }
    });

    setGates(newGates);
    setBulbs(newBulbs);
  }, [gates, switches, bulbs]);

  useEffect(() => {
    calculateLogic();
  }, [switches, connections]);

  // Challenge validation
  useEffect(() => {
    if (activeChallenge) {
      const isComplete = activeChallenge.targetTruthTable.every(test => {
        // Map test inputs to switches
        const testSwitches = switches.map((s, idx) => ({ ...s, value: test.inputs[idx] || false }));
        
        let tempGates = gates.map(g => ({ ...g, outputValue: false }));
        let changed = true;
        let iter = 0;
        while (changed && iter < 15) {
          changed = false;
          iter++;
          tempGates.forEach(gate => {
            const inputValues = gate.inputs.map(inputId => {
              if (!inputId) return false;
              const sw = testSwitches.find(s => s.id === inputId);
              if (sw) return sw.value;
              const otherGate = tempGates.find(g => g.id === inputId);
              if (otherGate) return otherGate.outputValue;
              return false;
            });
            let result = false;
            switch (gate.type) {
              case 'AND': result = inputValues[0] && inputValues[1]; break;
              case 'OR': result = inputValues[0] || inputValues[1]; break;
              case 'NOT': result = !inputValues[0]; break;
              case 'NAND': result = !(inputValues[0] && inputValues[1]); break;
              case 'NOR': result = !(inputValues[0] || inputValues[1]); break;
              case 'XOR': result = inputValues[0] !== inputValues[1]; break;
            }
            if (gate.outputValue !== result) {
              gate.outputValue = result;
              changed = true;
            }
          });
        }

        const bulbResult = bulbs[0].connectedTo ? 
          (testSwitches.find(s => s.id === bulbs[0].connectedTo)?.value || 
           tempGates.find(g => g.id === bulbs[0].connectedTo)?.outputValue || false) : false;

        return bulbResult === test.output;
      });

      if (isComplete && !isSuccess && connections.length > 0) {
        setIsSuccess(true);
      }
    }
  }, [gates, connections, activeChallenge, switches, bulbs]);

  const addGate = (type: GateType) => {
    const newGate: Gate = {
      id: `gate-${Date.now()}`,
      type,
      position: { x: 350, y: 200 },
      inputs: Array(GATE_CONFIGS[type].inputs).fill(null),
      outputValue: false,
    };
    setGates([...gates, newGate]);
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'gate' | 'switch' | 'bulb', id: string) => {
    setDragItem({ type, id });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (!dragItem) return;
    const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;

    if (dragItem.type === 'gate') {
      setGates(gates.map(g => g.id === dragItem.id ? { ...g, position: { x: snappedX, y: snappedY } } : g));
    } else if (dragItem.type === 'switch') {
      setSwitches(switches.map(s => s.id === dragItem.id ? { ...s, position: { x: snappedX, y: snappedY } } : s));
    } else if (dragItem.type === 'bulb') {
      setBulbs(bulbs.map(b => b.id === dragItem.id ? { ...b, position: { x: snappedX, y: snappedY } } : b));
    }
  };

  const handleMouseUp = () => {
    setDragItem(null);
  };

  const connect = (fromId: string, toId: string, inputIndex: number) => {
    if (fromId === toId) return;

    const newConnection: Connection = { fromId, toId, toInputIndex: inputIndex };
    setConnections([...connections.filter(c => !(c.toId === toId && c.toInputIndex === inputIndex)), newConnection]);

    if (toId.startsWith('gate')) {
      setGates(gates.map(g => {
        if (g.id === toId) {
          const newInputs = [...g.inputs];
          newInputs[inputIndex] = fromId;
          return { ...g, inputs: newInputs };
        }
        return g;
      }));
    } else if (toId.startsWith('bulb')) {
      setBulbs(bulbs.map(b => b.id === toId ? { ...b, connectedTo: fromId } : b));
    }
    setConnectingFrom(null);
  };

  const deleteItem = (id: string) => {
    if (connectingFrom?.id === id) setConnectingFrom(null);
    setGates(gates.filter(g => g.id !== id));
    setConnections(connections.filter(c => c.fromId !== id && c.toId !== id));
    setBulbs(bulbs.map(b => b.connectedTo === id ? { ...b, connectedTo: null, inputValue: false } : b));
    setGates(prev => prev.map(g => ({
      ...g,
      inputs: g.inputs.map(inp => inp === id ? null : inp)
    })));
  };

  const resetBoard = () => {
    setGates([]);
    setConnections([]);
    setBulbs(bulbs.map(b => ({ ...b, connectedTo: null, inputValue: false })));
    setIsSuccess(false);
    setConnectingFrom(null);
  };

  const startChallenge = (challenge: Challenge) => {
    setActiveChallenge(challenge);
    setShowSolution(false);
    const numSwitches = challenge.targetTruthTable[0].inputs.length;
    const newSwitches: Switch[] = Array.from({ length: numSwitches }, (_, i) => ({
      id: `sw-${i + 1}`,
      position: { x: 80, y: 100 + (i * 120) },
      value: false
    }));
    setSwitches(newSwitches);
    resetBoard();
    setShowChallengeModal(false);
  };

  const getOutputPosition = (item: Gate | Switch) => {
    if ('type' in item) { // Gate
      return { x: item.position.x + 110, y: item.position.y + 40 };
    } else { // Switch
      return { x: item.position.x + 70, y: item.position.y + 25 };
    }
  };

  const getInputPosition = (item: Gate | Bulb, index: number) => {
    if ('type' in item) { // Gate
      const offset = GATE_CONFIGS[item.type].inputs === 1 ? 40 : (index === 0 ? 25 : 55);
      return { x: item.position.x - 10, y: item.position.y + offset };
    } else { // Bulb
      return { x: item.position.x - 10, y: item.position.y + 32 };
    }
  };

  const isWireActive = (fromId: string) => {
    const sw = switches.find(s => s.id === fromId);
    if (sw) return sw.value;
    const gate = gates.find(g => g.id === fromId);
    if (gate) return gate.outputValue;
    return false;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#FFF9E6] overflow-hidden text-slate-900">
      {/* Header */}
      <header className="h-24 border-b-4 border-[#FFD93D] bg-white flex items-center justify-between px-10 z-30 shadow-[0_4px_0_0_#FFD93D]">
        <div className="flex items-center gap-5">
          <motion.div 
            whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
            className="w-14 h-14 bg-[#FF6B6B] rounded-[20px] flex items-center justify-center text-white shadow-[0_6px_0_0_#EE5253]"
          >
            <Zap size={32} fill="currentColor" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-black text-[#2D3436] tracking-tight">LOGIC LAND 🎡</h1>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#4ECDC4] animate-pulse" />
              <p className="text-xs font-bold text-[#636E72] uppercase tracking-widest">Ready to Play!</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <AnimatePresence mode="wait">
            {activeChallenge && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-4 px-8 py-3 bg-[#2D3436] rounded-[25px] shadow-xl"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[#B2BEC3] uppercase tracking-widest">Current Level</span>
                  <span className="text-base font-black text-white">{activeChallenge.title}</span>
                </div>
                <div className="h-10 w-1 bg-[#636E72] mx-2 rounded-full" />
                {isSuccess ? (
                  <motion.span 
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1.2 }}
                    className="flex items-center gap-2 text-[#55E6C1] text-sm font-black uppercase tracking-wider"
                  >
                    <CheckCircle2 size={22} /> WINNER!
                  </motion.span>
                ) : (
                  <span className="text-xs text-[#A8D8EA] font-mono animate-pulse">Thinking... 🤔</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={() => setShowChallengeModal(true)}
            className="bubbly-button flex items-center gap-3 px-8 py-4 bg-[#4ECDC4] text-white rounded-[25px] text-lg font-black shadow-[0_6px_0_0_#45B7AF] hover:translate-y-[-2px] hover:shadow-[0_8px_0_0_#45B7AF]"
          >
            <HelpCircle size={24} />
            LEVELS
          </button>
          
          <button 
            onClick={resetBoard}
            className="bubbly-button p-4 bg-[#FF6B6B] text-white rounded-[25px] shadow-[0_6px_0_0_#EE5253] hover:translate-y-[-2px] hover:shadow-[0_8px_0_0_#EE5253]"
            title="Start Over"
          >
            <RotateCcw size={24} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Toolbox */}
        <aside className="w-80 border-r-4 border-[#FFD93D] bg-white p-8 overflow-y-auto z-20 shadow-2xl">
          <h2 className="text-xs font-black text-[#B2BEC3] uppercase tracking-[0.2em] mb-6">Magic Blocks ✨</h2>
          <div className="grid grid-cols-1 gap-5 mb-12">
            {(Object.keys(GATE_CONFIGS) as GateType[]).map(type => (
              <motion.button
                key={type}
                whileHover={{ x: 8, scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => addGate(type)}
                className="group flex items-center justify-between p-5 rounded-[25px] border-2 border-slate-100 bg-slate-50/50 hover:border-[#4ECDC4] hover:bg-[#F7FFF7] transition-all text-left shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-[18px] ${GATE_CONFIGS[type].color} flex items-center justify-center text-white font-black text-sm shadow-[0_4px_0_0_rgba(0,0,0,0.1)]`}>
                    {type}
                  </div>
                  <div>
                    <span className="block text-base font-black text-[#2D3436]">{type} Gate</span>
                    <span className="text-[10px] text-[#636E72] font-bold uppercase tracking-wider">Logic Block</span>
                  </div>
                </div>
                <Plus size={20} className="text-slate-300 group-hover:text-[#4ECDC4]" />
              </motion.button>
            ))}
          </div>

          <h2 className="text-xs font-black text-[#B2BEC3] uppercase tracking-[0.2em] mb-6">Tools 🛠️</h2>
          <div className="space-y-5 mb-12">
            <div className="p-6 rounded-[30px] border-2 border-slate-100 bg-white flex items-center gap-5 shadow-sm">
              <div className="w-12 h-12 rounded-[18px] bg-[#F7FFF7] border-2 border-[#4ECDC4] flex items-center justify-center text-[#4ECDC4]">
                <ToggleRight size={28} />
              </div>
              <div>
                <span className="block text-sm font-black text-[#2D3436]">Switch</span>
                <span className="text-[10px] text-[#636E72] font-bold">Turn it on!</span>
              </div>
            </div>
            <div className="p-6 rounded-[30px] border-2 border-slate-100 bg-white flex items-center gap-5 shadow-sm">
              <div className="w-12 h-12 rounded-[18px] bg-[#FFF9E6] border-2 border-[#FFE66D] flex items-center justify-center text-[#FFE66D]">
                <Lightbulb size={28} />
              </div>
              <div>
                <span className="block text-sm font-black text-[#2D3436]">Bulb</span>
                <span className="text-[10px] text-[#636E72] font-bold">Make it glow!</span>
              </div>
            </div>
          </div>

          {activeChallenge && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-[35px] bg-[#FFD93D] text-[#2D3436] shadow-xl border-b-4 border-[#E6C235]"
            >
              <div className="flex items-center gap-3 mb-4">
                <Info size={20} className="text-[#2D3436]" />
                <h3 className="text-xs font-black uppercase tracking-widest">Your Goal 🎯</h3>
              </div>
              <p className="text-sm leading-relaxed font-bold opacity-90 mb-6">{activeChallenge.description}</p>
              
              <button
                onClick={() => setShowSolution(true)}
                className="w-full py-3 bg-white/50 hover:bg-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2 border-[#2D3436]/10 hover:border-[#2D3436]/20"
              >
                See Solution 💡
              </button>
            </motion.div>
          )}
        </aside>

        {/* Main Board */}
        <main 
          ref={boardRef}
          className="flex-1 relative circuit-grid overflow-hidden cursor-crosshair bg-[#f8fafc]"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* SVG Layer for Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <filter id="wire-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="wire-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
            
            {connections.map((conn, idx) => {
              const from = switches.find(s => s.id === conn.fromId) || gates.find(g => g.id === conn.fromId);
              const to = gates.find(g => g.id === conn.toId) || bulbs.find(b => b.id === conn.toId);
              
              if (!from || !to) return null;
              
              const start = getOutputPosition(from);
              const end = getInputPosition(to, conn.toInputIndex);
              const isActive = isWireActive(conn.fromId);
              
              const dx = Math.abs(end.x - start.x) * 0.6;
              const path = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`;
              
              return (
                <g key={idx}>
                  <path
                    d={path}
                    stroke={isActive ? 'url(#wire-grad)' : '#e2e8f0'}
                    strokeWidth={isActive ? "4" : "3"}
                    fill="none"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                    filter={isActive ? 'url(#wire-glow)' : ''}
                  />
                  {isActive && (
                    <circle r="4" fill="#fff" className="shadow-lg">
                      <animateMotion dur="1.5s" repeatCount="indefinite" path={path} />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Temporary connection line */}
            {connectingFrom && (() => {
              const fromItem = switches.find(s => s.id === connectingFrom.id) || gates.find(g => g.id === connectingFrom.id);
              if (!fromItem) return null;
              const start = getOutputPosition(fromItem);
              return (
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                  className="animate-[dash_1s_linear_infinite]"
                />
              );
            })()}
          </svg>

          {/* Switches */}
          {switches.map(sw => (
            <motion.div
              key={sw.id}
              initial={false}
              animate={{ x: sw.position.x, y: sw.position.y }}
              onMouseDown={(e) => handleMouseDown(e, 'switch', sw.id)}
              className="absolute w-24 h-16 bg-white border-4 border-[#FFD93D] rounded-[25px] shadow-xl flex items-center justify-between px-4 cursor-grab active:cursor-grabbing z-20 group"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSwitches(switches.map(s => s.id === sw.id ? { ...s, value: !s.value } : s));
                }}
                className={`w-12 h-7 rounded-full flex items-center px-1 transition-all duration-300 ${sw.value ? 'bg-[#4ECDC4] shadow-inner' : 'bg-slate-200'}`}
              >
                <motion.div 
                  animate={{ x: sw.value ? 20 : 0 }}
                  className="w-5 h-5 bg-white rounded-full shadow-md" 
                />
              </button>
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setConnectingFrom({ id: sw.id, type: 'output' });
                }}
                className="w-8 h-8 rounded-full bg-[#F7FFF7] border-2 border-[#4ECDC4] flex items-center justify-center text-[#4ECDC4] hover:bg-[#4ECDC4] hover:text-white transition-all group-hover:scale-110 shadow-sm"
                title="Connect Output"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-current" />
              </button>
            </motion.div>
          ))}

          {/* Gates */}
          {gates.map(gate => (
            <motion.div
              key={gate.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, x: gate.position.x, y: gate.position.y }}
              onMouseDown={(e) => handleMouseDown(e, 'gate', gate.id)}
              className="absolute w-32 h-28 bg-white border-4 border-slate-100 rounded-[35px] shadow-2xl flex flex-col items-center justify-center cursor-grab active:cursor-grabbing z-20 group"
            >
              <button
                onClick={(e) => { e.stopPropagation(); deleteItem(gate.id); }}
                className="absolute -top-3 -right-3 w-10 h-10 bg-white text-[#FF6B6B] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl border-2 border-slate-50 hover:bg-[#FF6B6B] hover:text-white"
              >
                <Trash2 size={18} />
              </button>

              <div className={`px-5 py-2 rounded-[18px] mb-4 text-white font-black text-xs tracking-widest uppercase shadow-lg ${GATE_CONFIGS[gate.type].color}`}>
                {gate.type}
              </div>

              <div className="flex justify-between w-full px-3">
                <div className="flex flex-col gap-4">
                  {gate.inputs.map((_, idx) => (
                    <button
                      key={idx}
                      onMouseUp={() => connectingFrom && connect(connectingFrom.id, gate.id, idx)}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${gate.inputs[idx] ? 'bg-[#4ECDC4] border-[#95E1D3] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#4ECDC4]'}`}
                      title={`Input ${idx + 1}`}
                    >
                      <div className="w-2 h-2 rounded-full bg-current" />
                    </button>
                  ))}
                </div>
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setConnectingFrom({ id: gate.id, type: 'output' });
                  }}
                  className={`w-7 h-7 rounded-full border-2 self-center flex items-center justify-center transition-all ${gate.outputValue ? 'bg-[#4ECDC4] border-[#95E1D3] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#4ECDC4]'}`}
                  title="Output"
                >
                  <div className="w-2 h-2 rounded-full bg-current" />
                </button>
              </div>
            </motion.div>
          ))}

          {/* Bulbs */}
          {bulbs.map(bulb => (
            <motion.div
              key={bulb.id}
              initial={false}
              animate={{ x: bulb.position.x, y: bulb.position.y }}
              onMouseDown={(e) => handleMouseDown(e, 'bulb', bulb.id)}
              className="absolute w-24 h-24 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing z-20"
            >
              <div className="relative group">
                <motion.div
                  animate={{ 
                    scale: bulb.inputValue ? [1, 1.15, 1] : 1,
                    rotate: bulb.inputValue ? [0, 5, -5, 0] : 0
                  }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Lightbulb 
                    size={80} 
                    className={`transition-all duration-500 ${bulb.inputValue ? 'text-[#FFE66D] fill-[#FFE66D] drop-shadow-[0_0_40px_rgba(255,230,109,0.8)]' : 'text-slate-200'}`} 
                  />
                </motion.div>
                <button
                  onMouseUp={() => connectingFrom && connect(connectingFrom.id, bulb.id, 0)}
                  className={`absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${bulb.connectedTo ? 'bg-[#4ECDC4] border-[#95E1D3] text-white' : 'bg-slate-50 border-slate-200 hover:border-[#4ECDC4]'}`}
                  title="Connect Input"
                >
                  <div className="w-2 h-2 rounded-full bg-current" />
                </button>
              </div>
            </motion.div>
          ))}
        </main>
      </div>

      {/* Challenge Modal */}
      <AnimatePresence>
        {showChallengeModal && (
          <div className="fixed inset-0 bg-[#2D3436]/60 backdrop-blur-xl flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="bg-white rounded-[50px] shadow-2xl w-full max-w-4xl overflow-hidden border-8 border-[#FFD93D]"
            >
              <div className="p-12 border-b-4 border-[#FFF9E6] flex justify-between items-center bg-[#FFF9E6]/50">
                <div>
                  <h2 className="text-4xl font-black text-[#2D3436] tracking-tight">LEVEL SELECT 🚀</h2>
                  <p className="text-[#636E72] font-bold text-lg">Pick a mission and start building!</p>
                </div>
                <button 
                  onClick={() => setShowChallengeModal(false)} 
                  className="w-16 h-16 rounded-[25px] bg-white border-4 border-[#FFD93D] flex items-center justify-center text-[#2D3436] hover:bg-[#FFD93D] transition-all shadow-lg bubbly-button"
                >
                  <XCircle size={32} />
                </button>
              </div>
              <div className="p-12 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto bg-white">
                {CHALLENGES.map(challenge => (
                  <motion.button
                    key={challenge.id}
                    whileHover={{ y: -8, scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => startChallenge(challenge)}
                    className="p-10 rounded-[40px] border-4 border-slate-50 bg-slate-50/30 hover:border-[#4ECDC4] hover:bg-[#F7FFF7] transition-all text-left group relative overflow-hidden shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <span className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-sm ${
                        challenge.difficulty === 'Easy' ? 'bg-[#55E6C1] text-white' : 
                        challenge.difficulty === 'Medium' ? 'bg-[#FFE66D] text-[#2D3436]' : 
                        'bg-[#FF6B6B] text-white'
                      }`}>
                        {challenge.difficulty}
                      </span>
                      <div className="w-12 h-12 rounded-[20px] bg-white border-2 border-slate-100 flex items-center justify-center text-slate-200 group-hover:text-[#4ECDC4] group-hover:border-[#4ECDC4] transition-all shadow-md">
                        <Play size={24} fill="currentColor" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-[#2D3436] mb-3">{challenge.title}</h3>
                    <p className="text-sm text-[#636E72] leading-relaxed font-bold opacity-80 mb-4">{challenge.description}</p>
                    
                    {challenge.solution && (
                      <div className="mt-auto pt-4 border-t-2 border-slate-100/50">
                        <p className="text-[10px] font-black text-[#4ECDC4] uppercase tracking-widest mb-1">Sneak Peek Solution 💡</p>
                        <p className="text-[10px] text-slate-400 font-bold line-clamp-1 italic">{challenge.solution}</p>
                      </div>
                    )}
                    
                    {/* Decorative background element */}
                    <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-[#4ECDC4]/5 rounded-full blur-3xl group-hover:bg-[#4ECDC4]/10 transition-all" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Solution Modal */}
      <AnimatePresence>
        {showSolution && activeChallenge && (
          <div className="fixed inset-0 bg-[#2D3436]/60 backdrop-blur-xl flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 50 }}
              className="bg-white rounded-[50px] shadow-2xl w-full max-w-lg overflow-hidden border-8 border-[#4ECDC4]"
            >
              <div className="p-10 border-b-4 border-[#F7FFF7] flex justify-between items-center bg-[#F7FFF7]">
                <div>
                  <h2 className="text-3xl font-black text-[#2D3436] tracking-tight">HINT 💡</h2>
                  <p className="text-[#636E72] font-bold">Here is how to solve it!</p>
                </div>
                <button 
                  onClick={() => setShowSolution(false)} 
                  className="w-12 h-12 rounded-[20px] bg-white border-4 border-[#4ECDC4] flex items-center justify-center text-[#2D3436] hover:bg-[#4ECDC4] hover:text-white transition-all shadow-lg bubbly-button"
                >
                  <XCircle size={24} />
                </button>
              </div>
              <div className="p-10 bg-white">
                <p className="text-lg font-bold text-[#2D3436] leading-relaxed">
                  {activeChallenge.solution || "No solution available for this level yet!"}
                </p>
                <button
                  onClick={() => setShowSolution(false)}
                  className="w-full mt-8 py-4 bg-[#4ECDC4] text-white rounded-[25px] text-lg font-black shadow-[0_6px_0_0_#45B7AF] bubbly-button"
                >
                  GOT IT! 👍
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Overlay */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 100 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-[#2D3436] text-white px-12 py-8 rounded-[45px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-8 z-50 border-4 border-[#55E6C1]"
          >
            <div className="w-20 h-20 bg-[#55E6C1] rounded-[30px] flex items-center justify-center shadow-lg animate-bounce">
              <CheckCircle2 size={48} />
            </div>
            <div>
              <h3 className="text-3xl font-black tracking-tight mb-1">YOU DID IT! 🎉</h3>
              <p className="text-lg font-bold text-[#B2BEC3]">Your circuit is working perfectly!</p>
              <button 
                onClick={() => setShowSolution(true)}
                className="mt-2 text-xs font-black text-[#4ECDC4] uppercase tracking-widest hover:text-[#55E6C1] transition-colors"
              >
                See Official Solution 💡
              </button>
            </div>
            <button 
              onClick={() => { setIsSuccess(false); setShowChallengeModal(true); }}
              className="ml-8 px-10 py-5 bg-[#4ECDC4] text-white rounded-[25px] text-lg font-black shadow-[0_6px_0_0_#45B7AF] hover:translate-y-[-2px] hover:shadow-[0_8px_0_0_#45B7AF] transition-all bubbly-button"
            >
              NEXT LEVEL 🚀
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
