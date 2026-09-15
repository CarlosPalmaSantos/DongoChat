import { AppBar, Box, Button, Card, Dialog, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Snackbar, Stack, TextField, Toolbar, Typography } from "@mui/material";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HelpIcon from '@mui/icons-material/Help';
import { useConnection } from "../hooks/useConnection";
import { useState } from "react";
import { deleteAllChats } from "../types/Chat";
import { useLog } from "../hooks/useLog";

export default function SettingsPage({ clearSelectedChat }: { clearSelectedChat: () => void }) {
  const { conn, editConn, editUser, ping } = useConnection();

  const [ip, setIp] = useState<string | undefined>(conn?.ip);
  const [name, setName] = useState<string>(conn?.user?.name ?? '');
  const [pass, setPass] = useState<string>(conn?.user?.pass ?? '');

  const [openPingSnackbar, setOpenPingSnackbar] = useState(false);
  const [error, setError] = useState<string | undefined>()
  const [pingResult, setPingResult] = useState(-1);

  const console = useLog();
  const [openLog, setOpenLog] = useState(false);

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, p: 4, overflowY: 'auto' }}>
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
        <Typography
          variant="h5"
          color="primary"
          align="center"
          sx={{ fontWeight: 'bold' }}
        >
          Connection
        </Typography>

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
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<HelpIcon />}
          onClick={() => {

            if (!ip || !name || !pass)
              return

            console.log(`name: ${name}`)

            if (ip !== conn?.ip) {
              editConn({ ip })
            }

            editUser({
              id: name,
              name: name,
              pass: pass
            })

            console.log('timeouting')
            setTimeout(() =>
              ping().then(r => { setPingResult(r); if (r >= 0) setOpenPingSnackbar(true) }).catch(setError),
              1000)
          }}
          sx={{ borderRadius: 1 }}
        >
          Check Server
        </Button>

        <Button
          variant="contained"
          size="large"
          startIcon={<HelpIcon />}
          onClick={() => {
            deleteAllChats();
          }}
          sx={{ borderRadius: 1, bgcolor: theme => theme.palette.tertiary.main, color: theme => theme.palette.tertiary.contrastText }}
        >
          DELETE
        </Button>
        <Snackbar
          open={!!error}
          autoHideDuration={4000}
          onClose={() => setError(undefined)}
          message={error}
        />

        <Snackbar
          open={openPingSnackbar}
          autoHideDuration={4000}
          onClose={() => setOpenPingSnackbar(false)}
          message={`Pong received in ${pingResult}ms`}
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
            value={console.showLevel}
            onChange={e => console.setShowLevel(e.target.value)}
          >
            <MenuItem value={'none'}>None</MenuItem>
            <MenuItem value={'error'}>Error</MenuItem>
            <MenuItem value={'warn'}>Warn</MenuItem>
            <MenuItem value={'log'}>Log</MenuItem>
            <MenuItem value={'debug'}>Debug</MenuItem>
          </Select>
        </FormControl>        <Button
          variant="contained"
          size="large"
          startIcon={<HelpIcon />}
          onClick={() => setOpenLog(true)}
          sx={{ borderRadius: 1, bgcolor: theme => theme.palette.tertiary.main, color: theme => theme.palette.tertiary.contrastText }}
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
              {console.history.map((m, index) => (
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
    </Box>
  </Paper>
}
