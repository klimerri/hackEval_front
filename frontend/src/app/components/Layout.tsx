import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import {
  IconLayoutDashboard as LayoutDashboard,
  IconTrophy as Trophy,
  IconUsers as Users,
  IconChartBar as BarChart3,
  IconLogout as LogOut,
  IconUser as User,
  IconShield as Shield,
  IconUserCheck as UserCheck,
  IconMedal as Medal,
  IconMenu2 as Menu,
  IconX as X,
} from "@tabler/icons-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../lib/auth";
import { NotificationsBell } from "./NotificationsBell";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { name: "Дашборд", path: "/", icon: LayoutDashboard },
    { name: "Хакатоны", path: "/hackathons", icon: Trophy },
    { name: "Рейтинг", path: "/leaderboard", icon: Medal },
    ...(user?.role === "participant"
      ? [
          { name: "Команды", path: "/teams", icon: Users },
          { name: "Результаты", path: "/results", icon: BarChart3 },
        ]
      : []),
    ...(user?.role === "jury" || user?.role === "organizer"
      ? [{ name: "Жюри", path: "/jury", icon: UserCheck }]
      : []),
    ...(user?.role === "organizer"
      ? [
          { name: "Команды", path: "/manage-teams", icon: Users },
          { name: "Организатор", path: "/organizer", icon: Shield },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <span>Базис</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100",
                )}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-gray-900 font-bold">
              <span>Базис</span>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-6">
            <NotificationsBell />
            <div className="flex items-center gap-2 lg:gap-3 pl-3 lg:pl-6 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] lg:max-w-none">
                  {user?.name ?? "Пользователь"}
                </p>
                <p className="text-xs text-gray-500 truncate max-w-[120px] lg:max-w-none">
                  {user?.email ?? "—"}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold shrink-0">
                {user?.name?.[0] ?? <User size={20} />}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
