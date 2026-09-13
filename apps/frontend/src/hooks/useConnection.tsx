import { useContext } from "react";
import { ConnectionContext, type ConnectionContexType } from "../contexts/ConnectionContext";

export function useConnection(): ConnectionContexType {
  const context = useContext(ConnectionContext);

  if (!context) throw new Error('useConnection must be used in a ConnectionProvider');

  return context;
}
