import { useMemo, useEffect, useState, useRef } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
  Box,
  Card,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import { argbFromHex, themeFromSourceColor, hexFromArgb } from '@material/material-color-utilities';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { DongoChat } from './DongoChat';
import { loadConnectionSettings, type ConnectionSettings } from './types/User';

import HelpIcon from '@mui/icons-material/Help';
import { io } from 'socket.io-client';

export function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [sourceColor, setSourceColor] = useState('#8f9fe7');
  const [conn, setConn] = useState<ConnectionSettings>();

  const [ip, setIp] = useState<string | undefined>(conn?.ip);
  const [name, setName] = useState<string>(conn?.user?.name ?? '');
  const [pass, setPass] = useState<string>(conn?.user?.pass ?? '');


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
    loadConnectionSettings().then(setConn);
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

  // Estilos base para acelerar por GPU en WebView (Android/iOS)
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {conn && <DongoChat conn={conn} setConn={setConn} />}
      {!conn &&
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          bgcolor: 'background.default',

          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Card sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 4,
            gap: 3,
          }}>
            <Typography variant='h4' sx={{ p: 2, color: theme => theme.palette.primary.main }}>Inicio</Typography>
            <TextField
              fullWidth
              label="Name"
              variant="outlined"
              value={name}
              onChange={e => setName(e.target.value.trim())}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }} />
            <TextField
              fullWidth
              label="Password"
              variant="outlined"
              type="password"
              hidden={true}
              value={pass}
              onChange={e => setPass(e.target.value)}

              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }} />
            <TextField
              fullWidth
              label="IP Address"
              variant="outlined"
              type={'url'}
              value={ip}
              onChange={e => { setIp(e.target.value.trim()) }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                }
              }} />
            <Box sx={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              gap: 1,
              py: 2,
              width: '100%',
            }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                sx={{ borderRadius: 1, width: '100%' }}
                onClick={() => {
                  console.log(ip, name, pass)

                  if (!ip || !name || !pass)
                    return

                  const user = {
                    id: name,
                    name: name,
                    pass: pass
                  }

                  const socket = io(ip, {
                    auth: user
                  })

                  const test = new Promise((resolve, reject) => {
                    // Definimos las funciones con nombre para poder removerlas después
                    const handleSuccess = (inboxData: unknown) => {
                      cleanup();
                      resolve(inboxData);
                    };

                    const handleError = (error: Error | string) => {
                      cleanup();
                      reject(error);
                    };

                    // Función auxiliar para desuscribir ambos eventos al terminar
                    const cleanup = () => {
                      socket.off('connected-inbox', handleSuccess);
                      socket.off('connect_error', handleError);
                      socket.off('connection-error', handleError); // Por si tu backend emite este evento custom
                    };

                    // Registrar los eventos
                    socket.on('connected-inbox', handleSuccess);
                    socket.on('connect_error', handleError);
                    socket.on('connection-error', handleError);
                  });

                  test.then(() => {
                    setConn(prev => ({
                      ...prev, ip, user
                    }))
                  }).catch(() => console.log('Error'));
                }}
              >
                Check Server
              </Button>
              <Box
                sx={{
                  color: theme => theme.palette.primary.main,
                  alignSelf: 'stretch', // Estira el contenedor al alto total del flexbox
                  aspectRatio: '1 / 1', // Garantiza que el ancho sea igual al alto
                  height: 40,       // Permite que la altura sea dictada por la fila flex
                  p: 0,                 // Elimina el padding si prefieres el icono al límite
                  borderRadius: 1,      // Opcional: para que combine con el borderRadius del Button
                }}
              >
                <HelpIcon sx={{ width: '100%', height: '100%' }} />
              </Box>
            </Box>

          </Card>
        </Box >
      }
    </ThemeProvider >
  );
}

export default App;
