import { createBrowserRouter } from 'react-router'
import { RequireAuth, RequireTechnician } from './auth/auth'
import { MobileLayout } from './layouts/MobileLayout'
import { AssetPage } from './pages/asset/AssetPage'
import { LoginPage } from './pages/auth/LoginPage'
import { HomePage } from './pages/home/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PartPage } from './pages/parts/PartPage'
import { NewRequestPage } from './pages/requests/NewRequestPage'
import { RequestDetailPage } from './pages/requests/RequestDetailPage'
import { RequestsPage } from './pages/requests/RequestsPage'
import { ScanPage } from './pages/scan/ScanPage'
import { WorkListPage } from './pages/work/WorkListPage'
import { WorkOrderPage } from './pages/work/WorkOrderPage'
import { MobileScopeProvider } from './state/scope'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <MobileScopeProvider>
          <MobileLayout />
        </MobileScopeProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'work',
        element: (
          <RequireTechnician>
            <WorkListPage />
          </RequireTechnician>
        ),
      },
      { path: 'work/:id', element: <WorkOrderPage /> },
      { path: 'scan', element: <ScanPage /> },
      { path: 'asset/:code', element: <AssetPage /> },
      { path: 'parts/:id', element: <PartPage /> },
      { path: 'requests', element: <RequestsPage /> },
      { path: 'requests/new', element: <NewRequestPage /> },
      { path: 'requests/:id', element: <RequestDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
