import { createContext } from "react";
import type { ConnectionSettings } from "../types/User";

export interface ConnectionContexType {
  ping: () => Promise<number>;

  conn?: ConnectionSettings;
  editConn: (val: Partial<ConnectionSettings>) => void;
}

export const ConnectionContext = createContext<ConnectionContexType | undefined>(undefined);
