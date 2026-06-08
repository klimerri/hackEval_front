import { useEffect, useMemo, useState } from "react";
import {
  IconPlus as Plus,
  IconSettings as Settings,
  IconUsers as Users,
  IconUserCheck as UserCheck,
  IconTrophy as Trophy,
  IconTrendingUp as TrendingUp,
  IconCirclePlus as PlusCircle,
  IconChevronRight as ChevronRight,
  IconChevronLeft as ChevronLeft,
  IconX as X,
  IconCalendar as Calendar,
  IconShieldCheck as ShieldCheck,
  IconCircleX as XCircle,
  IconClock as Clock,
  IconTrash as Trash2,
} from "@tabler/icons-react";
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
type DetailTab = "overview" | "teams" | "jury" | "settings";

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
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

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

  const { data: allOrgTeams, reload: reloadTeamsForHack } = useApi<OrgTeam[]>(
    "/organizer/teams",
  );
  const teamsForHack = useMemo(
    () => (allOrgTeams ?? []).filter((t) => t.hackathon_id === current?.id),
    [allOrgTeams, current?.id],
  );

  const { data: assignedJury, reload: reloadAssignedJury } = useApi<AssignedJury[]>(
    current ? `/organizer/hackathons/${current.id}/jury` : null,
    [current?.id],
  );

  useEffect(() => {
    if (current) setCriteria(current.jury_criteria ?? []);
    setCritDirty(false);
    if (current) setSections(current.presentation_sections ?? []);
    setSecDirty(false);
    setDetailTab("overview");
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

  const criteriaCard = (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
      <h4 className="flex items-center gap-2 border-b border-slate-100 pb-4 font-bold text-slate-900">
        <Settings size={18} className="text-blue-600" />
        Критерии оценки жюри
      </h4>
      <p className="-mt-1 text-[11px] text-slate-400">
        Авто-проверки фиксированы (40% итога). Жюри оценивает по этим критериям (60%); веса —
        относительные.
      </p>
      <div className="space-y-3">
        {criteria.map((c, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              value={c.label}
              onChange={(e) => updateCriterion(idx, { label: e.target.value })}
              placeholder="Название критерия"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <div className="flex flex-shrink-0 items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                value={c.weight}
                onChange={(e) => updateCriterion(idx, { weight: Number(e.target.value) })}
                className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-center text-sm outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
            <button
              onClick={() => removeCriterion(idx)}
              title="Удалить критерий"
              className="flex-shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {criteria.length === 0 && (
          <p className="text-xs text-slate-400">Критериев нет — добавьте первый.</p>
        )}
      </div>
      <button
        onClick={addCriterion}
        className="w-full rounded-lg border border-dashed border-blue-200 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
      >
        + Добавить критерий
      </button>
      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] italic text-slate-400">
          Сумма весов: {criteria.reduce((a, c) => a + (c.weight || 0), 0)}%
        </p>
        <button
          onClick={handleSaveCriteria}
          disabled={!critDirty || busy}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          Сохранить
        </button>
      </div>
    </div>
  );

  const sectionsCard = (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm space-y-4">
      <h4 className="flex items-center gap-2 border-b border-slate-100 pb-4 font-bold text-slate-900">
        <Settings size={18} className="text-blue-600" />
        Структура презентации
      </h4>
      <p className="-mt-1 text-[11px] text-slate-400">
        Разделы, наличие которых проверяется в презентации команд. Каждый раздел ищется по
        ключевым словам (через запятую) в тексте слайдов.
      </p>
      <div className="space-y-3">
        {sections.map((s, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                value={s.label}
                onChange={(e) => updateSection(idx, { label: e.target.value })}
                placeholder="Название раздела"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                value={s.keywords.join(", ")}
                onChange={(e) =>
                  updateSection(idx, { keywords: e.target.value.split(",").map((k) => k.trimStart()) })
                }
                placeholder="ключевые слова: проблема, problem"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => removeSection(idx)}
              title="Удалить раздел"
              className="flex-shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {sections.length === 0 && (
          <p className="text-xs text-slate-400">Разделов нет — добавьте первый.</p>
        )}
      </div>
      <button
        onClick={addSection}
        className="w-full rounded-lg border border-dashed border-blue-200 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
      >
        + Добавить раздел
      </button>
      <div className="flex items-center justify-end pt-1">
        <button
          onClick={handleSaveSections}
          disabled={!secDirty || busy}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          Сохранить
        </button>
      </div>
    </div>
  );

  if (selectedHackathon && current) {
    const teams = teamsForHack ?? [];
    const pending = teams.filter((t) => t.status === "pending");
    const approved = teams.filter((t) => t.status === "approved");
    const juryList = assignedJury ?? [];

    const tabs: { id: DetailTab; label: string; count?: number }[] = [
      { id: "overview", label: "Обзор", count: pending.length || undefined },
      { id: "teams", label: "Команды", count: teams.length || undefined },
      { id: "jury", label: "Жюри", count: juryList.length || undefined },
      { id: "settings", label: "Настройки" },
    ];

    return (
      <div className="space-y-6 pb-20">
        <button
          onClick={() => setSelectedHackathon(null)}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
        >
          <ChevronLeft size={18} />
          Назад к списку хакатонов
        </button>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{current.title}</h1>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase",
                  current.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {current.status === "active" ? "Запущен" : current.status}
              </span>
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar size={16} />
              {new Date(current.start_date).toLocaleDateString("ru-RU")} –{" "}
              {new Date(current.end_date).toLocaleDateString("ru-RU")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/70 bg-white p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setDetailTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                detailTab === t.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100",
              )}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    detailTab === t.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {detailTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Всего команд" value={teams.length} />
              <StatCard label="На одобрении" value={pending.length} tone="amber" />
              <StatCard label="Проект сдан" value={approved.filter((t) => t.github_url).length} tone="green" />
              <StatCard label="Жюри" value={juryList.length} tone="blue" />
            </div>

            {pending.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/40">
                <div className="flex items-center justify-between border-b border-amber-100 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Новые заявки на участие</h3>
                      <p className="text-xs font-medium text-amber-700">
                        Требуется ваше одобрение ({pending.length})
                      </p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-amber-100">
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
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
                Новых заявок нет — всё разобрано 🎉
              </div>
            )}
          </div>
        )}

        {detailTab === "teams" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h3 className="font-bold text-slate-900">Одобренные команды</h3>
                <p className="text-xs text-slate-500">Мониторинг прогресса участников</p>
              </div>
              <button
                onClick={() => setIsAddingTeam(true)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                <Plus size={16} /> Добавить вручную
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {approved.length === 0 ? (
                <div className="p-12 text-center text-sm italic text-slate-400">
                  Одобренных команд пока нет
                </div>
              ) : (
                approved.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-500">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{team.name}</p>
                        <p className="text-xs text-slate-500">
                          {team.members.length} участников · подано: {team.github_url ? "да" : "нет"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "rounded px-2 py-1 font-bold uppercase",
                          team.github_url
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-50 text-slate-400",
                        )}
                      >
                        {team.github_url ? "Проект сдан" : "В процессе"}
                      </span>
                      <button
                        onClick={() => handleDeleteTeam(team.id, team.name)}
                        title="Удалить команду"
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {detailTab === "jury" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h3 className="font-bold text-slate-900">Коллегия жюри</h3>
                <p className="text-xs text-slate-500">Эксперты, назначенные на этот хакатон</p>
              </div>
              <button
                onClick={() => setIsAddingJury(true)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-600 hover:text-white"
              >
                <Plus size={16} /> Назначить
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              {juryList.map((j) => (
                <div
                  key={j.id}
                  className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-white bg-blue-100 font-bold text-blue-600 shadow-sm">
                    {j.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{j.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {j.company ?? "—"} · {j.specialization ?? "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnassignJury(j.id)}
                    title="Снять с хакатона"
                    className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {juryList.length === 0 && (
                <div className="col-span-full py-4 text-center text-sm italic text-slate-400">
                  Жюри ещё не назначено
                </div>
              )}
            </div>
          </div>
        )}

        {detailTab === "settings" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {criteriaCard}
            {sectionsCard}
          </div>
        )}

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
                  <label className="text-sm font-semibold text-gray-700">Существующее жюри</label>
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
    <div className="space-y-8 pb-20">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Панель организатора</h1>
          <p className="text-slate-500">Управление мероприятиями, жюри и критериями оценки.</p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 md:w-auto"
        >
          <PlusCircle size={20} />
          Создать хакатон
        </button>
      </div>

      <div className="flex overflow-x-auto border-b border-slate-200">
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
              "whitespace-nowrap border-b-2 px-6 py-4 text-sm font-bold transition-all",
              activeTab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-600",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "events" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {(hackathons ?? []).map((h) => (
            <div
              key={h.id}
              onClick={() => setSelectedHackathon(h.id)}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="space-y-4 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Trophy size={24} />
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold uppercase",
                      h.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {h.status === "active" ? "Запущен" : h.status}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600">
                    {h.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{h.description}</p>
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Users size={16} />
                    <span className="font-semibold text-slate-700">{h.teams_count}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <UserCheck size={16} />
                    <span className="font-semibold text-slate-700">{h.jury_count}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
                    <Clock size={16} />
                    <span className="text-[10px] font-bold">
                      до {new Date(h.submission_deadline).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-50 bg-slate-50/50 px-6 py-4">
                <span className="text-xs font-bold text-blue-600">Управление хакатоном</span>
                <ChevronRight
                  size={18}
                  className="text-blue-400 transition-transform group-hover:translate-x-1"
                />
              </div>
            </div>
          ))}
          {hackathons && hackathons.length === 0 && (
            <div className="col-span-full rounded-2xl border border-slate-100 bg-white p-12 text-center text-sm text-slate-500">
              Создайте первый хакатон.
            </div>
          )}
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-6 rounded-2xl border border-slate-200/70 bg-white p-8 shadow-sm lg:col-span-2">
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
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

            <div className="space-y-6 rounded-2xl border border-slate-200/70 bg-white p-8 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <Trophy size={20} className="text-amber-500" />
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
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <h3 className="font-bold text-slate-900">Список экспертов (Жюри)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Имя / Компания</th>
                  <th className="px-6 py-4">Специализация</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(juryPool ?? [])
                  .filter((j) => j.role !== "participant")
                  .map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                            {j.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{j.name}</p>
                            <p className="text-xs text-slate-500">{j.company ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{j.specialization ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{j.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
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
                    <td colSpan={4} className="p-12 text-center text-sm italic text-slate-400">
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
                  onChange={(e) => setNewHack({ ...newHack, submission_deadline: e.target.value })}
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
                  onChange={(e) => setNewHack({ ...newHack, max_team_size: Number(e.target.value) })}
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

function StatCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  tone?: "slate" | "amber" | "green" | "blue";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-900",
    amber: "text-amber-600",
    green: "text-green-600",
    blue: "text-blue-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("mt-1 text-2xl font-black", tones[tone])}>{value}</p>
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
    <div className="flex flex-col justify-between gap-4 p-6 md:flex-row md:items-center">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-white font-bold text-amber-600 shadow-sm">
          {team.name[0]}
        </div>
        <div>
          <p className="font-bold text-slate-900">{team.name}</p>
          <p className="text-xs text-slate-500">
            Подано: {team.applied_at ? new Date(team.applied_at).toLocaleDateString("ru-RU") : "—"} ·{" "}
            {team.members.length} участников
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onReject}
          className="flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          <XCircle size={18} />
          Отклонить
        </button>
        <button
          onClick={onApprove}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700"
        >
          <ShieldCheck size={18} />
          Одобрить участие
        </button>
        <button
          onClick={onDelete}
          title="Удалить команду"
          className="rounded-xl p-2 text-red-500 hover:bg-red-50"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
