import { useEffect, useState } from "react";
import { ConnectionProvider } from "./providers/ConnectionProvider";
import { LoggerProvider } from "./providers/LoggerProvider";
import type { Chat } from "./types/Chat";
import { Box } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import ChatsPage from "./pages/chats";
import ChatPage from "./pages/chat";
import SettingsPage from "./pages/settings";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from '@capacitor/app';
import type { ConnectionSettings } from "./types/User";

export function DongoChat({ conn, setConn }: {
  conn: ConnectionSettings | undefined,
  setConn: React.Dispatch<React.SetStateAction<ConnectionSettings | undefined>>
}) {
  const [selectedChat, setSelectedChat] = useState<Chat | 'settings' | null>(null);

  const motionLayerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    willChange: 'transform, opacity', // Obliga a usar capa de GPU dedicada
    transform: 'translateZ(0)',      // Evita repintado en la CPU
  };

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const listenerPromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (selectedChat) {
        setSelectedChat(null);
      } else if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [selectedChat]);



  return <LoggerProvider>
    <ConnectionProvider selectedChat={selectedChat} conn={conn} setConn={setConn}>
      {/* Usamos inset: 0 / 100% en lugar de 100vw/100vh para evitar re-calculos por la barra de tareas */}
      <Box sx={{ position: 'fixed', inset: 0, overflow: 'hidden', bgcolor: 'background.default' }}>
        <AnimatePresence initial={false}>
          {!selectedChat &&
            <motion.div
              key="chats-list"
              initial={{ opacity: 0.8, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              style={motionLayerStyle}
            >
              <ChatsPage onChatSelected={setSelectedChat} />
            </motion.div>
          }
          {(!!selectedChat && selectedChat !== 'settings') &&
            < motion.div
              key="chat-detail"
              initial={{ y: '100%' }}
              animate={{ y: '0%' }}
              exit={{ y: '100%' }}
              /* Transición suave tipo Android/iOS nativo optimizada por hardware */
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              style={{
                ...motionLayerStyle,
                zIndex: 10,
              }}
            >
              <ChatPage chat={selectedChat} clearSelectedChat={() => setSelectedChat(null)} me="672cbaf7-6b4a-48b0-bb88-77ceaa6be877" />
            </motion.div>
          }
          {(selectedChat === 'settings') &&
            < motion.div
              key="chat-detail"
              initial={{ y: '100%' }}
              animate={{ y: '0%' }}
              exit={{ y: '100%' }}
              /* Transición suave tipo Android/iOS nativo optimizada por hardware */
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              style={{
                ...motionLayerStyle,
                zIndex: 10,
              }}
            >
              <SettingsPage clearSelectedChat={() => setSelectedChat(null)} />
            </motion.div>
          }
        </AnimatePresence>
      </Box>
    </ConnectionProvider>
  </LoggerProvider >

}
