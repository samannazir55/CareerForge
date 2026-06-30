import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Public
import { WelcomePage } from './pages/welcome/WelcomePage';

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
import { SettingsPage } from './pages/settings/SettingsPage';
import { CareerProfilePage } from './pages/profile/CareerProfilePage';
import { ProfileSetupWizard } from './pages/profile/ProfileSetupWizard';

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Public marketing/landing page */}
          <Route path="/" element={<WelcomePage />} />

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
            <Route path="/resumes/:id/chat" element={<AIChatBuilderPage />} />
            <Route path="/resumes/:resumeId/versions" element={<VersionHistoryPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/profile" element={<CareerProfilePage />} />
            <Route path="/profile/setup" element={<ProfileSetupWizard />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/subscription" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
