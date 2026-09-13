import { createContext } from "react";
import type { ConnectionSettings } from "../types/User";
import type { Socket } from "socket.io-client";

export interface ConnectionContexType {
  ping: () => Promise<number>;

  conn?: ConnectionSettings;
  editConn: (val: Partial<ConnectionSettings>) => void;

  socket?: Socket;
}

export const ConnectionContext = createContext<ConnectionContexType | undefined>(undefined);
