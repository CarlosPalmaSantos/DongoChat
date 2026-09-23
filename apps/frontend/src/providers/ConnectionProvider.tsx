import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { saveConnectionSettings, type ConnectionSettings } from "../types/User";
import { io, Socket } from "socket.io-client";
import { ConnectionContext } from "../contexts/ConnectionContext";
import { getAllChats, saveChatMetadata, saveMessage, type Chat } from "../types/Chat";
import { type Message, type User, toUpperCamelCase } from "dongo-shared";
import { useLog } from "../hooks/useLog";
import { Network } from "@capacitor/network";
import { decryptWithStoredKey, bytesToBase64 } from "../types/keys";
export type ConnStatus = {
  type: 'disconnected' | 'idle' | 'connecting' | 'connected' | 'inboxed',
  attempt?: number,
  error?: string
}

export function ConnectionProvider({ children, selectedChat, conn, setConn, onChangeStatus }:
  {
    children: ReactNode,
    selectedChat: Chat | "settings" | null,
    conn: ConnectionSettings | undefined,
    setConn: React.Dispatch<React.SetStateAction<ConnectionSettings | undefined>>,
    onChangeStatus: (status: ConnStatus) => void
  }) {
  const [socket, setSocket] = useState<Socket>();
  // Estado de conexión para la UI: permite distinguir "nunca conectado",
  // "conectado", "reconectando tras una caída" y "desconectado sin
  // reintentos en curso" (p.ej. mientras se agota reconnectionAttempts,
  // que aquí está puesto a Infinity, o justo antes del primer intento).
  const [status, setStatus] = useState<
    ConnStatus
  >({
    type: 'idle'
  });

  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const [chats, setChats] = useState<Record<string, Chat>>({});
  const logger = useLog();

  // Ref estable para el logger: evita que efectos/callbacks dependan
  // de una referencia de logger que puede cambiar en cada render.
  const loggerRef = useRef(logger);
  useEffect(() => {
    loggerRef.current = logger;
  }, [logger]);

  useEffect(() => onChangeStatus(status), [status, onChangeStatus])

  useEffect(() => {
    loggerRef.current.log(`Cambio SC ${selectedChat}`);
  }, [selectedChat]);

  const selectedChatRef = useRef(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const socketRef = useRef<Socket | undefined>(undefined);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const emitSafe = useCallback((event: string, data: unknown) => {
    if (!socketRef.current) {
      loggerRef.current.warn(`Tried to emit '${event}' with no active socket`);
      return;
    }
    socketRef.current.emit(event, data);
  }, []);

  const connRef = useRef<ConnectionSettings | undefined>(undefined);
  useEffect(() => {
    connRef.current = conn;
  }, [conn]);

  useEffect(() => {
    getAllChats().then(c => setChats(Object.fromEntries(c.map(c1 => ([c1.uuid, c1])))));
  }, [conn]);

  const saveQueuesRef = useRef<Map<string, Promise<string>>>(new Map());

  const handleIncomingMessage = useCallback(async (msg: Message & { senderInfo: User }) => {
    loggerRef.current.debug('incoming msg', msg);

    const chatUuid = msg.sender;
    const previousQueue = saveQueuesRef.current.get(chatUuid) ?? Promise.resolve();

    const currentQueue = previousQueue.then(async () => {
      const prevChat = chatsRef.current[chatUuid];

      const currentChat: Chat = prevChat ?? {
        uuid: msg.senderInfo.id,
        name: toUpperCamelCase(msg.senderInfo.name),
        last: '',
        lastTimestamp: Date.now(),
        pending: 0,
        bunchMaxSize: 100,
        lastBunch: 0,
      };

      const chatToUpdate: Chat = {
        ...currentChat,
        last: msg.content,
        lastTimestamp: Date.now(),
        pending: (currentChat.pending ?? 0) + ((!selectedChatRef.current || selectedChatRef.current !== msg.sender) ? 1 : 0),
      };

      const updatedChat = await saveMessage(chatToUpdate, {
        id: msg.id,
        timestamp: msg.timestamp,
        sender: msg.sender,
        receiver: connRef.current!.user!.name!,
        content: msg.content,
      });

      chatsRef.current = {
        ...chatsRef.current,
        [chatUuid]: updatedChat,
      };

      setChats(prev => ({
        ...prev,
        [chatUuid]: updatedChat,
      }));

      socketRef.current?.emit('message-received', msg.id)
      return msg.id;
    });

    saveQueuesRef.current.set(chatUuid, currentQueue);

    try {
      await currentQueue;
    } finally {
      if (saveQueuesRef.current.get(chatUuid) === currentQueue) {
        saveQueuesRef.current.delete(chatUuid);
      }
    }
  }, [emitSafe]);

  // Ref estable para handleIncomingMessage: evita que el efecto del socket
  // se re-ejecute solo porque esta función cambió de referencia.
  const handleIncomingMessageRef = useRef(handleIncomingMessage);
  useEffect(() => {
    handleIncomingMessageRef.current = handleIncomingMessage;
  }, [handleIncomingMessage]);

  useEffect(() => {
    if (!socket) return;

    const currentSocket = socket;
    const listener = (msg: Message & { senderInfo: User; }) => handleIncomingMessageRef.current(msg);
    currentSocket.on('inbox-message', listener);

    return () => {
      currentSocket.off('inbox-message', listener);
    };
  }, [socket]);

  useEffect(() => {
    if (!conn?.ip || !conn?.user || !conn.puk || conn.ip === '' || conn.user.id === '' || conn.user.name === '') {
      setStatus({
        type: 'disconnected',
        error: 'Invalid credentials'
      })
      return;
    }

    saveConnectionSettings(conn);
    loggerRef.current.log('conn modified', conn);

    const activeSocket = io(conn.ip, {
      auth: conn.user,
      reconnection: true,
      reconnectionAttempts: 5,

      reconnectionDelay: 250,
      reconnectionDelayMax: 1000,
      randomizationFactor: 0,

      timeout: 5000,
      transports: ['websocket'],
    });

    setSocket(activeSocket);
    setStatus({
      type: 'connecting',
    });

    activeSocket.on('connect', () => {
      loggerRef.current.log(`Socket conectado con éxito. ID: ${activeSocket.id}`);
      setStatus({ type: 'connected' });

      activeSocket.once('req_puk', (ack: (response: unknown) => void) => {
        loggerRef.current.log('PuK requested')
        ack(conn.puk);
      })

      activeSocket.once('test_puk', async (encryptedValidation: string, ack: (response: unknown) => void) => {
        loggerRef.current.log('Testing PuK ownership');
        const plainBuffer = await decryptWithStoredKey(encryptedValidation);
        const value = bytesToBase64(new Uint8Array(plainBuffer));
        ack(value);
      })

    });

    activeSocket.io.on('reconnect_attempt', (attempt: number) => {
      loggerRef.current.log(`Intento de reconexión nº ${attempt}...`);
      setStatus({ type: 'connecting', attempt });
    });

    activeSocket.io.on('reconnect', (attempt: number) => {
      loggerRef.current.log(`Reconectado tras ${attempt} intento(s).`);
      setStatus({ type: 'connected' });
    });

    activeSocket.io.on('reconnect_error', (err: Error) => {
      loggerRef.current.warn(`Fallo en intento de reconexión: ${err.message}`);
    });

    activeSocket.io.on('reconnect_failed', () => {
      loggerRef.current.warn('Se agotaron los intentos de reconexión.');
      setStatus({ type: 'disconnected', error: 'Server connection failed' });
    });

    const onConnectedInbox = async (d: Record<string, Message & { senderInfo: User }>, ack: (res: string) => void) => {
      loggerRef.current.log('connected inbox', d);
      for (const msg of Object.values(d)) {
        await handleIncomingMessageRef.current(msg);
      }
      setStatus({ type: 'inboxed' })

      ack('ok')
    };

    activeSocket.on('connected-inbox', onConnectedInbox);

    activeSocket.on('connection-error', (err) => {
      loggerRef.current.warn(`Error de conexión socket: ${err.message}`);
      setStatus({ type: 'disconnected', error: 'Connection error' });
    });

    activeSocket.on('disconnect', (reason) => {
      loggerRef.current.warn(`Socket desconectado: ${reason}`);
      // TODO: Mejorar lógica de reconexión

      if (statusRef.current.type === 'disconnected') return

      if (reason === 'io server disconnect') {
        setStatus({
          type: 'connecting'
        });
        activeSocket.connect();
      } else {
        setStatus({
          type: 'connecting'
        });
      }
    });

    const networkListenerPromise = Network.addListener('networkStatusChange', (status) => {
      if (!status.connected) return;
      if (activeSocket.connected) return;
      loggerRef.current.log('Red disponible de nuevo (Capacitor Network), forzando reconexión');
      activeSocket.connect();
    });

    return () => {
      activeSocket.off('connected-inbox', onConnectedInbox);
      activeSocket.off('connect');
      activeSocket.off('connect_error');
      activeSocket.off('disconnect');
      activeSocket.io.off('reconnect_attempt');
      activeSocket.io.off('reconnect');
      activeSocket.io.off('reconnect_error');
      activeSocket.io.off('reconnect_failed');
      networkListenerPromise.then(listener => listener.remove());
      activeSocket.disconnect();
      setSocket(undefined);
      setStatus({ type: 'idle' });
    };
  }, [conn?.ip, conn?.user?.name]);

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
    }));
  }

  const editChat = useCallback(async (chat: Chat) => {
    setChats(prev => ({ ...prev, [chat.uuid]: chat }));
    await saveChatMetadata(chat); // si falla, se propaga y no actualizamos el estado
  }, []);

  const sendMessage = useCallback(async (chat: Chat, message: Message): Promise<Message> => {
    if (!socketRef.current) {
      loggerRef.current.warn('Tried to send message with no active socket');
      throw new Error('No active socket');
    }

    const msg = await socketRef.current.emitWithAck('send-message', message) as Message;

    loggerRef.current.log('saving chat history', msg);
    const updatedChat = await saveMessage(chat, msg);
    setChats(prev => ({ ...prev, [updatedChat.uuid]: updatedChat }));

    return msg;
  }, []);

  const forceReconnect = useCallback(() => {
    if (!socketRef.current) {
      loggerRef.current.warn('No hay socket para reconectar');
      return;
    }
    socketRef.current.connect();
  }, []);

  return (
    <ConnectionContext.Provider
      value={{
        ping,
        conn,
        editConn,
        socket,
        status,
        chats,
        editChat,
        editUser,
        sendMessage,
        forceReconnect,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}
