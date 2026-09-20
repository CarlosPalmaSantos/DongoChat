import { createContext } from "react";
import type { ConnectionSettings } from "../types/User";
import type { Socket } from "socket.io-client";
import type { Chat } from "../types/Chat";
import type { Message, User } from "dongo-shared";
import type { ConnStatus } from "../providers/ConnectionProvider";

export interface ConnectionContexType {
  ping: () => Promise<number>;

  conn?: ConnectionSettings;
  editConn: (val: Partial<ConnectionSettings>) => void;
  editUser: (val: User) => void;

  socket?: Socket;
  status: ConnStatus;
  forceReconnect: () => void;

  chats: Record<string, Chat>;
  editChat: (chat: Chat) => void;
  sendMessage: (chat: Chat, message: Message) => Promise<Message>;
}

export const ConnectionContext = createContext<ConnectionContexType | undefined>(undefined);
