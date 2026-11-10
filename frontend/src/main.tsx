import '@fontsource-variable/manrope'
import './app/theme.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ApiError } from './api/client'
import { App } from './app/App'
import { ThemeProvider } from './app/theme'
import { SessionProvider } from './auth/session'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status < 500),
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
