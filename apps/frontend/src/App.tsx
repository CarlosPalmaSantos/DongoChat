import { useMemo, useEffect, useState, useRef } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
  Box,
} from '@mui/material';
import { argbFromHex, themeFromSourceColor, hexFromArgb } from '@material/material-color-utilities';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';
import { motion, AnimatePresence } from 'framer-motion';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import ChatsPage from './pages/chats';
import ChatPage from './pages/chat';
import type { Chat } from './types/Chat';
import SettingsPage from './pages/settings';
import { ConnectionProvider } from './providers/ConnectionProvider';
import { LoggerProvider } from './providers/LoggerProvider';

export function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [sourceColor, setSourceColor] = useState('#8f9fe7');

  const [selectedChat, setSelectedChat] = useState<Chat | 'settings' | null>(null);

  interface DynamicColorPlugin {
    getSystemColor(): Promise<{ color: string }>;
  }

  const DynamicColor = registerPlugin<DynamicColorPlugin>('DynamicColor');

  useEffect(() => {
    const getColor = async () => {
      // TODO: Comprobación dispositivo
      try {
        console.log('Llamando a getSystemColor...');
        const result = await DynamicColor.getSystemColor();
        console.log('Resultado:', result);
        setSourceColor(result.color);
      } catch (e) {
        console.error('Error:', e);
      }
    };

    getColor();
  }, []);

  const theme = useMemo(() => {
    const m3Theme = themeFromSourceColor(argbFromHex(sourceColor));
    const scheme = prefersDarkMode ? m3Theme.schemes.dark : m3Theme.schemes.light;

    return createTheme({
      palette: {
        mode: prefersDarkMode ? 'dark' : 'light',
        error: {
          main: hexFromArgb(scheme.error)
        },
        primary: {
          main: hexFromArgb(scheme.primary),
          contrastText: hexFromArgb(scheme.onPrimary),
          container: hexFromArgb(scheme.primaryContainer),
          onContainer: hexFromArgb(scheme.onPrimaryContainer),
        },
        secondary: {
          main: hexFromArgb(scheme.secondary),
          contrastText: hexFromArgb(scheme.onSecondary),
          container: hexFromArgb(scheme.secondaryContainer),
          onContainer: hexFromArgb(scheme.onSecondaryContainer),
        },
        tertiary: {
          main: hexFromArgb(scheme.tertiary),
          contrastText: hexFromArgb(scheme.onTertiary),
        },
        background: {
          default: hexFromArgb(scheme.background),
          paper: hexFromArgb(scheme.surface),
          surfaceVariant: hexFromArgb(scheme.surfaceVariant),
        },
        text: {
          surfaceVariant: hexFromArgb(scheme.onSurfaceVariant),
        }
      },
      shape: { borderRadius: 16 },
      typography: { fontFamily: 'Roboto, sans-serif' },
    });
  }, [prefersDarkMode, sourceColor]);

  const isCalledRef = useRef(false);

  useEffect(() => {
    if (isCalledRef.current) return;
    isCalledRef.current = true;
  }, []);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const setupStatusBar = async () => {
      try {
        await StatusBar.setBackgroundColor({ color: '#00000000' });
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({
          style: prefersDarkMode ? Style.Dark : Style.Light,
        });
      } catch (e) {
        console.error('Error configurando StatusBar:', e);
      }
    };

    setupStatusBar();
  }, [prefersDarkMode]);

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

  // Estilos base para acelerar por GPU en WebView (Android/iOS)
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LoggerProvider>
        <ConnectionProvider>
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
      </LoggerProvider>
    </ThemeProvider >
  );
}

export default App;
