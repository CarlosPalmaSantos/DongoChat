import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { loadConnectionSettings, saveConnectionSettings, type ConnectionSettings } from "../types/User";
import { io, Socket } from "socket.io-client";
import { ConnectionContext } from "../contexts/ConnectionContext";
import { getAllChats, saveChatMetadata, saveMessage, type Chat } from "../types/Chat";
import { isComplete, type Message, type User } from "dongo-shared";

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<ConnectionSettings>();
  const [socket, setSocket] = useState<Socket>();
  const [chats, setChats] = useState<Record<string, Chat>>({});

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    loadConnectionSettings().then(setConn);
    getAllChats().then(c => setChats(Object.fromEntries(c.map(c1 => ([c1.uuid, c1])))));
  }, []);

  const saveQueuesRef = useRef<Map<string, Promise<void>>>(new Map());

  const handleIncomingMessage = useCallback(async (d: any) => {
    console.debug('incoming msg', d);

    const chatUuid = d.sender;

    const previousQueue = saveQueuesRef.current.get(chatUuid) ?? Promise.resolve();

    const currentQueue = previousQueue.then(async () => {
      const prevChat = chatsRef.current[chatUuid];

      const currentChat: Chat = prevChat ?? {
        uuid: chatUuid,
        name: chatUuid,
        last: '',
        lastTimestamp: Date.now(),
        pending: 0,
        bunchMaxSize: 100,
        lastBunch: 0,
      };

      const chatToUpdate: Chat = {
        ...currentChat,
        last: d.content,
        lastTimestamp: Date.now(),
        pending: (currentChat.pending ?? 0) + 1,
      };

      const updatedChat = await saveMessage(chatToUpdate, {
        id: d.id,
        timestamp: d.timestamp,
        sender: d.sender,
        receiver: conn!.name!,
        content: d.content,
      });

      // Importante: actualizar el ref inmediatamente
      chatsRef.current = {
        ...chatsRef.current,
        [chatUuid]: updatedChat,
      };

      setChats(prev => ({
        ...prev,
        [chatUuid]: updatedChat,
      }));
    });

    // Guardamos la promesa actual como cola
    saveQueuesRef.current.set(chatUuid, currentQueue);

    try {
      await currentQueue;
    } finally {
      // Solo eliminamos la cola si sigue siendo la última
      if (saveQueuesRef.current.get(chatUuid) === currentQueue) {
        saveQueuesRef.current.delete(chatUuid);
      }
    }

  }, [conn]);

  useEffect(() => {
    if (!socket) return;

    const currentSocket = socket;

    currentSocket.on('inbox-message', handleIncomingMessage);

    return () => {
      currentSocket.off('inbox-message', handleIncomingMessage);
    };
  }, [socket, handleIncomingMessage]);

  useEffect(() => {
    if (!conn) return;

    saveConnectionSettings(conn);
    console.log('conn modified')
    console.log(conn)

    let activeSocket: Socket | undefined; // <- Variable local para atrapar la instancia

    if (conn.ip && conn.user) {
      activeSocket = io(conn.ip, {
        auth: conn.user
      });

      // TODO: Mejorar respuesta de inicio
      activeSocket.once('connected-inbox', (d: Record<string, Message>) => {
        console.log('connected inbox');
        console.log(d)
        Object.values(d).forEach(handleIncomingMessage);
        setSocket(activeSocket); // Actualizamos el estado para los demás componentes
      });

    }

    // Función de limpieza
    return () => {
      activeSocket?.disconnect(); // Desconecta la instancia real que creamos arriba
      setSocket(undefined);
    };
  }, [conn]);

  function emit(event: string, data: unknown) {
    return new Promise((resolve) => {
      socket?.emit(event, data, (res: unknown) => resolve(res));
    });
  }

  async function ping(): Promise<number> {
    const prev = Date.now();
    try {
      const res = (await emit('ping', '')) as string;
      const post = Date.now();
      if (res !== 'pong') return -1;
      return post - prev;
    } catch {
      return -1;
    }
  }

  function editConn(val: Partial<ConnectionSettings>) {
    setConn((prev) => ({ ...prev, ...val }));
  }

  function editUser(val: User) {
    setConn(prev => ({
      ...prev, user: val as User
    }))
  }

  function editChat(chat: Chat) {
    setChats(prev => {
      saveChatMetadata(chat)
      return { ...prev, [chat.uuid]: chat }
    });
  }

  return (
    <ConnectionContext.Provider
      value={{
        ping,
        conn,
        editConn,
        socket,
        chats,
        editChat,
        editUser,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}
