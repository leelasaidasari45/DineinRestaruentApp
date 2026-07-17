import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ChefHat, ClipboardList, History, UtensilsCrossed, BarChart3, Settings, LogOut } from 'lucide-react';
import { Toaster } from 'sonner';

export default function Layout() {
  const { restaurant, logout } = useAuth();

  const navItems = [
    { name: 'Live Orders', path: '/', icon: ClipboardList },
    { name: 'Past Orders', path: '/past-orders', icon: History },
    { name: 'Menu', path: '/menu', icon: UtensilsCrossed },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden flex-col md:flex-row">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-brand-500 rounded-full p-1.5">
            <ChefHat className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 tracking-tight">zunoindia For Restaurant</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full max-w-[120px] truncate">
            {restaurant?.name || 'Restaurant'}
          </span>
          <button
            onClick={logout}
            className="text-gray-500 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 gap-3">
          <div className="bg-brand-500 rounded-full p-2">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900 tracking-tight">zunoindia For Restaurant</span>
        </div>
        
        <div className="flex-1 py-6 flex flex-col gap-1 px-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-brand-50 text-brand-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold overflow-hidden">
              {restaurant?.photo_url ? (
                <img src={restaurant.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                restaurant?.name?.charAt(0) || 'R'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {restaurant?.name || 'Restaurant'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation (hidden on desktop) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around px-2 z-40 shadow-lg">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 w-16 py-1 rounded-lg transition-colors ${
                isActive 
                  ? 'text-brand-600 font-semibold' 
                  : 'text-gray-500 hover:text-gray-950'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* global sonner toaster container */}
      <Toaster position="top-right" richColors />
    </div>
  );
}
