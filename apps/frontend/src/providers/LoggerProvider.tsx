import { useRef, useState, type ReactNode } from "react";
import { LoggerContext } from "../contexts/LoggerContext";
import { Snackbar } from "@mui/material";

export function LoggerProvider({ children }: { children: ReactNode }) {

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string>()
  const [logHistory, setLogHistory] = useState<string[]>([])

  const safeStringify = (data: any): string => {
    if (typeof data === 'string') return data;
    if (data instanceof Error) return data.stack || data.message;
    if (typeof data === 'undefined') return 'undefined';

    const seen = new WeakSet();
    try {
      return JSON.stringify(
        data,
        (key, value) => {
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
    anyLog(...data)
  }

  function debug(...data: any[]) {
    console.debug(...data)
    anyLog(...data)
  }

  function warn(...data: any[]) {
    console.warn(...data)
    anyLog(...data)
  }

  function error(...data: any[]) {
    console.error(...data)
    anyLog(...data)
  }


  return <LoggerContext.Provider value={{ log, debug, error, warn, history: logHistory }}>
    {children}
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={() => setOpen(false)}
      message={message}
    />
  </LoggerContext.Provider>
}

