import { useState, type ReactNode } from "react";
import { LoggerContext } from "../contexts/LoggerContext";
import { Snackbar } from "@mui/material";

export function LoggerProvider({ children }: { children: ReactNode }) {

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string>()
  const [logHistory, setLogHistory] = useState<string[]>([])
  const [showLevel, setShowLevel] = useState<'none' | 'error' | 'warn' | 'log' | 'debug'>('error')

  const safeStringify = (data: any): string => {
    if (typeof data === 'string') return data;
    if (data instanceof Error) return data.stack || data.message;
    if (typeof data === 'undefined') return 'undefined';

    const seen = new WeakSet();
    try {
      return JSON.stringify(
        data,
        (_, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
          }
          if (typeof value === 'bigint') return value.toString();
          return value;
        },
        2 // Indentación para legibilidad
      );
    } catch {
      return String(data);
    }
  }; function anyLog(...data: any[]) {
    if (data.length === 0) return;

    const timestamp = new Date().toLocaleTimeString();
    const formattedText = data.map(safeStringify).join(' ');

    const logEntry = `[${timestamp}]   ${formattedText}`;

    setMessage(formattedText);
    setOpen(true);
    setLogHistory((prev) => [...prev, logEntry]);
  }

  function log(...data: any[]) {
    console.log(...data)

    if (showLevel !== 'none' && showLevel !== 'error' && showLevel !== 'warn')
      anyLog(...data)
  }

  function debug(...data: any[]) {
    console.debug(...data)

    if (showLevel !== 'none' && showLevel !== 'error' && showLevel !== 'warn' && showLevel !== 'log')
      anyLog(...data)
  }

  function warn(...data: any[]) {
    console.warn(...data)


    if (showLevel !== 'none' && showLevel !== 'error')
      anyLog(...data)
  }

  function error(...data: any[]) {
    console.error(...data)

    if (showLevel !== 'none')
      anyLog(...data)
  }


  return <LoggerContext.Provider value={{ log, debug, error, warn, history: logHistory, showLevel, setShowLevel }}>
    {children}
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={() => setOpen(false)}
      message={message}
    />
  </LoggerContext.Provider>
}

