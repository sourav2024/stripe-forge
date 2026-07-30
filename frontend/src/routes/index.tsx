import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { OverviewPage } from '../pages/OverviewPage';
import { PaymentsPage } from '../pages/PaymentsPage';
import { PaymentIntentsPage } from '../pages/PaymentIntentsPage';
import { CustomersPage } from '../pages/CustomersPage';
import { RefundsPage } from '../pages/RefundsPage';
import { LedgerPage } from '../pages/LedgerPage';
import { WebhooksPage } from '../pages/WebhooksPage';
import { JobsPage } from '../pages/JobsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/payment-intents" element={<PaymentIntentsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/refunds" element={<RefundsPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/webhooks" element={<WebhooksPage />} />
          <Route path="/jobs" element={<JobsPage />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
