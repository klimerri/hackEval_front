import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Settings,
  Users,
  UserCheck,
  BarChart,
  Trophy,
  TrendingUp,
  PlusCircle,
  ChevronRight,
  ChevronLeft,
  X,
  Calendar,
  ShieldCheck,
  XCircle,
  Clock,
  Trash2,
} from "lucide-react";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../lib/api";
import type {
  AssignedJury,
  Criterion,
  Hackathon,
  JuryPoolUser,
  OrganizerAnalytics,
  OrgTeam,
  PresentationSection,
} from "../lib/types";

type Tab = "events" | "members" | "analytics";

export function OrganizerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [selectedHackathon, setSelectedHackathon] = useState<number | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [isAddingJury, setIsAddingJury] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newCaptain, setNewCaptain] = useState("");
  const [newJuryId, setNewJuryId] = useState<number | "">("");
  const [juryMode, setJuryMode] = useState<"existing" | "promote" | "create">("existing");
  const [promoteEmail, setPromoteEmail] = useState("");
  const [newJury, setNewJury] = useState({ name: "", email: "", password: "", company: "", specialization: "" });
  const [busy, setBusy] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [critDirty, setCritDirty] = useState(false);
  const [sections, setSections] = useState<PresentationSection[]>([]);
  const [secDirty, setSecDirty] = useState(false);

  const [newHack, setNewHack] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    submission_deadline: "",
    prize_pool: "",
    type: "Online",
    max_team_size: 5,
  });

  const { data: hackathons, reload: reloadHack } = useApi<Hackathon[]>("/hackathons");
  const { data: analytics } = useApi<OrganizerAnalytics>("/organizer/analytics");
  const { data: juryPool, reload: reloadJuryPool } = useApi<JuryPoolUser[]>("/organizer/jury-pool");

  const current = hackathons?.find((h) => h.id === selectedHackathon);

  // teams across the organizer's hackathons (real team shape: members + status)
  const { data: allOrgTeams, reload: reloadTeamsForHack } = useApi<OrgTeam[]>(
    "/organizer/teams",
  );
  const teamsForHack = useMemo(
    () => (allOrgTeams ?? []).filter((t) => t.hackathon_id === current?.id),
    [allOrgTeams, current?.id],
  );

  // actual jury assigned to this hackathon (not the global pool)
  const { data: assignedJury, reload: reloadAssignedJury } = useApi<AssignedJury[]>(
    current ? `/organizer/hackathons/${current.id}/jury` : null,
    [current?.id],
  );

  useEffect(() => {
    if (current) setCriteria(current.jury_criteria ?? []);
    setCritDirty(false);
    if (current) setSections(current.presentation_sections ?? []);
    setSecDirty(false);
  }, [current?.id]);

  const handleCreateHackathon = async () => {
    if (!newHack.title || !newHack.start_date || !newHack.end_date || !newHack.submission_deadline) {
      toast.error("Заполните название и даты");
      return;
    }
    setBusy(true);
    try {
      await api.post<Hackathon>("/hackathons", {
        ...newHack,
        rules: ["Команда от 2 до 5 человек", "Код на GitHub", "OpenSource разрешён"],
        coefficients: { code: 40, design: 30, pitch: 30 },
      });
      toast.success("Хакатон создан");
      setIsCreating(false);
      setNewHack({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        submission_deadline: "",
        prize_pool: "",
        type: "Online",
        max_team_size: 5,
      });
      reloadHack();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (teamId: number) => {
    try {
      await api.post(`/teams/${teamId}/decision`, { decision: "approved" });
      toast.success("Команда одобрена");
      reloadTeamsForHack();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    }
  };
  const handleReject = async (teamId: number) => {
    try {
      await api.post(`/teams/${teamId}/decision`, { decision: "rejected" });
      toast.success("Команда отклонена");
      reloadTeamsForHack();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    }
  };

  const handleAddTeam = async () => {
    if (!current || !newTeamName || !newCaptain) return;
    setBusy(true);
    try {
      await api.post(`/teams/manual`, {
        name: newTeamName,
        captain_email: newCaptain,
        hackathon_id: current.id,
      });
      toast.success("Команда создана (одобрена)");
      setIsAddingTeam(false);
      setNewTeamName("");
      setNewCaptain("");
      reloadTeamsForHack();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTeam = async (teamId: number, name: string) => {
    if (!confirm(`Удалить команду «${name}»? Действие необратимо.`)) return;
    try {
      await api.del(`/teams/${teamId}`);
      toast.success("Команда удалена");
      reloadTeamsForHack();
      reloadHack();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    }
  };

  const resetJuryModal = () => {
    setIsAddingJury(false);
    setJuryMode("existing");
    setNewJuryId("");
    setPromoteEmail("");
    setNewJury({ name: "", email: "", password: "", company: "", specialization: "" });
  };

  const assignJuryById = async (userId: number) => {
    if (!current) return;
    await api.post(`/organizer/hackathons/${current.id}/jury`, { user_id: userId });
  };

  const handleAssignJury = async () => {
    if (!current) return;
    setBusy(true);
    try {
      if (juryMode === "existing") {
        if (!newJuryId) {
          toast.error("Выберите жюри из списка");
          return;
        }
        await assignJuryById(Number(newJuryId));
      } else if (juryMode === "promote") {
        if (!promoteEmail.trim()) {
          toast.error("Укажите email участника");
          return;
        }
        const u = await api.post<{ id: number }>("/organizer/jury/promote", {
          email: promoteEmail.trim(),
        });
        await assignJuryById(u.id);
      } else {
        if (!newJury.name.trim() || !newJury.email.trim() || newJury.password.length < 6) {
          toast.error("Заполните имя, email и пароль (от 6 символов)");
          return;
        }
        const u = await api.post<{ id: number }>("/organizer/jury", {
          name: newJury.name.trim(),
          email: newJury.email.trim(),
          password: newJury.password,
          company: newJury.company || null,
          specialization: newJury.specialization || null,
        });
        await assignJuryById(u.id);
      }
      toast.success("Жюри назначено");
      resetJuryModal();
      reloadHack();
      reloadJuryPool();
      reloadAssignedJury();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleUnassignJury = async (userId: number) => {
    if (!current) return;
    try {
      await api.del(`/organizer/hackathons/${current.id}/jury/${userId}`);
      toast.success("Жюри снято с хакатона");
      reloadHack();
      reloadAssignedJury();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    }
  };

  const slugify = (label: string) =>
    label
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `crit_${Date.now()}`;

  const addCriterion = () => {
    setCriteria((cs) => [...cs, { key: `crit_${Date.now()}`, label: "Новый критерий", weight: 10 }]);
    setCritDirty(true);
  };
  const updateCriterion = (idx: number, patch: Partial<Criterion>) => {
    setCriteria((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    setCritDirty(true);
  };
  const removeCriterion = (idx: number) => {
    setCriteria((cs) => cs.filter((_, i) => i !== idx));
    setCritDirty(true);
  };

  const handleSaveCriteria = async () => {
    if (!current) return;
    const cleaned = criteria
      .map((c) => ({ ...c, label: c.label.trim(), key: c.key || slugify(c.label) }))
      .filter((c) => c.label);
    if (cleaned.length === 0) {
      toast.error("Добавьте хотя бы один критерий");
      return;
    }
    setBusy(true);
    try {
      await api.patch<Hackathon>(`/hackathons/${current.id}`, { jury_criteria: cleaned });
      toast.success("Критерии жюри обновлены");
      setCritDirty(false);
      reloadHack();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const addSection = () => {
    setSections((ss) => [
      ...ss,
      { key: `sec_${Date.now()}`, label: "Новый раздел", keywords: [] },
    ]);
    setSecDirty(true);
  };
  const updateSection = (idx: number, patch: Partial<PresentationSection>) => {
    setSections((ss) => ss.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    setSecDirty(true);
  };
  const removeSection = (idx: number) => {
    setSections((ss) => ss.filter((_, i) => i !== idx));
    setSecDirty(true);
  };

  const handleSaveSections = async () => {
    if (!current) return;
    const cleaned = sections
      .map((s) => ({
        key: s.key || slugify(s.label),
        label: s.label.trim(),
        keywords: s.keywords.map((k) => k.trim()).filter(Boolean),
      }))
      .filter((s) => s.label && s.keywords.length > 0);
    if (cleaned.length === 0) {
      toast.error("Добавьте хотя бы один раздел с ключевыми словами");
      return;
    }
    setBusy(true);
    try {
      await api.patch<Hackathon>(`/hackathons/${current.id}`, { presentation_sections: cleaned });
      toast.success("Структура презентации обновлена");
      setSecDirty(false);
      reloadHack();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (selectedHackathon && current) {
    const teams = teamsForHack ?? [];
    const pending = teams.filter((t) => t.status === "pending");
    const approved = teams.filter((t) => t.status === "approved");

    return (
      <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20">
        <button
          onClick={() => setSelectedHackathon(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronLeft size={20} />
          Назад к списку хакатонов
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{current.title}</h1>
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                  current.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500",
                )}
              >
                {current.status === "active" ? "Запущен" : current.status}
              </span>
            </div>
            <p className="text-gray-500 flex items-center gap-2">
              <Calendar size={16} />
              {new Date(current.start_date).toLocaleDateString("ru-RU")} –{" "}
              {new Date(current.end_date).toLocaleDateString("ru-RU")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {pending.length > 0 && (
              <div className="bg-yellow-50/50 rounded-2xl border border-yellow-100 overflow-hidden">
                <div className="p-6 border-b border-yellow-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Новые заявки на участие</h3>
                      <p className="text-xs text-yellow-700 font-medium">
                        Требуется ваше одобрение ({pending.length})
                      </p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-yellow-100">
                  {pending.map((team) => (
                    <PendingTeamRow
                      key={team.id}
                      team={team}
                      onApprove={() => handleApprove(team.id)}
                      onReject={() => handleReject(team.id)}
                      onDelete={() => handleDeleteTeam(team.id, team.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">Одобренные команды</h3>
                  <p className="text-xs text-gray-500">Мониторинг прогресса участников</p>
                </div>
                <button
                  onClick={() => setIsAddingTeam(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-100"
                >
                  <Plus size={16} /> Добавить вручную
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {approved.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-sm italic">
                    Одобренных команд пока нет
                  </div>
                ) : (
                  approved.map((team) => (
                    <div
                      key={team.id}
                      className="p-4 hover:bg-gray-50/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center border border-blue-100">
                          <Users size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{team.name}</p>
                          <p className="text-xs text-gray-500">
                            {team.members.length} участников · подано:{" "}
                            {team.github_url ? "да" : "нет"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={cn(
                            "px-2 py-1 rounded font-bold uppercase",
                            team.github_url
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-50 text-gray-400",
                          )}
                        >
                          {team.github_url ? "Проект сдан" : "В процессе"}
                        </span>
                        <button
                          onClick={() => handleDeleteTeam(team.id, team.name)}
                          title="Удалить команду"
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Коллегия жюри</h3>
                <button
                  onClick={() => setIsAddingJury(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg hover:bg-blue-600 hover:text-white"
                >
                  <Plus size={16} /> Назначить
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {(assignedJury ?? []).map((j) => (
                  <div
                    key={j.id}
                    className="p-4 bg-gray-50 rounded-xl flex items-center gap-4 border border-gray-100 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm flex-shrink-0">
                      {j.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm truncate">{j.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {j.company ?? "—"} · {j.specialization ?? "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleUnassignJury(j.id)}
                      title="Снять с хакатона"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {(assignedJury ?? []).length === 0 && (
                  <div className="col-span-full text-sm text-gray-400 italic text-center py-4">
                    Жюри ещё не назначено
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h4 className="font-bold text-gray-900 flex items-center gap-2 border-b border-gray-50 pb-4">
                <Settings size={18} className="text-blue-600" />
                Критерии оценки жюри
              </h4>
              <p className="text-[11px] text-gray-400 -mt-1">
                Авто-проверки фиксированы (40% итога). Жюри оценивает по этим критериям (60%);
                веса — относительные.
              </p>
              <div className="space-y-3">
                {criteria.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={c.label}
                      onChange={(e) => updateCriterion(idx, { label: e.target.value })}
                      placeholder="Название критерия"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={c.weight}
                        onChange={(e) => updateCriterion(idx, { weight: Number(e.target.value) })}
                        className="w-16 px-2 py-2 rounded-lg border border-gray-200 text-sm text-center focus:border-blue-500 outline-none"
                      />
                      <span className="text-xs text-gray-400">%</span>
                    </div>
                    <button
                      onClick={() => removeCriterion(idx)}
                      title="Удалить критерий"
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {criteria.length === 0 && (
                  <p className="text-xs text-gray-400">Критериев нет — добавьте первый.</p>
                )}
              </div>
              <button
                onClick={addCriterion}
                className="w-full py-2 text-xs font-semibold text-blue-600 border border-dashed border-blue-200 rounded-lg hover:bg-blue-50"
              >
                + Добавить критерий
              </button>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-gray-400 italic">
                  Сумма весов: {criteria.reduce((a, c) => a + (c.weight || 0), 0)}%
                </p>
                <button
                  onClick={handleSaveCriteria}
                  disabled={!critDirty || busy}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h4 className="font-bold text-gray-900 flex items-center gap-2 border-b border-gray-50 pb-4">
                <Settings size={18} className="text-blue-600" />
                Структура презентации
              </h4>
              <p className="text-[11px] text-gray-400 -mt-1">
                Разделы, наличие которых проверяется в презентации команд. Каждый раздел
                ищется по ключевым словам (через запятую) в тексте слайдов.
              </p>
              <div className="space-y-3">
                {sections.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        value={s.label}
                        onChange={(e) => updateSection(idx, { label: e.target.value })}
                        placeholder="Название раздела"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"
                      />
                      <input
                        value={s.keywords.join(", ")}
                        onChange={(e) =>
                          updateSection(idx, { keywords: e.target.value.split(",").map((k) => k.trimStart()) })
                        }
                        placeholder="ключевые слова: проблема, problem"
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => removeSection(idx)}
                      title="Удалить раздел"
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {sections.length === 0 && (
                  <p className="text-xs text-gray-400">Разделов нет — добавьте первый.</p>
                )}
              </div>
              <button
                onClick={addSection}
                className="w-full py-2 text-xs font-semibold text-blue-600 border border-dashed border-blue-200 rounded-lg hover:bg-blue-50"
              >
                + Добавить раздел
              </button>
              <div className="flex items-center justify-end pt-1">
                <button
                  onClick={handleSaveSections}
                  disabled={!secDirty || busy}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <BarChart size={18} className="text-blue-600" />
                Быстрая статистика
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Заявок</p>
                  <p className="text-lg font-black text-gray-900">{teams.length}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Подано</p>
                  <p className="text-lg font-black text-green-600">
                    {approved.filter((t) => t.github_url).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isAddingTeam && (
          <Modal onClose={() => setIsAddingTeam(false)} title="Добавить команду">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Название команды</label>
                <input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Введите название..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Email капитана</label>
                <input
                  type="email"
                  value={newCaptain}
                  onChange={(e) => setNewCaptain(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                />
              </div>
              <button
                onClick={handleAddTeam}
                disabled={busy}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
              >
                {busy ? "Добавление..." : "Добавить в хакатон"}
              </button>
            </div>
          </Modal>
        )}

        {isAddingJury && (
          <Modal onClose={resetJuryModal} title="Назначить жюри">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "existing", label: "Из списка" },
                    { id: "promote", label: "По email" },
                    { id: "create", label: "Новый" },
                  ] as { id: "existing" | "promote" | "create"; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setJuryMode(m.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-bold border transition-colors",
                      juryMode === m.id
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-500 border-gray-200 hover:border-blue-300",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {juryMode === "existing" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Существующее жюри
                  </label>
                  <select
                    value={newJuryId}
                    onChange={(e) => setNewJuryId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                  >
                    <option value="">Выберите...</option>
                    {(juryPool ?? []).map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name} ({j.email})
                      </option>
                    ))}
                  </select>
                  {(juryPool ?? []).length === 0 && (
                    <p className="text-xs text-gray-400">
                      Список пуст — повысьте участника по email или создайте новый аккаунт.
                    </p>
                  )}
                </div>
              )}

              {juryMode === "promote" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Email зарегистрированного участника
                  </label>
                  <input
                    type="email"
                    value={promoteEmail}
                    onChange={(e) => setPromoteEmail(e.target.value)}
                    placeholder="participant@mail.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-400">
                    Участник получит роль жюри и будет назначен на этот хакатон.
                  </p>
                </div>
              )}

              {juryMode === "create" && (
                <div className="space-y-3">
                  <input
                    value={newJury.name}
                    onChange={(e) => setNewJury({ ...newJury, name: e.target.value })}
                    placeholder="ФИО"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                  />
                  <input
                    type="email"
                    value={newJury.email}
                    onChange={(e) => setNewJury({ ...newJury, email: e.target.value })}
                    placeholder="email@mail.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                  />
                  <input
                    type="password"
                    value={newJury.password}
                    onChange={(e) => setNewJury({ ...newJury, password: e.target.value })}
                    placeholder="Пароль (от 6 символов)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={newJury.company}
                      onChange={(e) => setNewJury({ ...newJury, company: e.target.value })}
                      placeholder="Компания"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                    />
                    <input
                      value={newJury.specialization}
                      onChange={(e) => setNewJury({ ...newJury, specialization: e.target.value })}
                      placeholder="Специализация"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleAssignJury}
                disabled={busy}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Назначение..." : "Назначить"}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Панель организатора</h1>
          <p className="text-gray-500">Управление мероприятиями, жюри и коэффициентами оценки.</p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
        >
          <PlusCircle size={20} />
          Создать хакатон
        </button>
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        {(
          [
            { id: "events", label: "Мероприятия" },
            { id: "members", label: "Общий список жюри" },
            { id: "analytics", label: "Аналитика" },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap",
              activeTab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "events" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(hackathons ?? []).map((h) => (
            <div
              key={h.id}
              onClick={() => setSelectedHackathon(h.id)}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Trophy size={24} />
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                      h.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {h.status === "active" ? "Запущен" : h.status}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600">
                    {h.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{h.description}</p>
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Users size={16} />
                    <span className="font-semibold text-gray-700">{h.teams_count}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <UserCheck size={16} />
                    <span className="font-semibold text-gray-700">{h.jury_count}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400 ml-auto">
                    <Clock size={16} />
                    <span className="text-[10px] font-bold">
                      до {new Date(h.submission_deadline).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-600">Управление хакатоном</span>
                <ChevronRight size={18} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
          {hackathons && hackathons.length === 0 && (
            <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-500 text-sm">
              Создайте первый хакатон.
            </div>
          )}
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-8 animate-in zoom-in-95 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-600" />
                Активность участия по мероприятиям
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={analytics?.participation ?? []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                      dataKey="title"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9ca3af", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                      cursor={{ fill: "#eff6ff" }}
                    />
                    <Bar dataKey="students" radius={[6, 6, 0, 0]} fill="#2563eb" barSize={40}>
                      {(analytics?.participation ?? []).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 ? "#2563eb" : "#3b82f6"} />
                      ))}
                    </Bar>
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Trophy size={20} className="text-yellow-500" />
                Сводка
              </h3>
              <div className="space-y-4">
                <Stat label="Всего заявок" value={analytics?.total_applications ?? 0} />
                <Stat label="Активных жюри" value={analytics?.active_jury ?? 0} />
                <Stat label="Средний балл" value={analytics?.avg_score?.toFixed(1) ?? "—"} />
                <Stat label="Призовой фонд" value={analytics?.prize_pool_total ?? "—"} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "members" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Список экспертов (Жюри)</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-4">Имя / Компания</th>
                <th className="px-6 py-4">Специализация</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(juryPool ?? [])
                .filter((j) => j.role !== "participant")
                .map((j) => (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                          {j.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{j.name}</p>
                          <p className="text-xs text-gray-500">{j.company ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {j.specialization ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{j.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          j.role === "organizer"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700",
                        )}
                      >
                        {j.role === "organizer" ? "Организатор" : "Доступен"}
                      </span>
                    </td>
                  </tr>
                ))}
              {juryPool && juryPool.filter((j) => j.role !== "participant").length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-gray-400 text-sm italic">
                    Пока нет пользователей с ролью жюри или организатора.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {isCreating && (
        <Modal onClose={() => setIsCreating(false)} title="Создать хакатон" wide>
          <div className="space-y-4">
            <Field label="Название">
              <input
                value={newHack.title}
                onChange={(e) => setNewHack({ ...newHack, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none"
              />
            </Field>
            <Field label="Описание">
              <textarea
                value={newHack.description}
                onChange={(e) => setNewHack({ ...newHack, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none"
              />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Начало">
                <input
                  type="datetime-local"
                  value={newHack.start_date}
                  onChange={(e) => setNewHack({ ...newHack, start_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none"
                />
              </Field>
              <Field label="Окончание">
                <input
                  type="datetime-local"
                  value={newHack.end_date}
                  onChange={(e) => setNewHack({ ...newHack, end_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none"
                />
              </Field>
              <Field label="Дедлайн подачи">
                <input
                  type="datetime-local"
                  value={newHack.submission_deadline}
                  onChange={(e) =>
                    setNewHack({ ...newHack, submission_deadline: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none"
                />
              </Field>
              <Field label="Призовой фонд">
                <input
                  value={newHack.prize_pool}
                  onChange={(e) => setNewHack({ ...newHack, prize_pool: e.target.value })}
                  placeholder="500 000 ₽"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none"
                />
              </Field>
              <Field label="Тип">
                <select
                  value={newHack.type}
                  onChange={(e) => setNewHack({ ...newHack, type: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none"
                >
                  <option>Online</option>
                  <option>Offline</option>
                  <option>Hybrid</option>
                </select>
              </Field>
              <Field label="Макс. размер команды">
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={newHack.max_team_size}
                  onChange={(e) =>
                    setNewHack({ ...newHack, max_team_size: Number(e.target.value) })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none"
                />
              </Field>
            </div>
            <button
              onClick={handleCreateHackathon}
              disabled={busy}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Создание..." : "Создать"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={cn(
          "bg-white rounded-3xl w-full p-8 space-y-6 shadow-2xl animate-in zoom-in-95",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={24} className="text-gray-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
      <span className="text-xs text-gray-500 font-semibold uppercase">{label}</span>
      <span className="text-lg font-black text-gray-900">{value}</span>
    </div>
  );
}

function PendingTeamRow({
  team,
  onApprove,
  onReject,
  onDelete,
}: {
  team: OrgTeam;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white rounded-2xl border border-yellow-200 flex items-center justify-center font-bold text-yellow-600 shadow-sm">
          {team.name[0]}
        </div>
        <div>
          <p className="font-bold text-gray-900">{team.name}</p>
          <p className="text-xs text-gray-500">
            Подано: {team.applied_at ? new Date(team.applied_at).toLocaleDateString("ru-RU") : "—"} ·{" "}
            {team.members.length} участников
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onReject}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-red-100 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50"
        >
          <XCircle size={18} />
          Отклонить
        </button>
        <button
          onClick={onApprove}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
        >
          <ShieldCheck size={18} />
          Одобрить участие
        </button>
        <button
          onClick={onDelete}
          title="Удалить команду"
          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
