import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import './index.css'
import { App } from './App.tsx'

import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// --- Auto-update (Capacitor native only, no-op on web) ---
if (Capacitor.isNativePlatform()) {
  // Tell the plugin the bundle that just booted is healthy.
  // If you don't call this, the plugin will roll back to the previous
  // working bundle on next launch (crash-loop protection).
  CapacitorUpdater.notifyAppReady()

  checkForUpdate().catch((err) => {
    console.error('[auto-update] check failed:', err)
  })
}

async function checkForUpdate() {
  const MANIFEST_URL =
    'https://github.com/CarlosPalmaSantos/DongoChat/releases/latest/download/manifest.json'

  const response = await CapacitorHttp.get({
    url: MANIFEST_URL,
    headers: { 'Cache-Control': 'no-cache' }
  })

  if (response.status !== 200) {
    throw new Error(`Manifest fetch failed: ${response.status}`)
  }

  const manifest: { version: string; url: string; checksum?: string } =
    typeof response.data === 'string' ? JSON.parse(response.data) : response.data

  if (!manifest || !manifest.url || !manifest.version) {
    throw new Error(`Invalid manifest structure: ${JSON.stringify(manifest)}`)
  }

  const current = await CapacitorUpdater.current()
  if (current.bundle.version === manifest.version) {
    return // already up to date
  }

  const bundle = await CapacitorUpdater.download({
    url: manifest.url,
    version: manifest.version,
    checksum: manifest.checksum,
  })

  await CapacitorUpdater.set(bundle)
}
