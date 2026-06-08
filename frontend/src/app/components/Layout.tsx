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

type NavItem = { name: string; path: string; icon: typeof LayoutDashboard };

function BrandMark() {
  return (
    <div className="relative h-10 w-10 shrink-0">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_6px_20px_-6px_rgba(59,130,246,0.7)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3px]">
        <span className="block h-[3px] w-3.5 rounded-full bg-white/95" />
        <span className="block h-[3px] w-4 rounded-full bg-white/80" />
        <span className="block h-[3px] w-[18px] rounded-full bg-white/60" />
      </div>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const mainNav: NavItem[] = [
    { name: "Дашборд", path: "/", icon: LayoutDashboard },
    { name: "Хакатоны", path: "/hackathons", icon: Trophy },
    { name: "Рейтинг", path: "/leaderboard", icon: Medal },
  ];

  const roleNav: NavItem[] = [
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

  const roleLabel =
    user?.role === "organizer" ? "Организатор" : user?.role === "jury" ? "Жюри" : "Участник";

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
          active
            ? "bg-white/[0.07] text-white"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-500 transition-all duration-300",
            active
              ? "opacity-100 shadow-[0_0_12px_rgba(59,130,246,0.8)]"
              : "opacity-0 -translate-x-1",
          )}
        />
        <Icon
          size={19}
          stroke={1.75}
          className={cn(
            "shrink-0 transition-colors",
            active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300",
          )}
        />
        <span className={cn("font-medium tracking-tight", active && "font-semibold")}>
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col bg-[#0e0f15] text-slate-200 transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* atmospheric glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(120%_80%_at_30%_0%,rgba(59,130,246,0.18),transparent_70%)]" />

        <div className="relative flex items-center justify-between px-5 py-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="leading-none">
              <div className="font-display text-lg font-bold tracking-tight text-white">
                Базис
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Оценка решений
              </div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-scroll relative flex-1 space-y-7 overflow-y-auto px-3 pb-4">
          <div className="space-y-1">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Навигация
            </p>
            {mainNav.map(renderItem)}
          </div>

          {roleNav.length > 0 && (
            <div className="space-y-1">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                {roleLabel}
              </p>
              {roleNav.map(renderItem)}
            </div>
          )}
        </nav>

        <div className="relative m-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/90 to-indigo-600 text-sm font-bold text-white ring-2 ring-blue-500/20">
              {user?.name?.[0] ?? <User size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {user?.name ?? "Пользователь"}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email ?? "—"}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Выйти"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut size={18} stroke={1.75} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <span className="font-display text-base font-bold tracking-tight text-slate-900">
                Базис
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-5">
            <NotificationsBell />
            <div className="hidden items-center gap-2.5 border-l border-slate-200 pl-4 sm:flex">
              <div className="text-right">
                <p className="max-w-[140px] truncate text-sm font-semibold text-slate-900">
                  {user?.name ?? "Пользователь"}
                </p>
                <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
                  {roleLabel}
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {user?.name?.[0] ?? <User size={18} />}
              </div>
            </div>
          </div>
        </header>

        <main className="app-canvas flex-1 overflow-y-auto p-4 lg:p-8">
          <div key={location.pathname} className="page-enter mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
