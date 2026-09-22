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
  Backdrop,
  CircularProgress,
  Alert,
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

import { PushNotifications } from '@capacitor/push-notifications'
import { getWebPushToken, listenToWebPush, } from './firebase';
import { generateAndStoreKeyPair, getStoredPublicKeyPem, hashBase64, hasStoredKeyPair } from './types/keys';

const WEB_VAPID_KEY = 'BFo31hROQCoKCBwctHn1K_aKaMgphD2Esyi6l3MAmLsW_8sWFwa37haFTknWhFSIX9Tpv4Nzf8a6--I-OX3zMgI'

export function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [sourceColor, setSourceColor] = useState('#8f9fe7');
  const [conn, setConn] = useState<ConnectionSettings>();
  const [loadding, setLoadding] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const [ip, setIp] = useState<string>(conn?.ip ?? 'wss://dongo.magin.top');
  const [name, setName] = useState<string>(conn?.user?.name ?? '');
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Las notificaciones push solo se configuran en Android/iOS.
    if (!Capacitor.isNativePlatform()) {
      let unsubscribe: (() => void) | undefined;

      async function initWebPush() {
        try {
          const token = await getWebPushToken(WEB_VAPID_KEY);

          if (!token) {
            console.warn('[Web Push] No se obtuvo token');
            return;
          }

          console.log('[Web Push] Token:', token);

          unsubscribe = await listenToWebPush(payload => {
            console.log('[Web Push] ¡Notificación recibida!', payload);
          });
        } catch (error) {
          console.error('[Web Push] Error inicializando:', error);
        }
      }

      initWebPush();

      return () => {
        unsubscribe?.();
      };
    }

    let cancelled = false;

    const setupPushNotifications = async () => {
      try {
        /*
         * Registramos primero los listeners.
         *
         * Es importante hacerlo antes de llamar a register(), porque
         * register() puede provocar inmediatamente el evento "registration".
         */
        const registrationListener =
          await PushNotifications.addListener('registration', token => {
            if (cancelled) return;

            console.log('[Push] Token registrado:', token.value);

            // TODO:
            // En el siguiente paso enviaremos este token a nuestro backend.
          });

        const registrationErrorListener =
          await PushNotifications.addListener('registrationError', error => {
            if (cancelled) return;

            console.error('[Push] Error de registro:', error);
          });

        const receivedListener =
          await PushNotifications.addListener(
            'pushNotificationReceived',
            notification => {
              if (cancelled) return;

              console.log('[Push] Notificación recibida:', notification);
            },
          );

        const actionListener =
          await PushNotifications.addListener(
            'pushNotificationActionPerformed',
            action => {
              if (cancelled) return;

              console.log('[Push] Usuario pulsó la notificación:', action);
            },
          );

        /*
         * Comprobamos/pedimos permiso.
         */
        const permission = await PushNotifications.requestPermissions();

        if (cancelled) return;

        if (permission.receive !== 'granted') {
          console.warn(
            '[Push] Permiso de notificaciones no concedido:',
            permission.receive,
          );
          return;
        }

        /*
         * Una vez concedido el permiso, registramos el dispositivo.
         *
         * Esto provocará el evento "registration" de arriba cuando
         * Capacitor obtenga el token nativo.
         */
        await PushNotifications.register();

        /*
         * Guardamos las referencias únicamente para que TypeScript/
         * el cleanup quede explícito.
         */
        return () => {
          registrationListener.remove();
          registrationErrorListener.remove();
          receivedListener.remove();
          actionListener.remove();
        };
      } catch (error) {
        if (!cancelled) {
          console.error(
            '[Push] Error inicializando las notificaciones:',
            error,
          );
        }
      }
    };

    let cleanup: (() => void) | undefined;

    setupPushNotifications().then(result => {
      cleanup = result;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    loadConnectionSettings().then(async c => {
      if (cancelled) return;

      const loadedIp = c?.ip ?? 'wss://dongo.magin.top';
      const loadedName = c?.user?.name ?? '';

      setIp(loadedIp);
      setName(loadedName);

      setLoadding(false)

      if (loadedIp === '' || loadedName === '' || !(await hasStoredKeyPair()))
        return

      const puk = await getStoredPublicKeyPem()

      if (!puk)
        return;

      setConn({
        ip: loadedIp,
        user: {
          // TODO: Obtener 
          id: await hashBase64(puk),
          name: loadedName,
        },
        puk
      })
    });

    return () => { cancelled = true; };

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

      {(conn) && <DongoChat conn={conn} setConn={setConn} onChangeStatus={(status) => {
        console.log('status changed:', status)
        setAttempt(status.attempt ?? 0)
        switch (status.type) {
          case 'idle': setLoadding(true); break;
          case 'connecting': setLoadding(true); break;
          case 'disconnected': setConn(undefined); setLoadding(false); break;
          case 'inboxed': setLoadding(false); break;
        }

        setError(status.error)
      }} />}
      {(!loadding && !conn) &&
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
              width: '100%'
            }}>
              {error && <Alert severity='error'>{error}</Alert>}
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
                  onClick={async () => {
                    const puk = (await hasStoredKeyPair())
                      ? await getStoredPublicKeyPem()
                      : (await generateAndStoreKeyPair()).publicKeyPem

                    if (!puk) return

                    setConn({
                      ip,
                      user: {
                        id: await hashBase64(puk),
                        name,
                      },
                      puk
                    })
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
            </Box>

          </Card>
        </Box >
      }

      <Backdrop open={loadding} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <CircularProgress color='primary' />
        {attempt > 0 &&
          <>
            <Typography variant='body1'>Connecting attempt {attempt}</Typography>
            <Button variant='contained' onClick={() => {
              setConn(undefined);
              setLoadding(false);
              setError('Connection canceled')
            }}>Cancel</Button>
          </>
        }

      </Backdrop>
    </ThemeProvider >
  );
}

export default App;
