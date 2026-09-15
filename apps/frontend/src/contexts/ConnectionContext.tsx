import { createContext } from "react";
import type { ConnectionSettings } from "../types/User";
import type { Socket } from "socket.io-client";
import type { Chat } from "../types/Chat";
import type { User } from "dongo-shared";

export interface ConnectionContexType {
  ping: () => Promise<number>;

  conn?: ConnectionSettings;
  editConn: (val: Partial<ConnectionSettings>) => void;
  editUser: (val: User) => void;

  socket?: Socket;
  chats: Record<string, Chat>;
  editChat: (chat: Chat) => void;
}

export const ConnectionContext = createContext<ConnectionContexType | undefined>(undefined);
