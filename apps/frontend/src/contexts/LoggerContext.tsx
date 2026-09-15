import { createContext } from "react";

export interface LoggerContextType {
  log: (...data: any[]) => void;
  debug: (...data: any[]) => void;
  warn: (...data: any[]) => void;
  error: (...data: any[]) => void;
  history: string[];
  showLevel: 'none' | 'error' | 'warn' | 'log' | 'debug'
  setShowLevel: (level: 'none' | 'error' | 'warn' | 'log' | 'debug') => void
}

export const LoggerContext = createContext<LoggerContextType | undefined>(undefined)
