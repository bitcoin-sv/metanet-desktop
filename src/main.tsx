import React from 'react'
import { createRoot } from 'react-dom/client'
import { UserInterface } from '@bsv/brc100-ui-react-components'
import { onWalletReady } from './onWalletReady'
import ErrorBoundary from './ErrorBoundary'
import { tauriFunctions } from './tauriFunctions'
import packageJson from '../package.json'

// Create the root and render:
const rootElement = document.getElementById('root')
if (rootElement) {
  const root = createRoot(rootElement)

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <UserInterface
          onWalletReady={onWalletReady}
          nativeHandlers={tauriFunctions}
          appVersion={packageJson.version}
          appName="Metanet Desktop"
        />
      </ErrorBoundary>
    </React.StrictMode>
  )
}
