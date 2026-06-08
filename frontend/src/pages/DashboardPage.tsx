import {
  IconTrophy as Trophy,
  IconArrowRight as ArrowRight,
  IconUsers as Users,
  IconStar as Star,
  IconShieldCheck as ShieldCheck,
  IconChartBar as BarChart3,
} from "@tabler/icons-react";
import { Link, useNavigate } from "react-router";
import { useApi } from "../lib/useApi";
import type { Dashboard, Role } from "../lib/types";
import { useAuth } from "../lib/auth";

function formatDate(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

function timeAgo(s: string): string {
  const d = new Date(s);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return d.toLocaleDateString("ru-RU");
}

type QuickAction = { label: string; hint: string; to: string; icon: typeof Trophy; color: string; bg: string };

const QUICK_ACTIONS: Record<Role, QuickAction[]> = {
  participant: [
    { label: "Найти хакатон", hint: "Каталог мероприятий", to: "/hackathons", icon: Trophy, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Мои команды", hint: "Создать или вступить", to: "/teams", icon: Users, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Результаты", hint: "Оценки и проверки", to: "/results", icon: BarChart3, color: "text-green-600", bg: "bg-green-100" },
  ],
  jury: [
    { label: "Перейти к оценке", hint: "Команды на проверке", to: "/jury", icon: Star, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Каталог хакатонов", hint: "Посмотреть мероприятия", to: "/hackathons", icon: Trophy, color: "text-blue-600", bg: "bg-blue-100" },
  ],
  organizer: [
    { label: "Панель организатора", hint: "Хакатоны, жюри, веса", to: "/organizer", icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Команды", hint: "Заявки и состав", to: "/manage-teams", icon: Users, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Каталог хакатонов", hint: "Все мероприятия", to: "/hackathons", icon: Trophy, color: "text-green-600", bg: "bg-green-100" },
  ],
};

const CFG: Record<Role, { title: string; empty: string; link: string; linkText: string; col2: string; col4: string }> = {
  participant: { title: "Ваши активности", empty: "Пока нет активностей. Запишитесь на хакатон в разделе «Команды».", link: "/hackathons", linkText: "Все хакатоны", col2: "Команда", col4: "Баллы" },
  jury: { title: "Хакатоны на оценке", empty: "Вам пока не назначены хакатоны для оценки.", link: "/jury", linkText: "К оценке", col2: "Прогресс", col4: "Статус" },
  organizer: { title: "Мои хакатоны", empty: "У вас пока нет хакатонов. Создайте первый в панели организатора.", link: "/organizer", linkText: "Управление", col2: "Команды", col4: "Одобрено" },
};

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error } = useApi<Dashboard>("/dashboard");

  if (loading) {
    return <div className="text-gray-400">Загрузка...</div>;
  }
  if (error) {
    return <div className="text-red-500">Ошибка: {error}</div>;
  }
  if (!data) return null;

  const role = data.role;
  const actions = QUICK_ACTIONS[role] ?? QUICK_ACTIONS.participant;
  const cfg = CFG[role] ?? CFG.participant;
  const roleRu = role === "organizer" ? "Организатор" : role === "jury" ? "Жюри" : "Участник";

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-8 shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl" />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
          Панель · {roleRu}
        </p>
        <h1 className="relative mt-3 text-3xl font-bold text-slate-900">
          Рады видеть вас, {user?.name ?? "!"}
        </h1>
        <p className="relative mt-2 max-w-xl text-slate-500">
          Быстрый доступ к ключевым разделам платформы оценки решений.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.to}
              to={a.to}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className={`${a.bg} ${a.color} grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110`}>
                <Icon size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold tracking-tight text-slate-900">{a.label}</p>
                <p className="truncate text-sm text-slate-500">{a.hint}</p>
              </div>
              <ArrowRight
                size={18}
                className="-translate-x-1 text-slate-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-blue-500 group-hover:opacity-100"
              />
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{cfg.title}</h2>
            <Link
              to={cfg.link}
              className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1"
            >
              {cfg.linkText} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {data.my_hackathons.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">{cfg.empty}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[480px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Хакатон
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {cfg.col2}
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Статус
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {cfg.col4}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.my_hackathons.map((h) => (
                      <tr
                        key={h.id}
                        onClick={() => navigate(`/hackathons/${h.id}`)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{h.title}</p>
                          <p className="text-xs text-gray-500">Дедлайн: {formatDate(h.deadline)}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{h.team}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              h.status === "active"
                                ? "bg-blue-100 text-blue-700"
                                : h.status === "finished"
                                  ? "bg-gray-100 text-gray-600"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {h.status === "active"
                              ? "В процессе"
                              : h.status === "finished"
                                ? "Завершён"
                                : "Черновик"}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-blue-600">{h.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold">Объявления</h2>
          <div className="space-y-4">
            {data.announcements.map((a) => (
              <div
                key={a.id}
                className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-600 uppercase">Новость</span>
                  <span className="text-xs text-gray-400">{timeAgo(a.created_at)}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{a.title}</p>
                <p className="text-xs text-gray-500">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
