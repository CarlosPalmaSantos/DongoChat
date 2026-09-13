import { useEffect, useRef, useState, type ReactNode } from "react";
import { loadConnectionSettings, saveConnectionSettings, type ConnectionSettings } from "../types/User";
import { io, type Socket } from "socket.io-client";
import { ConnectionContext } from "../contexts/ConnectionContext";

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<ConnectionSettings>();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    loadConnectionSettings().then(setConn)
  }, [])

  useEffect(() => {
    console.log(conn)
    if (!conn) return;

    saveConnectionSettings(conn)

    if (conn.ip && conn.name) {
      socketRef.current = io(conn.ip, {
        auth: {
          name: conn.name,
          pass: conn.token,
        }
      })

    }
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    }
  }, [conn])

  function emit(event: string, data: unknown) {
    return new Promise((resolve) => {
      socketRef.current?.emit(event, data, (res: unknown) => resolve(res));
    })

  }

  async function ping(): Promise<number> {
    const prev = Date.now();
    const res = await emit('ping', '') as string;
    const post = Date.now()
    if (res !== 'pong') return -1;

    return post - prev;
  }

  function editConn(val: Partial<ConnectionSettings>) {
    setConn(prev => ({ ...prev, ...val }));
  }

  return <ConnectionContext.Provider value={{ ping, conn, editConn }}>
    {children}
  </ConnectionContext.Provider>
}
