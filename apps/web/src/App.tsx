import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AdminRoute } from './routes/AdminRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { trackPageview } from './lib/analytics';

// Public
import { WelcomePage } from './pages/welcome/WelcomePage';
import { PrivacyPolicyPage } from './pages/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/legal/TermsOfServicePage';
import { RefundPolicyPage } from './pages/legal/RefundPolicyPage';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { VerifyOtpPage } from './pages/auth/VerifyOtpPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';

// App pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ResumesListPage } from './pages/resumes/ResumesListPage';
import { ResumeEditorPage } from './pages/resumes/ResumeEditorPage';
import { VersionHistoryPage } from './pages/resumes/VersionHistoryPage';
import { AIChatBuilderPage } from './pages/resumes/AIChatBuilderPage';
import { MarketplacePage } from './pages/marketplace/MarketplacePage';
import { JobTrackerPage } from './pages/jobs/JobTrackerPage';
import { FindJobsPage } from './pages/jobs/FindJobsPage';
import { InterviewPrepPage } from './pages/interview/InterviewPrepPage';
import { LinkedInOptimizerPage } from './pages/linkedin/LinkedInOptimizerPage';
import { CareerCoachPage } from './pages/coach/CareerCoachPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { CareerProfilePage } from './pages/profile/CareerProfilePage';
import { ProfileSetupWizard } from './pages/profile/ProfileSetupWizard';

// Admin pages
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminTemplatesPage } from './pages/admin/AdminTemplatesPage';
import { AdminPlansPage } from './pages/admin/AdminPlansPage';
import { AdminPointsPage } from './pages/admin/AdminPointsPage';
import { AdminPromoCodesPage } from './pages/admin/AdminPromoCodesPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminSeoPage } from './pages/admin/AdminSeoPage';

/** Sends a GA4 pageview on every client-side route change (SPA navigation
 * doesn't trigger a real page load, so GA's automatic pageview only ever
 * fires once without this). No-ops if analytics isn't configured. */
function RouteChangeTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <RouteChangeTracker />
          <Routes>
          {/* Public marketing/landing page */}
          <Route path="/" element={<WelcomePage />} />

          {/* Public legal pages — no auth, linked from footer + Stripe checkout */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />

          {/* Public auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

          {/* Protected app routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/resumes" element={<ResumesListPage />} />
            <Route path="/resumes/new/chat" element={<AIChatBuilderPage />} />
            <Route path="/resumes/:id" element={<ResumeEditorPage />} />
            <Route path="/resumes/:resumeId/chat" element={<AIChatBuilderPage />} />
            <Route path="/resumes/:resumeId/versions" element={<VersionHistoryPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/jobs" element={<JobTrackerPage />} />
            <Route path="/find-jobs" element={<FindJobsPage />} />
            <Route path="/interview" element={<InterviewPrepPage />} />
            <Route path="/linkedin" element={<LinkedInOptimizerPage />} />
            <Route path="/coach" element={<CareerCoachPage />} />
            <Route path="/profile" element={<CareerProfilePage />} />
            <Route path="/profile/setup" element={<ProfileSetupWizard />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/subscription" element={<SettingsPage />} />

            {/* Admin panel — ADMIN role required */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="templates" element={<AdminTemplatesPage />} />
                <Route path="plans" element={<AdminPlansPage />} />
                <Route path="points" element={<AdminPointsPage />} />
                <Route path="promo-codes" element={<AdminPromoCodesPage />} />
                <Route path="audit" element={<AdminAuditPage />} />
                <Route path="seo" element={<AdminSeoPage />} />
              </Route>
            </Route>
          </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
