import { useContext } from "react";
import { LoggerContext, type LoggerContextType } from "../contexts/LoggerContext";

export function useLog(): LoggerContextType {
  const context = useContext(LoggerContext);

  if (!context) throw new Error('useConnection must be used in a LoggerProvider');

  return context;
}
