import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { LakeSearch } from './pages/LakeSearch';
import { LakeDetail } from './pages/LakeDetail';
import { Login } from './pages/Login';
import { IceFishing } from './pages/IceFishing';
import { Pricing } from './pages/Pricing';
import { Guides } from './pages/Guides';
import { About } from './pages/About';
import { Features } from './pages/Features';
import { HowItWorks } from './pages/HowItWorks';
import { Faq } from './pages/Faq';
import { Social } from './pages/Social';
import { BorderWaters } from './pages/BorderWaters';
import { Regulations } from './pages/Regulations';
import { SubmitReport } from './pages/SubmitReport';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { NotFound } from './pages/NotFound';
import { Profile } from './pages/Profile';
import { Onboarding } from './pages/Onboarding';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { AppHeader } from './components/shared/AppHeader';
import { AppNav } from './components/nav/AppNav';

function LakeRedirect({ tab }: { tab?: 'surveys' }) {
  const { lakeId } = useParams();
  const target = lakeId ? `/lake/${lakeId}${tab ? `?tab=${tab}` : ''}` : '/search';
  return <Navigate to={target} replace />;
}

function SiteShell() {
  const location = useLocation();
  const hideNav = location.pathname === '/onboarding';

  return (
    <div className="flex min-h-dvh flex-col bg-castiq-blue-dark">
      <AppHeader />
      <main className={hideNav ? 'flex-1' : 'flex-1 pb-20 lg:pb-8'}>
        <Outlet />
      </main>
      {!hideNav && <AppNav />}
    </div>
  );
}

function AuthenticatedShell() {
  return (
    <ProtectedRoute>
      <SiteShell />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/sign-in" element={<Navigate to="/login" replace />} />
        <Route element={<SiteShell />}>
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/tactics" element={<Guides />} />
          <Route path="/guides" element={<Navigate to="/tactics" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/social" element={<Social />} />
          <Route path="/border-waters" element={<BorderWaters />} />
          <Route path="/regulations" element={<Regulations />} />
          <Route path="/submit-report" element={<SubmitReport />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route element={<AuthenticatedShell />}>
          <Route path="/" element={<Navigate to="/search" replace />} />
          <Route path="/search" element={<LakeSearch />} />
          <Route path="/lake/:lakeId" element={<LakeDetail />} />
          <Route path="/lake/:lakeId/live" element={<LakeRedirect />} />
          <Route path="/lake/:lakeId/fisheries" element={<LakeRedirect tab="surveys" />} />
          <Route path="/lake/:lakeId/contours" element={<LakeRedirect />} />
          <Route path="/ice" element={<IceFishing />} />
          <Route path="/guide" element={<Navigate to="/search" replace />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
