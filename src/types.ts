export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR';

export interface Position {
  x: number;
  y: number;
}

export interface Gate {
  id: string;
  type: GateType;
  position: Position;
  inputs: (string | null)[]; // IDs of gates or switches connected to inputs
  outputValue: boolean;
}

export interface Switch {
  id: string;
  position: Position;
  value: boolean;
}

export interface Bulb {
  id: string;
  position: Position;
  inputValue: boolean;
  connectedTo: string | null;
}

export interface Connection {
  fromId: string; // ID of Gate or Switch
  toId: string;   // ID of Gate or Bulb
  toInputIndex: number; // 0 or 1 for gates, 0 for bulbs
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  targetTruthTable: { inputs: boolean[], output: boolean }[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  solution?: string;
}
