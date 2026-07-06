import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import LiveOrders from './pages/LiveOrders';
import PastOrders from './pages/PastOrders';
import MenuManagement from './pages/MenuManagement';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

const ProtectedRoute = ({ children }) => {
  const { user, restaurant, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!user || !restaurant) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<LiveOrders />} />
            <Route path="past-orders" element={<PastOrders />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
