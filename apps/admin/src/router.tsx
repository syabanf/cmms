import type { ComponentType } from 'react'
import { Navigate, createBrowserRouter } from 'react-router'
import { RequireAuth } from './auth/auth'
import { AdminLayout } from './layouts/AdminLayout'
import { LoginPage } from './pages/auth/LoginPage'

/** Loads a page module on first visit, so every feature ships as its own chunk. */
const page =
  <K extends string, M extends Record<K, ComponentType>>(load: () => Promise<M>, name: K) =>
  async () => ({ Component: (await load())[name] })

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    HydrateFallback: () => <div className="h-dvh bg-surface" />,
    children: [
      { index: true, lazy: page(() => import('./pages/dashboard/DashboardPage'), 'DashboardPage') },
      { path: 'assets', lazy: page(() => import('./pages/assets/AssetsPage'), 'AssetsPage') },
      { path: 'assets/:id', lazy: page(() => import('./pages/assets/AssetDetailPage'), 'AssetDetailPage') },
      { path: 'work', element: <Navigate to="/work/orders" replace /> },
      { path: 'work/requests', lazy: page(() => import('./pages/requests/RequestsPage'), 'RequestsPage') },
      { path: 'work/requests/:id', lazy: page(() => import('./pages/requests/RequestDetailPage'), 'RequestDetailPage') },
      { path: 'work/orders', lazy: page(() => import('./pages/work-orders/WorkOrdersPage'), 'WorkOrdersPage') },
      { path: 'work/orders/:id', lazy: page(() => import('./pages/work-orders/WorkOrderDetailPage'), 'WorkOrderDetailPage') },
      { path: 'work/calendar', lazy: page(() => import('./pages/calendar/CalendarPage'), 'CalendarPage') },
      { path: 'work/backlog', lazy: page(() => import('./pages/backlog/BacklogPage'), 'BacklogPage') },
      { path: 'work/approvals', lazy: page(() => import('./pages/approvals/ApprovalsPage'), 'ApprovalsPage') },
      { path: 'preventive', element: <Navigate to="/preventive/pm" replace /> },
      { path: 'preventive/pm', lazy: page(() => import('./pages/pm/PmSchedulesPage'), 'PmSchedulesPage') },
      { path: 'preventive/pm/:id', lazy: page(() => import('./pages/pm/PmDetailPage'), 'PmDetailPage') },
      { path: 'preventive/job-plans', lazy: page(() => import('./pages/job-plans/JobPlansPage'), 'JobPlansPage') },
      { path: 'preventive/job-plans/:id', lazy: page(() => import('./pages/job-plans/JobPlanDetailPage'), 'JobPlanDetailPage') },
      { path: 'preventive/inspections', lazy: page(() => import('./pages/inspections/InspectionsPage'), 'InspectionsPage') },
      { path: 'preventive/calibration', lazy: page(() => import('./pages/calibration/CalibrationPage'), 'CalibrationPage') },
      { path: 'inventory', element: <Navigate to="/inventory/parts" replace /> },
      { path: 'inventory/parts', lazy: page(() => import('./pages/parts/PartsPage'), 'PartsPage') },
      { path: 'inventory/parts/purchase-list', lazy: page(() => import('./pages/parts/PurchaseListPage'), 'PurchaseListPage') },
      { path: 'inventory/parts/:id', lazy: page(() => import('./pages/parts/PartDetailPage'), 'PartDetailPage') },
      { path: 'inventory/stock', lazy: page(() => import('./pages/stock/StockPage'), 'StockPage') },
      { path: 'inventory/tools', lazy: page(() => import('./pages/tools/ToolsPage'), 'ToolsPage') },
      { path: 'inventory/tools/:id', lazy: page(() => import('./pages/tools/ToolDetailPage'), 'ToolDetailPage') },
      { path: 'reliability', element: <Navigate to="/reliability/failures" replace /> },
      { path: 'reliability/failures', lazy: page(() => import('./pages/failures/FailuresPage'), 'FailuresPage') },
      { path: 'reliability/rca', lazy: page(() => import('./pages/rca/RcaListPage'), 'RcaListPage') },
      { path: 'reliability/rca/:id', lazy: page(() => import('./pages/rca/RcaDetailPage'), 'RcaDetailPage') },
      { path: 'reliability/history', lazy: page(() => import('./pages/history/HistoryPage'), 'HistoryPage') },
      { path: 'people', element: <Navigate to="/people/technicians" replace /> },
      { path: 'people/technicians', lazy: page(() => import('./pages/technicians/TechniciansPage'), 'TechniciansPage') },
      { path: 'people/technicians/:id', lazy: page(() => import('./pages/technicians/TechnicianDetailPage'), 'TechnicianDetailPage') },
      { path: 'people/skills', lazy: page(() => import('./pages/skills/SkillMatrixPage'), 'SkillMatrixPage') },
      { path: 'people/vendors', lazy: page(() => import('./pages/vendors/VendorsPage'), 'VendorsPage') },
      { path: 'people/vendors/:id', lazy: page(() => import('./pages/vendors/VendorDetailPage'), 'VendorDetailPage') },
      { path: 'reports', lazy: page(() => import('./pages/reports/ReportsPage'), 'ReportsPage') },
      { path: 'settings', element: <Navigate to="/settings/master-data" replace /> },
      { path: 'settings/master-data', lazy: page(() => import('./pages/settings/MasterDataPage'), 'MasterDataPage') },
      { path: 'settings/rules', lazy: page(() => import('./pages/settings/RulesPage'), 'RulesPage') },
      { path: 'settings/notifications', lazy: page(() => import('./pages/settings/NotificationSettingsPage'), 'NotificationSettingsPage') },
      { path: 'settings/roles', lazy: page(() => import('./pages/settings/RolesPage'), 'RolesPage') },
      { path: '*', lazy: page(() => import('./pages/NotFoundPage'), 'NotFoundPage') },
    ],
  },
])
