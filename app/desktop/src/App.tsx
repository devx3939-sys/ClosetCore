import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import Login from './screens/Login';
import Closet from './screens/Closet';
import AddItem from './screens/AddItem';
import Outfits from './screens/Outfits';
import Palette from './screens/Palette';
import Profile from './screens/Profile';
import Subscription from './screens/Subscription';

function Shell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const tab = (path: string, label: string) => (
    <Link
      to={path}
      className={`nav-tab ${loc.pathname.startsWith(path) ? 'active' : ''}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">ClosetCore</div>
        <nav>
          {tab('/closet', 'My Closet')}
          {tab('/outfits', 'Outfits')}
          {tab('/palette', 'Color Palette')}
          {tab('/profile', 'Profile')}
          {tab('/subscription', 'Subscription')}
          {tab('/add', 'Add Item')}
        </nav>
        <button
          className="nav-logout"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  if (session) return <Navigate to="/closet" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <Login />
            </PublicOnly>
          }
        />
        <Route
          path="/closet"
          element={
            <Protected>
              <Closet />
            </Protected>
          }
        />
        <Route
          path="/add"
          element={
            <Protected>
              <AddItem />
            </Protected>
          }
        />
        <Route
          path="/outfits"
          element={
            <Protected>
              <Outfits />
            </Protected>
          }
        />
        <Route
          path="/palette"
          element={
            <Protected>
              <Palette />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <Profile />
            </Protected>
          }
        />
        <Route
          path="/subscription"
          element={
            <Protected>
              <Subscription />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/closet" replace />} />
      </Routes>
    </AuthProvider>
  );
}
