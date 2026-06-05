import { useState } from "react";
import {
  Users,
  UserPlus,
  Plus,
  Search,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  UserX,
  Paperclip,
  Github,
  FileText,
  Presentation,
  Video,
  Save,
  FileArchive,
} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Hackathon, Team, JoinRequestOut } from "../lib/types";

export function TeamPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"my" | "explore">("my");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHackathon, setNewHackathon] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Team | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [requestsMap, setRequestsMap] = useState<Record<number, JoinRequestOut[]>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loadingRequests, setLoadingRequests] = useState<Set<number>>(new Set());

  const [artifactsOpen, setArtifactsOpen] = useState<Set<number>>(new Set());
  const [artifactForms, setArtifactForms] = useState<
    Record<number, { github: string; docs: string; presentation: string; video: string }>
  >({});
  const [uploadingArchive, setUploadingArchive] = useState<number | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState<number | null>(null);

  const [requestedIds, setRequestedIds] = useState<Set<number>>(new Set());

  const { data: myTeams, reload: reloadMy } = useApi<Team[]>("/teams");
  const { data: explore, reload: reloadExplore } = useApi<Team[]>("/teams/explore");
  const { data: hackathons } = useApi<Hackathon[]>("/hackathons");

  const my = myTeams ?? [];
  const exp = explore ?? [];

  // Хакатоны, в которых участник уже состоит в команде — в них нельзя вступить
  // во вторую команду, поэтому такие команды не показываем в поиске.
  const myHackathonIds = new Set(my.map((t) => t.hackathon_id));

  const filteredExplore = exp
    .filter((t) => !myHackathonIds.has(t.hackathon_id))
    .filter(
      (t) =>
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (hackathons?.find((h) => h.id === t.hackathon_id)?.title ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()),
    );

  const isCaptain = (team: Team) =>
    !!user && team.members.some((m) => m.user_id === user.id && m.role === "captain");

  const handleCreate = async () => {
    if (!newName.trim() || !newHackathon) {
      toast.error("Заполните все поля");
      return;
    }
    setBusy(true);
    try {
      await api.post<Team>("/teams", { name: newName, hackathon_id: Number(newHackathon) });
      toast.success("Команда создана, заявка отправлена");
      setCreating(false);
      setNewName("");
      setNewHackathon("");
      reloadMy();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (teamId: number) => {
    setBusy(true);
    try {
      await api.post<JoinRequestOut>(`/teams/${teamId}/join`, { message: "" });
      toast.success("Заявка отправлена капитану");
      setRequestedIds((prev) => new Set(prev).add(teamId));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setEditName(team.name);
    setEditNotes(team.notes ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error("Введите название");
      return;
    }
    setBusy(true);
    try {
      await api.patch<Team>(`/teams/${editing.id}`, {
        name: editName.trim(),
        notes: editNotes,
      });
      toast.success("Команда обновлена");
      setEditing(null);
      reloadMy();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const toggleRequests = async (teamId: number) => {
    const next = new Set(expanded);
    if (next.has(teamId)) {
      next.delete(teamId);
      setExpanded(next);
      return;
    }
    next.add(teamId);
    setExpanded(next);
    if (!requestsMap[teamId]) {
      setLoadingRequests((prev) => new Set(prev).add(teamId));
      try {
        const data = await api.get<JoinRequestOut[]>(`/teams/${teamId}/requests`);
        setRequestsMap((prev) => ({ ...prev, [teamId]: data }));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Не удалось загрузить заявки");
      } finally {
        setLoadingRequests((prev) => {
          const n = new Set(prev);
          n.delete(teamId);
          return n;
        });
      }
    }
  };

  const handleRemoveMember = async (teamId: number, userId: number, name: string) => {
    if (!confirm(`Исключить участника ${name} из команды?`)) return;
    setBusy(true);
    try {
      await api.del<Team>(`/teams/${teamId}/members/${userId}`);
      toast.success("Участник исключён");
      reloadMy();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTeam = async (teamId: number, name: string) => {
    if (!confirm(`Удалить команду «${name}»? Действие необратимо.`)) return;
    setBusy(true);
    try {
      await api.del(`/teams/${teamId}`);
      toast.success("Команда удалена");
      reloadMy();
      reloadExplore();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const toggleArtifacts = (team: Team) => {
    const willOpen = !artifactsOpen.has(team.id);
    setArtifactsOpen((prev) => {
      const n = new Set(prev);
      if (n.has(team.id)) n.delete(team.id);
      else n.add(team.id);
      return n;
    });
    if (willOpen && !artifactForms[team.id]) {
      setArtifactForms((prev) => ({
        ...prev,
        [team.id]: {
          github: team.github_url ?? "",
          docs: team.docs_url ?? "",
          presentation: team.presentation_url ?? "",
          video: team.video_url ?? "",
        },
      }));
    }
  };

  const setArtifactField = (
    teamId: number,
    key: "github" | "docs" | "presentation" | "video",
    value: string,
  ) => {
    setArtifactForms((prev) => ({
      ...prev,
      [teamId]: { ...(prev[teamId] ?? { github: "", docs: "", presentation: "", video: "" }), [key]: value },
    }));
  };

  const handleSaveArtifacts = async (teamId: number) => {
    const f = artifactForms[teamId];
    if (!f) return;
    const team = my.find((t) => t.id === teamId);
    setBusy(true);
    try {
      await api.put<Team>(`/teams/${teamId}/submission`, {
        // when an archive/file is the source, don't overwrite the corresponding URL
        github_url: team?.has_archive ? null : f.github.trim() || null,
        docs_url: team?.has_doc_file ? null : f.docs.trim() || null,
        presentation_url: f.presentation.trim() || null,
        video_url: f.video.trim() || null,
      });
      toast.success("Артефакты сохранены, проверки запущены");
      reloadMy();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteArchive = async (teamId: number) => {
    setBusy(true);
    try {
      await api.del<Team>(`/teams/${teamId}/submission/archive`);
      toast.success("Архив удалён — теперь можно указать ссылку");
      reloadMy();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadDocs = async (teamId: number, file: File) => {
    setUploadingDocs(teamId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.upload<Team>(`/teams/${teamId}/submission/docs`, fd);
      toast.success("Документация загружена, проверка запущена");
      reloadMy();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось загрузить документацию");
    } finally {
      setUploadingDocs(null);
    }
  };

  const handleDeleteDocs = async (teamId: number) => {
    setBusy(true);
    try {
      await api.del<Team>(`/teams/${teamId}/submission/docs`);
      toast.success("Файл документации удалён — теперь можно указать ссылку");
      reloadMy();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadArchive = async (teamId: number, file: File) => {
    setUploadingArchive(teamId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.upload<Team>(`/teams/${teamId}/submission/archive`, fd);
      toast.success("Архив загружен, проверка запущена");
      reloadMy();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось загрузить архив");
    } finally {
      setUploadingArchive(null);
    }
  };

  const handleDecide = async (teamId: number, requestId: number, decision: "approved" | "rejected") => {
    setBusy(true);
    try {
      await api.post<JoinRequestOut>(`/teams/${teamId}/requests/${requestId}/decide`, { decision });
      toast.success(decision === "approved" ? "Заявка одобрена" : "Заявка отклонена");
      const updated = await api.get<JoinRequestOut[]>(`/teams/${teamId}/requests`);
      setRequestsMap((prev) => ({ ...prev, [teamId]: updated }));
      reloadMy();
      reloadExplore();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Командный центр</h1>
          <p className="text-gray-500">Создавайте свои команды или присоединяйтесь к единомышленникам.</p>
        </div>

        <button
          onClick={() => setCreating(true)}
          className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
        >
          <Plus size={20} />
          Создать команду
        </button>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:w-fit gap-1 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveTab("my")}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "my"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Мои команды
        </button>
        <button
          onClick={() => setActiveTab("explore")}
          className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "explore"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Поиск команд
        </button>
      </div>

      {creating && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Новая команда</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название команды"
              className="px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
            />
            <select
              value={newHackathon}
              onChange={(e) => setNewHackathon(e.target.value ? Number(e.target.value) : "")}
              className="px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
            >
              <option value="">Выберите хакатон...</option>
              {(hackathons ?? [])
                .filter((h) => h.status === "active" || h.status === "draft")
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCreate}
              disabled={busy}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Создание..." : "Создать"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Редактирование команды</h2>
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">Название</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none"
            />
            <label className="block text-sm font-semibold text-gray-700">Заметки для жюри</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none resize-none"
              placeholder="Краткое описание идеи, стек, роли в команде..."
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveEdit}
              disabled={busy}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Сохранение..." : "Сохранить"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {activeTab === "my" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {my.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-500 text-sm">
              У вас пока нет команд. Создайте свою или подайте заявку.
            </div>
          ) : (
            my.map((team) => {
              const hack = hackathons?.find((h) => h.id === team.hackathon_id);
              const captain = team.members.find((m) => m.role === "captain");
              const isMineCaptain = isCaptain(team);
              const isOpen = expanded.has(team.id);
              const reqs = requestsMap[team.id] ?? [];
              const isLoadingReqs = loadingRequests.has(team.id);
              const pendingCount = reqs.length;
              const artOpen = artifactsOpen.has(team.id);
              const artForm =
                artifactForms[team.id] ?? { github: "", docs: "", presentation: "", video: "" };
              const deadlinePassed = hack
                ? new Date() > new Date(hack.submission_deadline)
                : false;
              const notStarted = hack ? new Date() < new Date(hack.start_date) : false;
              // uploads allowed only while the hackathon is ongoing
              const uploadLocked = deadlinePassed || notStarted;
              const hasArtifacts = !!(
                team.github_url ||
                team.docs_url ||
                team.presentation_url ||
                team.video_url
              );

              return (
                <div
                  key={team.id}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl flex-shrink-0">
                        {team.name[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 truncate">{team.name}</h3>
                        <p className="text-sm text-gray-500 truncate">
                          {hack?.title ?? `Хакатон #${team.hackathon_id}`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase whitespace-nowrap ${
                        team.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : team.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {team.status === "approved"
                        ? "Одобрена"
                        : team.status === "rejected"
                          ? "Отклонена"
                          : "На рассмотрении"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 border-t border-gray-50 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-gray-400" />
                      <span>{team.members.length} участников</span>
                    </div>
                    {captain && (
                      <span className="text-xs text-gray-500">
                        Капитан: {captain.name}
                      </span>
                    )}
                    {isMineCaptain && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        Вы капитан
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {team.status === "approved" && (
                      <button
                        onClick={() => toggleArtifacts(team)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${
                          hasArtifacts
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }`}
                      >
                        <Paperclip size={14} />
                        Артефакты{hasArtifacts ? " ✓" : ""}
                      </button>
                    )}
                    {isMineCaptain && (
                      <button
                        onClick={() => openEdit(team)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        <Edit3 size={14} />
                        Редактировать
                      </button>
                    )}
                    {isMineCaptain && (
                      <button
                        onClick={() => toggleRequests(team.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        Заявки{pendingCount > 0 ? ` (${pendingCount})` : ""}
                      </button>
                    )}
                    {isMineCaptain && (
                      <button
                        onClick={() => handleDeleteTeam(team.id, team.name)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 ml-auto"
                      >
                        <Trash2 size={14} />
                        Удалить команду
                      </button>
                    )}
                  </div>

                  {isMineCaptain && team.members.length > 1 && (
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Состав команды
                      </p>
                      {team.members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
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
                              onClick={() => handleRemoveMember(team.id, m.user_id, m.name)}
                              disabled={busy}
                              title="Исключить из команды"
                              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 flex-shrink-0"
                            >
                              <UserX size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {isMineCaptain && isOpen && (
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      {isLoadingReqs ? (
                        <p className="text-xs text-gray-400">Загрузка...</p>
                      ) : reqs.length === 0 ? (
                        <p className="text-xs text-gray-400">Нет ожидающих заявок.</p>
                      ) : (
                        reqs.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {r.user_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{r.user_email}</p>
                              {r.message && (
                                <p className="text-xs text-gray-600 mt-1 italic">
                                  «{r.message}»
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleDecide(team.id, r.id, "approved")}
                                disabled={busy}
                                className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
                                title="Одобрить"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => handleDecide(team.id, r.id, "rejected")}
                                disabled={busy}
                                className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                                title="Отклонить"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {team.status === "approved" && artOpen && (
                    <div className="pt-3 border-t border-gray-100 space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Артефакты решения
                      </p>
                      {/* Источник кода: ЛИБО архив, ЛИБО ссылка на репозиторий */}
                      {team.has_archive ? (
                        <div className="space-y-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-sm font-semibold text-green-700 min-w-0">
                              <FileArchive size={16} className="flex-shrink-0" />
                              <span className="truncate">Загружен архив: code.zip</span>
                            </span>
                            <button
                              onClick={() => handleDeleteArchive(team.id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-red-100 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex-shrink-0"
                            >
                              <Trash2 size={13} />
                              Удалить
                            </button>
                          </div>
                          <p className="text-[11px] text-green-700/80">
                            Код проверяется из архива. Чтобы вместо него указать ссылку —
                            удалите архив.
                          </p>
                          <input
                            type="file"
                            accept=".zip,application/zip"
                            disabled={uploadingArchive === team.id || uploadLocked}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadArchive(team.id, f);
                              e.target.value = "";
                            }}
                            className="block w-full text-xs text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-blue-600 hover:file:bg-blue-50 disabled:opacity-50"
                          />
                          <p className="text-[11px] text-green-700/80">
                            {uploadingArchive === team.id ? "Загрузка..." : "…или заменить архив новым файлом."}
                          </p>
                        </div>
                      ) : (
                        <>
                          <ArtifactInput
                            icon={Github}
                            label="Репозиторий (GitHub / GitLab)"
                            placeholder="https://github.com/команда/проект"
                            value={artForm.github}
                            onChange={(v) => setArtifactField(team.id, "github", v)}
                          />
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                              <FileArchive size={14} className="text-gray-400" />
                              …или загрузите архив проекта (.zip)
                            </label>
                            <input
                              type="file"
                              accept=".zip,application/zip"
                              disabled={uploadingArchive === team.id || uploadLocked}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadArchive(team.id, f);
                                e.target.value = "";
                              }}
                              className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 disabled:opacity-50"
                            />
                            <p className="text-[11px] text-gray-400">
                              {uploadingArchive === team.id
                                ? "Загрузка и запуск проверки..."
                                : "Загрузка архива заменит ссылку на репозиторий."}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Документация: ЛИБО файл, ЛИБО ссылка */}
                      {team.has_doc_file ? (
                        <div className="space-y-2 p-3 bg-green-50 border border-green-100 rounded-lg">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-sm font-semibold text-green-700 min-w-0">
                              <FileText size={16} className="flex-shrink-0" />
                              <span className="truncate">Загружен файл документации</span>
                            </span>
                            <button
                              onClick={() => handleDeleteDocs(team.id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-red-100 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex-shrink-0"
                            >
                              <Trash2 size={13} />
                              Удалить
                            </button>
                          </div>
                          <p className="text-[11px] text-green-700/80">
                            Документация проверяется из файла. Чтобы указать ссылку — удалите файл.
                          </p>
                          <input
                            type="file"
                            accept=".pdf,.docx,.md,application/pdf"
                            disabled={uploadingDocs === team.id || uploadLocked}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadDocs(team.id, f);
                              e.target.value = "";
                            }}
                            className="block w-full text-xs text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white file:text-blue-600 hover:file:bg-blue-50 disabled:opacity-50"
                          />
                          <p className="text-[11px] text-green-700/80">
                            {uploadingDocs === team.id ? "Загрузка..." : "…или заменить файл новым."}
                          </p>
                        </div>
                      ) : (
                        <>
                          <ArtifactInput
                            icon={FileText}
                            label="Документация (PDF / DOCX / Markdown)"
                            placeholder="https://..."
                            value={artForm.docs}
                            onChange={(v) => setArtifactField(team.id, "docs", v)}
                          />
                          <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                              <FileText size={14} className="text-gray-400" />
                              …или загрузите файл (.pdf / .docx / .md)
                            </label>
                            <input
                              type="file"
                              accept=".pdf,.docx,.md,application/pdf"
                              disabled={uploadingDocs === team.id || uploadLocked}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadDocs(team.id, f);
                                e.target.value = "";
                              }}
                              className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 disabled:opacity-50"
                            />
                            <p className="text-[11px] text-gray-400">
                              {uploadingDocs === team.id
                                ? "Загрузка и запуск проверки..."
                                : "Загрузка файла заменит ссылку на документацию."}
                            </p>
                          </div>
                        </>
                      )}
                      <ArtifactInput
                        icon={Presentation}
                        label="Презентация (PPTX / PDF)"
                        placeholder="https://..."
                        value={artForm.presentation}
                        onChange={(v) => setArtifactField(team.id, "presentation", v)}
                      />
                      <ArtifactInput
                        icon={Video}
                        label="Скринкаст (ссылка или файл)"
                        placeholder="https://..."
                        value={artForm.video}
                        onChange={(v) => setArtifactField(team.id, "video", v)}
                      />

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <p className="text-[11px] text-gray-400">
                          {notStarted
                            ? "Хакатон ещё не начался — загрузка будет доступна позже"
                            : deadlinePassed
                              ? "Дедлайн подачи прошёл — изменения недоступны"
                              : "Можно обновлять до дедлайна подачи"}
                        </p>
                        <button
                          onClick={() => handleSaveArtifacts(team.id)}
                          disabled={busy || uploadLocked}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save size={14} />
                          Сохранить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или хакатону..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          {filteredExplore.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-500 text-sm">
              Открытых команд нет.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredExplore.map((team) => {
                const hack = hackathons?.find((h) => h.id === team.hackathon_id);
                const requested = requestedIds.has(team.id);
                return (
                  <div
                    key={team.id}
                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col transition-all hover:border-blue-200"
                  >
                    <div className="flex-1 space-y-4">
                      <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center font-bold">
                        {team.name[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{team.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{hack?.title ?? "—"}</p>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{team.members.length} занято</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-600 font-semibold">
                          <UserPlus size={14} />
                          <span>
                            {Math.max(0, (hack?.max_team_size ?? 5) - team.members.length)} свободно
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoin(team.id)}
                      disabled={busy || requested}
                      className={`mt-6 w-full py-2 text-sm font-bold rounded-lg transition-all ${
                        requested
                          ? "bg-gray-100 text-gray-500 cursor-default"
                          : "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white"
                      }`}
                    >
                      {requested ? "Заявка отправлена" : "Подать заявку"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArtifactInput({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
}: {
  icon: typeof Github;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
        <Icon size={14} className="text-gray-400" />
        {label}
      </label>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 outline-none"
      />
    </div>
  );
}
