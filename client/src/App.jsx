import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/index.js';
import AuthLayout from './layouts/AuthLayout.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import SourcesListPage from './pages/sources/SourcesListPage.jsx';
import DestinationsListPage from './pages/destinations/DestinationsListPage.jsx';
import PipelinesListPage from './pages/pipelines/PipelinesListPage.jsx';
import PipelineCreatePage from './pages/pipelines/PipelineCreatePage.jsx';
import PipelineDetailPage from './pages/pipelines/PipelineDetailPage.jsx';
import RunHistoryPage from './pages/history/RunHistoryPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

import ErrorBoundary from './components/common/ErrorBoundary.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Routes>
            {/* Public-only routes: redirect already-authenticated users to /dashboard */}
            <Route element={<PublicOnlyRoute />}>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>
            </Route>

            {/* Protected routes: require authenticated session and render inside AppLayout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/pipelines" element={<PipelinesListPage />} />
                <Route path="/pipelines/new" element={<PipelineCreatePage />} />
                <Route path="/pipelines/:id" element={<PipelineDetailPage />} />
                <Route path="/sources" element={<SourcesListPage />} />
                <Route path="/destinations" element={<DestinationsListPage />} />
                <Route path="/history" element={<RunHistoryPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </ToastProvider>
  </BrowserRouter>
  );
}
