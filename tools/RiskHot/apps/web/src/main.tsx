import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { AppShell, Dashboard, RiskDetailPage, SectionPage } from './App';
import { ApiError } from './api';
import './styles.css';
import './management.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) =>
        !(error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) && count < 1,
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard });
const sectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$section',
  validateSearch: (search: Record<string, unknown>): { view?: string } =>
    typeof search.view === 'string' ? { view: search.view } : {},
  component: SectionPage,
});
const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/risks/$riskId',
  component: RiskDetailPage,
});
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, sectionRoute, detailRoute]),
  defaultPreload: 'intent',
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
