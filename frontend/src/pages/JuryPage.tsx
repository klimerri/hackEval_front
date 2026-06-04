import { useEffect, useState } from "react";
import {
  Trophy,
  Users,
  Star,
  Github,
  FileText,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  User,
  MessageSquare,
  Save,
  ArrowUpRight,
  Cpu,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../lib/api";
import type { JuryHackathon, JuryTeam } from "../lib/types";

export function JuryPage() {
  const [selectedHackathon, setSelectedHackathon] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: hackathons, loading, error, reload } = useApi<JuryHackathon[]>(
    "/jury/hackathons",
  );
  const { data: teams, reload: reloadTeams } = useApi<JuryTeam[]>(
    selectedHackathon ? `/jury/hackathons/${selectedHackathon}/teams` : null,
    [selectedHackathon],
  );

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
  const [scores, setScores] = useState({ design: 0, pitch: 0, complexity: 0, comment: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedTeam?.my_score) setScores(selectedTeam.my_score);
  }, [selectedTeam?.id]);

  const handleScoreChange = (field: "design" | "pitch" | "complexity", value: number) => {
    setScores((s) => ({ ...s, [field]: value }));
  };

  const save = async () => {
    if (!selectedTeamId) return;
    setSaving(true);
    try {
      await api.put(`/jury/teams/${selectedTeamId}/score`, scores);
      toast.success("Оценки сохранены");
      reload();
      reloadTeams();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-400">Загрузка...</div>;
  if (error) return <div className="text-red-500">Ошибка: {error}</div>;
  if (!hackathons) return null;

  if (selectedTeamId && selectedTeam) {
    const total = (scores.design + scores.pitch + scores.complexity) / 3;
    return (
      <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 pb-20 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <button
            onClick={() => setSelectedTeamId(null)}
            className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-all font-medium text-sm"
          >
            <ChevronLeft size={16} />
            Назад к списку
          </button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Текущая оценка:</span>
            <div className="text-2xl font-bold text-blue-600">
              {total === 0 ? "—" : total.toFixed(1)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-10">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                  {selectedTeam.name[0]}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{selectedTeam.name}</h1>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <User size={14} /> {selectedTeam.captain}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Артефакты решения</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedTeam.github && (
                  <ArtifactLink href={selectedTeam.github} label="Исходный код" icon={Github} />
                )}
                {selectedTeam.docs && (
                  <ArtifactLink href={selectedTeam.docs} label="Документация" icon={FileText} />
                )}
                {selectedTeam.presentation && (
                  <ArtifactLink
                    href={selectedTeam.presentation}
                    label="Презентация"
                    icon={FileText}
                  />
                )}
                {selectedTeam.video && (
                  <ArtifactLink href={selectedTeam.video} label="Видео-демо" icon={Cpu} />
                )}
                {!selectedTeam.github &&
                  !selectedTeam.docs &&
                  !selectedTeam.presentation &&
                  !selectedTeam.video && (
                    <div className="col-span-full text-sm text-gray-400 italic p-4">
                      Команда ещё не приложила артефакты.
                    </div>
                  )}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Cpu size={18} className="text-blue-600" />
                Авто-аудит ({selectedTeam.auto_score.toFixed(1)}/10)
              </h2>
              {selectedTeam.checks ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CheckCard
                    title="Код"
                    status={selectedTeam.checks.code.status}
                    score={selectedTeam.checks.code.score}
                    detail={`LOC: ${selectedTeam.checks.code.loc} · секретов: ${selectedTeam.checks.code.secrets_found} · README: ${selectedTeam.checks.code.has_readme ? "да" : "нет"}`}
                  />
                  <CheckCard
                    title="Документация"
                    status={selectedTeam.checks.doc.status}
                    score={selectedTeam.checks.doc.score}
                    detail={`Слов: ${selectedTeam.checks.doc.word_count} · формат: ${selectedTeam.checks.doc.fmt || "—"}`}
                  />
                  <CheckCard
                    title="Презентация"
                    status={selectedTeam.checks.presentation.status}
                    score={selectedTeam.checks.presentation.score}
                    detail={`Слайдов: ${selectedTeam.checks.presentation.slide_count} · формат: ${selectedTeam.checks.presentation.fmt || "—"}`}
                  />
                  <CheckCard
                    title="Скринкаст"
                    status={selectedTeam.checks.video.status}
                    score={selectedTeam.checks.video.score}
                    detail={
                      selectedTeam.checks.video.duration_sec
                        ? `Длительность: ${selectedTeam.checks.video.duration_sec} c`
                        : "Видео не приложено"
                    }
                  />
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-500">
                  Команда ещё не отправила решение на автопроверку.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl border border-gray-200 p-8 sticky top-8">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900">Оценка жюри</h3>
                <p className="text-sm text-gray-500 mt-1">Оцените проект по критериям</p>
              </div>

              <div className="space-y-8">
                {(
                  [
                    { id: "design" as const, label: "Дизайн и UX" },
                    { id: "pitch" as const, label: "Питч и Идея" },
                    { id: "complexity" as const, label: "Техническая сложность" },
                  ]
                ).map((criterion) => (
                  <div key={criterion.id} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-gray-700">
                        {criterion.label}
                      </label>
                      <span className="text-lg font-semibold text-blue-600">
                        {scores[criterion.id]}
                        <span className="text-gray-400 text-sm font-normal">/10</span>
                      </span>
                    </div>
                    <div className="relative h-2 bg-gray-100 rounded-full">
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={scores[criterion.id]}
                        onChange={(e) =>
                          handleScoreChange(criterion.id, Number(e.target.value))
                        }
                        className="absolute inset-0 w-full h-full bg-transparent appearance-none cursor-pointer z-10 accent-blue-600"
                      />
                      <div
                        className="absolute left-0 top-0 h-full bg-blue-600 rounded-full transition-all duration-300 pointer-events-none"
                        style={{ width: `${scores[criterion.id] * 10}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-2 space-y-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <MessageSquare size={14} /> Комментарий
                  </label>
                  <textarea
                    placeholder="Ваше мнение о проекте..."
                    value={scores.comment}
                    onChange={(e) => setScores((s) => ({ ...s, comment: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none transition-all h-32 text-sm resize-none"
                  />
                </div>

                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full py-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={18} />
                  {saving ? "Сохранение..." : "Сохранить оценки"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedHackathon) {
    const filteredTeams = (teams ?? []).filter(
      (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
        <button
          onClick={() => setSelectedHackathon(null)}
          className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronLeft size={20} />
          Назад к моим хакатонам
        </button>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">
              {hackathons.find((h) => h.id === selectedHackathon)?.title}
            </h1>
            <p className="text-gray-500">
              Список проектов для оценки · {hackathons.find((h) => h.id === selectedHackathon)?.teams_count} команд
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
                Всего: {hackathons.find((h) => h.id === selectedHackathon)?.teams_count}
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Оценено вами: {hackathons.find((h) => h.id === selectedHackathon)?.graded_count}
              </div>
            </div>
            <div className="relative flex-1 sm:flex-none w-full sm:w-auto">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск команды..."
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 outline-none text-sm w-full sm:w-64"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className="p-6 hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                  <div className="w-14 h-14 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center font-black text-xl text-blue-600 group-hover:scale-110 transition-transform">
                    {team.name[0]}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-900 text-lg">{team.name}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <User size={12} /> {team.captain || "—"}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Cpu size={12} /> AI Score: {team.auto_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8">
                  {team.status === "evaluated" ? (
                    <div className="flex flex-col items-end">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} size={12} className="fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <span className="text-[10px] font-black text-green-600 uppercase mt-1">
                        Оценено
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100 uppercase">
                      Ожидает оценки
                    </span>
                  )}

                  <button
                    onClick={() => setSelectedTeamId(team.id)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all group-hover:shadow-lg shadow-blue-200"
                  >
                    Оценить
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              </div>
            ))}
            {filteredTeams.length === 0 && (
              <div className="p-12 text-center text-gray-400 text-sm">
                Нет одобренных команд для оценки.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Кабинет Жюри</h1>
        <p className="text-gray-500">Оценка проектов и экспертная экспертиза решений участников.</p>
      </div>

      {hackathons.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-500 text-sm">
          У вас пока нет назначенных хакатонов.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hackathons.map((h) => (
            <div
              key={h.id}
              onClick={() => setSelectedHackathon(h.id)}
              className="group bg-white rounded-3xl border border-gray-100 shadow-sm p-8 hover:border-blue-200 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8 group-hover:bg-blue-600 group-hover:scale-150 transition-all duration-500" />

              <div className="relative z-10 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                    <Trophy size={28} />
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                      h.status === "in_progress"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {h.status === "in_progress" ? "В процессе" : "Завершено"}
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                    {h.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Users size={16} /> {h.teams_count} команд
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <CheckCircle2 size={16} className="text-green-500" /> {h.graded_count}{" "}
                      оценено
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-gray-50">
                  <div className="text-xs text-gray-400 font-medium">
                    Дедлайн:{" "}
                    <span className="text-red-500 font-bold">
                      {new Date(h.deadline).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button className="text-blue-600 font-black text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    Перейти к оценке
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckCard({
  title,
  status,
  score,
  detail,
}: {
  title: string;
  status: string;
  score: number | null;
  detail: string;
}) {
  const done = status === "done";
  const skipped = status === "skipped";
  const label = done ? "готово" : skipped ? "нет данных" : status === "error" ? "ошибка" : "в процессе";
  const color = done
    ? "bg-green-50 text-green-700 border-green-100"
    : status === "error"
      ? "bg-red-50 text-red-700 border-red-100"
      : "bg-gray-50 text-gray-500 border-gray-100";
  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-sm font-black text-blue-600">
          {score != null ? `${score.toFixed(1)}/10` : "—"}
        </span>
      </div>
      <p className="text-xs text-gray-500">{detail}</p>
      <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${color}`}>
        {label}
      </span>
    </div>
  );
}

function ArtifactLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Github;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col justify-center p-6 bg-white border border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="w-10 h-10 bg-gray-50 text-gray-700 rounded-xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600">
          <Icon size={20} />
        </div>
        <ExternalLink size={16} className="text-gray-400 group-hover:text-blue-600" />
      </div>
      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">{label}</h3>
      <p className="text-sm text-gray-500 mt-1 truncate">{href}</p>
    </a>
  );
}
