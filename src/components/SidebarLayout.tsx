'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  CalendarPlus, 
  Calendar, 
  Clock, 
  Users, 
  BarChart3,
  GraduationCap,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const baseNavigation = [
  { name: 'All Quizzes', href: '/quizzes', icon: Calendar },
  { name: 'Add Quiz', href: '/add-quiz', icon: CalendarPlus, adminOnly: true },
  { name: 'Schedules', href: '/schedules', icon: Clock },
  { name: 'Manage Proctors', href: '/proctors', icon: Users, adminOnly: true },
  { name: 'Summary', href: '/summary', icon: BarChart3 },
];

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const navigation = baseNavigation.map(item => {
    if (item.href === '/schedules') {
      return { ...item, name: isAdmin ? 'TA Schedules' : 'My Schedule' };
    }
    if (item.href === '/summary') {
      return { ...item, name: isAdmin ? 'Proctor Summary' : 'My Summary' };
    }
    if (item.href === '/quizzes' && !isAdmin) {
       return { ...item, name: 'View Quizzes' }; 
    }
    return item;
  });

  const filteredNav = navigation.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside 
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } glass fixed h-full flex flex-col transition-all duration-300 ease-in-out z-30`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg hover:bg-indigo-500 transition-colors z-40"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        <div className={`p-4 flex-1 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center gap-3 mb-8 ${isCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden transition-all duration-300">
                <h1 className="font-bold text-lg text-white whitespace-nowrap">Quiz Proctor</h1>
                <p className="text-xs text-slate-400 whitespace-nowrap">Assignment System</p>
              </div>
            )}
          </div>

          <nav className="space-y-1 w-full text-center">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : ''}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isCollapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-400 border-l-4 border-indigo-500'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Section */}
        {user && (
          <div className={`p-4 border-t border-white/10 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
            <div className={`flex items-center gap-3 mb-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div title={user.name || user.email} className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                {(user.name || user.email || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{user.name || user.email}</p>
                  <div className="flex items-center gap-1">
                    {isAdmin && <Shield className="w-3 h-3 text-amber-400" />}
                    <span className={`text-xs ${isAdmin ? 'text-amber-400' : 'text-slate-400'}`}>
                      {isAdmin ? 'Admin' : 'TA'} • {user.major || 'CS'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={logout}
              title={isCollapsed ? 'Sign Out' : ''}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className={`flex-1 transition-all duration-300 ease-in-out p-8 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        {children}
      </main>
    </div>
  );
}
