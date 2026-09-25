import { AppBar, Box, Button, Card, Dialog, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Snackbar, Stack, Toolbar, Typography } from "@mui/material";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import HelpIcon from '@mui/icons-material/Help';
import DeleteIcon from '@mui/icons-material/Delete'

import { useEffect, useState } from "react";
import { deleteAllChats } from "../types/Chat";
import { useLog } from "../hooks/useLog";

import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { deleteConnectionSettings } from "../types/User";
import { useConnection } from "../hooks/useConnection";


export default function SettingsPage({ clearSelectedChat }: { clearSelectedChat: () => void }) {
  const [version, setVersion] = useState<string>()

  const [error, setError] = useState<string | undefined>()

  const logger = useLog();
  const [openLog, setOpenLog] = useState(false);
  const { conn } = useConnection()

  useEffect(() => {
    async function getBundleVersion() {
      const current = await CapacitorUpdater.current()
      return current.bundle.version
    }

    getBundleVersion().then(setVersion)
  }, [])
  return <Paper
    square
    elevation={0}
    sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default',
    }}
  >
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        pt: 'calc(env(safe-area-inset-top) + 8px)',
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton edge="start" onClick={clearSelectedChat}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
          Settings (v1)
        </Typography>
      </Toolbar>

    </AppBar>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 4, overflowY: 'auto' }}>
      <Box
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 420,
          mx: 'auto',
          bgcolor: theme => theme.palette.background.paper,
          borderRadius: 2,
          width: '100%',

        }}
      >
        <Box>
          <Typography variant="body1" color="primary" sx={{ display: 'flex', justifyContent: 'center' }}>{conn?.user?.name.toUpperCase()}</Typography>
          <Typography variant="caption" color="secondary" sx={{ display: 'flex', justifyContent: 'center' }}>{conn?.user?.id}</Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={<DeleteIcon />}
          onClick={() => deleteConnectionSettings()
          }
          sx={{ borderRadius: 1, bgcolor: theme => theme.palette.tertiary.main, color: theme => theme.palette.tertiary.contrastText, flexGrow: 1 }}
        >
          CONNECTION
        </Button>
        <Button
          variant="contained"
          size="large"
          startIcon={<DeleteIcon />}
          onClick={() => deleteAllChats()}
          sx={{ borderRadius: 1, bgcolor: theme => theme.palette.tertiary.main, color: theme => theme.palette.tertiary.contrastText, flexGrow: 1 }}
        >
          CHATS
        </Button>
        <Snackbar
          open={!!error}
          autoHideDuration={4000}
          onClose={() => setError(undefined)}
          message={error}
        />
      </Box>
      <Box
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 420,
          mx: 'auto',
          borderRadius: 2,
          width: '100%',
        }}
      >
        <Typography
          variant="h5"
          color="primary"
          align="center"
          sx={{ fontWeight: 'bold' }}
        >
          Debug
        </Typography>
        <FormControl fullWidth color="secondary" sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          }
        }}>
          <InputLabel id="show-level-label" >Show Level</InputLabel>
          <Select
            labelId="show-level-label"
            label="Show Level" // Necesario para que corte la línea del borde
            value={logger.showLevel}
            onChange={e => logger.setShowLevel(e.target.value)}
          >
            <MenuItem value={'none'}>None</MenuItem>
            <MenuItem value={'error'}>Error</MenuItem>
            <MenuItem value={'warn'}>Warn</MenuItem>
            <MenuItem value={'log'}>Log</MenuItem>
            <MenuItem value={'debug'}>Debug</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          size="large"
          startIcon={<HelpIcon />}
          onClick={() => setOpenLog(true)}
          sx={{ borderRadius: 1, bgcolor: theme => theme.palette.secondary.main, color: theme => theme.palette.secondary.contrastText }}
        >
          Logs
        </Button>
        <Dialog
          open={openLog}
          onClose={() => setOpenLog(false)}
          fullWidth
          maxWidth="md"
        >

          <Card sx={{ display: 'flex', flexDirection: 'column', p: 4 }}>
            <Stack sx={{ gap: 2, overflowY: 'auto', maxHeight: '70vh' }}>
              {logger.history.map((m, index) => (
                <Box
                  key={index}
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                  }}
                >
                  {m}
                </Box>
              ))}
            </Stack>
          </Card>
        </Dialog>
      </Box>
      <Typography
        variant="h6"
        color="primary"
        align="center"
        sx={{ fontWeight: 'bold' }}
      >
        {version}
      </Typography>
    </Box>
  </Paper >
}
