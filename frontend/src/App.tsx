import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { lazy, Suspense, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './pages/HomePage'
import { DiseasePage } from './pages/DiseasePage'
import { FertilizerPage } from './pages/FertilizerPage'
import { CropRecommendationPage } from './pages/CropRecommendationPage'
import { YieldEstimatorPage } from './pages/YieldEstimatorPage'
import { FieldsPage } from './pages/FieldsPage'
import { HistoryPage } from './pages/HistoryPage'
import { CropCalendarPage } from './pages/CropCalendarPage'
import { IrrigationPage } from './pages/IrrigationPage'
import { WeatherPage } from './pages/WeatherPage'
import { CommunityPage } from './pages/CommunityPage'
import { LoginPage } from './pages/LoginPage'
import { SoilScopePage } from './pages/SoilScopePage'
import { PlantProfilePage } from './pages/PlantProfilePage'
import { AboutPage } from './pages/AboutPage'
import { ResourceManagementPage } from './pages/ResourceManagementPage'
import { MarketAnalysisPage } from './pages/MarketAnalysisPage'

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

function DashboardRouteFallback() {
  const { t } = useTranslation()
  return <div className="p-8 text-sm text-ink-faint">{t('dashboard.loading')}</div>
}

function routerBasename() {
  const b = import.meta.env.BASE_URL
  if (!b || b === '/') return undefined
  return b.endsWith('/') ? b.slice(0, -1) : b
}

export default function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1 },
        },
      }),
    [],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasename()}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<DashboardRouteFallback />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route path="/resources" element={<ResourceManagementPage />} />
            <Route path="/disease" element={<DiseasePage />} />
            <Route path="/weather" element={<WeatherPage />} />
            <Route path="/market" element={<MarketAnalysisPage />} />
            <Route path="/fertilizer" element={<FertilizerPage />} />
            <Route path="/crop-recommendation" element={<CropRecommendationPage />} />
            <Route path="/yield" element={<YieldEstimatorPage />} />
            <Route path="/fields" element={<FieldsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/calendar" element={<CropCalendarPage />} />
            <Route path="/irrigation" element={<IrrigationPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/soil" element={<SoilScopePage />} />
            <Route path="/plants" element={<PlantProfilePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        theme="dark"
        richColors
        closeButton
        toastOptions={{ className: 'border-ds-border bg-void-2/95 text-ink backdrop-blur-xl' }}
      />
    </QueryClientProvider>
  )
}
