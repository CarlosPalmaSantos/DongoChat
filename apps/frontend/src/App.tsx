import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
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
  Backdrop,
  CircularProgress,
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
import { cleanText } from 'dongo-shared';

export function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [sourceColor, setSourceColor] = useState('#8f9fe7');
  const [conn, setConn] = useState<ConnectionSettings>();

  const [ip, setIp] = useState<string>(conn?.ip ?? 'wss://dongo.magin.top');
  const [name, setName] = useState<string>(conn?.user?.name ?? '');
  const [pass, setPass] = useState<string>(conn?.user?.pass ?? '');

  const [loaddingCon, setLoaddingCon] = useState(true);

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

  // Se pone a true en cuanto testConnection tiene éxito una vez. A partir
  // de ahí, ConnectionProvider (montado más abajo vía <DongoChat>) es quien
  // gestiona el ciclo de vida del socket "real" -- incluida su propia
  // reconexión automática. Ya no necesitamos volver a "probar" la conexión
  // con un socket aparte, y hacerlo sin este guard puede llegar a expulsar
  // al socket principal si el servidor solo admite una conexión activa por
  // usuario (mismo `auth` en ambos sockets).
  const hasConnectedRef = useRef(false);

  const testConnection = useCallback((
    ipArg: string,
    nameArg: string,
    passArg: string,
  ) => {
    if (hasConnectedRef.current) {
      console.log('Ya hay una conexión activa; se ignora esta prueba de conexión');
      return;
    }

    if (!ipArg || !nameArg || !passArg) {
      setLoaddingCon(false); // <- antes faltaba esto: el spinner se quedaba colgado
      return;
    }

    setLoaddingCon(true);

    const user = {
      id: cleanText(nameArg),
      name: nameArg,
      pass: passArg,
    };

    // transports: ['websocket'] evita el transporte de polling (basado en
    // XHR) por completo. Con CapacitorHttp habilitado, ese polling puede
    // fallar porque su patrón de petición "colgada" esperando datos no es
    // compatible con el shim nativo de XHR que usa CapacitorHttp -- de ahí
    // el "xhr poll error". WebSocket es una API distinta que no pasa por
    // ese shim, así que se conecta directo sin ese problema.
    const socket = io(ipArg, { auth: user, transports: ['websocket'] });

    const test = new Promise((resolve, reject) => {
      const handleSuccess = (inboxData: unknown) => {
        cleanup();
        resolve(inboxData);
      };

      const handleError = (error: Error | string) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        socket.off('connected-inbox', handleSuccess);
        socket.off('connect_error', handleError);
        socket.off('connection-error', handleError);
      };

      socket.on('connected-inbox', handleSuccess);
      socket.on('connect_error', handleError);
      socket.on('connection-error', handleError);
    });

    test
      .then(() => {
        hasConnectedRef.current = true;
        setConn(prev => ({ ...prev, ip: ipArg, user }));
        setLoaddingCon(false);
      })
      .catch(() => {
        console.log('Error');
        setLoaddingCon(false);
      })
      .finally(() => {
        // Este socket solo sirve para validar credenciales/servidor antes
        // de dar paso a la pantalla de chat. El socket "de verdad" lo crea
        // ConnectionProvider a partir de `conn`, así que este siempre debe
        // cerrarse aquí -- tanto si la prueba tuvo éxito como si falló.
        // Dejarlo abierto era el bug real: se quedaba conectado
        // indefinidamente con el mismo `auth` que el socket principal.
        socket.disconnect();
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadConnectionSettings().then(c => {
      if (cancelled) return;

      const loadedIp = c?.ip ?? 'wss://dongo.magin.top';
      const loadedName = c?.user?.name ?? '';
      const loadedPass = c?.user?.pass ?? '';

      setIp(loadedIp);
      setName(loadedName);
      setPass(loadedPass);

      testConnection(loadedIp, loadedName, loadedPass); // <- valores explícitos, no closure viejo
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <- solo al montar, ya no depende de testConnection

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
      {(!conn && !loaddingCon) &&
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
            <Typography variant='h4' sx={{ p: 2, color: theme => theme.palette.primary.main }}>DongoChat</Typography>
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
                onClick={() => testConnection(ip, name, pass)}
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
      <Backdrop open={loaddingCon}>
        <CircularProgress color='primary' />
      </Backdrop>
    </ThemeProvider >
  );
}

export default App;
