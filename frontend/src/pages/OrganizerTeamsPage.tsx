import { useMemo, useState } from "react";
import {
  IconUsers as Users,
  IconSearch as Search,
  IconTrash as Trash2,
  IconUserX as UserX,
  IconCheck as Check,
  IconX as X,
  IconShieldCheck as ShieldCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../lib/api";
import type { OrgTeam } from "../lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "На рассмотрении",
  approved: "Одобрена",
  rejected: "Отклонена",
};
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export function OrganizerTeamsPage() {
  const { data, loading, error, reload } = useApi<OrgTeam[]>("/organizer/teams");
  const [search, setSearch] = useState("");
  const [hackFilter, setHackFilter] = useState<number | "all">("all");
  const [busy, setBusy] = useState(false);

  const teams = data ?? [];

  const hackathons = useMemo(() => {
    const map = new Map<number, string>();
    teams.forEach((t) => map.set(t.hackathon_id, t.hackathon_title));
    return Array.from(map.entries());
  }, [teams]);

  const filtered = teams.filter(
    (t) =>
      (hackFilter === "all" || t.hackathon_id === hackFilter) &&
      (!search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.hackathon_title.toLowerCase().includes(search.toLowerCase())),
  );

  const decide = async (teamId: number, decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      await api.post(`/teams/${teamId}/decision`, { decision });
      toast.success(decision === "approved" ? "Команда одобрена" : "Команда отклонена");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (teamId: number, userId: number, name: string) => {
    if (!confirm(`Исключить участника ${name} из команды?`)) return;
    setBusy(true);
    try {
      await api.del(`/teams/${teamId}/members/${userId}`);
      toast.success("Участник исключён");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const deleteTeam = async (teamId: number, name: string) => {
    if (!confirm(`Удалить команду «${name}»? Действие необратимо.`)) return;
    setBusy(true);
    try {
      await api.del(`/teams/${teamId}`);
      toast.success("Команда удалена");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Команды</h1>
        <p className="text-gray-500">
          Все команды ваших хакатонов: одобрение заявок, состав и модерация.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по команде или хакатону..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={hackFilter}
          onChange={(e) => setHackFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
        >
          <option value="all">Все хакатоны</option>
          {hackathons.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="text-gray-400">Загрузка...</div>}
      {error && <div className="text-red-500">Ошибка: {error}</div>}

      {!loading && filtered.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-500 text-sm">
          Команд пока нет.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((team) => (
            <div
              key={team.id}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold flex-shrink-0">
                    {team.name[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{team.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{team.hackathon_title}</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase whitespace-nowrap ${STATUS_CLASS[team.status]}`}
                >
                  {STATUS_LABEL[team.status]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 border-t border-gray-50 pt-3">
                <span className="flex items-center gap-1.5">
                  <Users size={15} className="text-gray-400" /> {team.members.length} участников
                </span>
                <span className="text-xs text-gray-400">
                  Проект: {team.github_url ? "сдан" : "нет"}
                </span>
              </div>

              <div className="space-y-2">
                {team.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {m.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{m.email}</p>
                      </div>
                    </div>
                    {m.role === "captain" ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex-shrink-0">
                        Капитан
                      </span>
                    ) : (
                      <button
                        onClick={() => removeMember(team.id, m.user_id, m.name)}
                        disabled={busy}
                        title="Исключить"
                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 flex-shrink-0"
                      >
                        <UserX size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {team.status === "pending" && (
                  <>
                    <button
                      onClick={() => decide(team.id, "approved")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Check size={14} /> Одобрить
                    </button>
                    <button
                      onClick={() => decide(team.id, "rejected")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white border border-red-100 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      <X size={14} /> Отклонить
                    </button>
                  </>
                )}
                {team.status === "rejected" && (
                  <button
                    onClick={() => decide(team.id, "approved")}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    <ShieldCheck size={14} /> Восстановить
                  </button>
                )}
                <button
                  onClick={() => deleteTeam(team.id, team.name)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 ml-auto"
                >
                  <Trash2 size={14} /> Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
