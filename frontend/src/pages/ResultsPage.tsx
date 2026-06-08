import {
  IconCircleCheck as CheckCircle2,
  IconClock as Clock,
  IconCircleX as XCircle,
  IconTerminal2 as Terminal,
  IconUsers as Users,
  IconAward as Award,
  IconRefresh as RefreshCw,
  IconChevronDown as ChevronDown,
  IconFileText as FileText,
  IconShield as Shield,
  IconPackage as Package,
  IconBook as Book,
  IconCode as Code,
  IconBrain as Brain,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../lib/api";
import type { CodeCheck, Hackathon, Submission, Team } from "../lib/types";

function statusBadge(s: Submission["status"]) {
  if (s === "evaluated")
    return { className: "bg-green-100 text-green-700", label: "Оценено", Icon: CheckCircle2 };
  if (s === "error")
    return { className: "bg-red-100 text-red-700", label: "Ошибка", Icon: XCircle };
  return { className: "bg-yellow-100 text-yellow-700", label: "На проверке", Icon: Clock };
}

function NNBar({ label, value, Icon }: { label: string; value: number | null; Icon: React.ElementType }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-green-500" : pct >= 45 ? "bg-amber-400" : "bg-red-400";
  const textColor = pct >= 75 ? "text-green-700" : pct >= 45 ? "text-amber-700" : "text-red-600";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Icon size={13} className="text-gray-400" />
          {label}
        </div>
        <span className={`text-xs font-bold tabular-nums ${textColor}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CodeCheckBreakdown({ check }: { check: CodeCheck }) {
  const [open, setOpen] = useState(false);
  const ok = check.status === "done";
  const raw = check.raw ?? {};
  const hasNN = raw.nn_readme != null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {ok ? <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> : <Clock size={18} className="text-yellow-500 flex-shrink-0" />}
          <div>
            <p className="text-sm font-semibold text-gray-800">Код репозитория</p>
            <p className="text-xs text-gray-400">
              LOC: {check.loc} · линтер: {check.lint_issues} · секретов: {check.secrets_found}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${ok ? "text-green-600" : "text-yellow-600"}`}>
            {check.score.toFixed(1)} / 10
          </span>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-5 border-t border-gray-100 bg-white">
          {hasNN ? (
            <>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                <Brain size={13} />
                Оценка выставлена нейросетью по всем критериям
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Структура проекта</p>
                <NNBar label="README" value={raw.nn_readme} Icon={FileText} />
                <NNBar label="LICENSE" value={raw.nn_license} Icon={Shield} />
                <NNBar label="Файл зависимостей" value={raw.nn_deps} Icon={Package} />
                <NNBar label="Инструкция запуска" value={raw.nn_run} Icon={Book} />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Качество кода</p>
                <NNBar label="Качество кода" value={raw.nn_code_quality} Icon={Code} />
              </div>

              <div className="pt-1 border-t border-gray-100 space-y-1.5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Дополнительно (статический анализ)</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="font-mono font-bold text-gray-800">{check.loc}</p>
                    <p>строк кода</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="font-mono font-bold text-gray-800">{check.lint_issues}</p>
                    <p>проблем линтера</p>
                  </div>
                  <div className={`rounded-lg px-2.5 py-2 text-center ${check.secrets_found > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                    <p className={`font-mono font-bold ${check.secrets_found > 0 ? "text-red-600" : "text-gray-800"}`}>{check.secrets_found}</p>
                    <p>секретов</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Нейросеть недоступна — показан статический анализ.</p>
              {[
                { label: "README", ok: check.has_readme, Icon: FileText },
                { label: "LICENSE", ok: check.has_license, Icon: Shield },
                { label: "Зависимости", ok: check.has_deps_file, Icon: Package },
                { label: "Инструкция", ok: check.has_run_instructions, Icon: Book },
              ].map(({ label, ok: v, Icon }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-gray-700">
                  {v ? <CheckCircle2 size={15} className="text-green-500" /> : <XCircle size={15} className="text-red-400" />}
                  <Icon size={13} className="text-gray-400" />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultsPage() {
  const { data: submissions, reload, loading, error } = useApi<Submission[]>("/results/me");
  const { data: teams } = useApi<Team[]>("/teams");
  const { data: hackathons } = useApi<Hackathon[]>("/hackathons");
  const [rerunning, setRerunning] = useState<number | null>(null);

  const teamById = (id: number) => teams?.find((t) => t.id === id);
  const hackById = (id: number) => hackathons?.find((h) => h.id === id);

  const handleRerun = async (id: number) => {
    setRerunning(id);
    try {
      await api.post(`/results/submissions/${id}/rerun`);
      toast.success("Проверки перезапущены, ожидаем результат...");

      let settled = false;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const fresh = await api.get<Submission[]>("/results/me");
          const s = fresh.find((x) => x.id === id);
          if (s && s.status !== "pending" && s.status !== "evaluating") {
            settled = true;
            break;
          }
        } catch {
          // ignore polling errors
        }
      }
      reload();
      toast[settled ? "success" : "message"](
        settled ? "Перепроверка завершена" : "Проверка ещё идёт — обновите статус позже",
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Ошибка");
    } finally {
      setRerunning(null);
    }
  };

  if (loading) return <div className="text-gray-400">Загрузка...</div>;
  if (error) return <div className="text-red-500">Ошибка: {error}</div>;
  if (!submissions) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Результаты и оценки</h1>
        <p className="text-gray-500">
          Здесь отображаются результаты ручной и автоматической проверки ваших проектов.
        </p>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-500 text-sm">
          У вас пока нет поданных проектов. Загрузите артефакты на странице хакатона.
        </div>
      ) : (
        <div className="space-y-6">
          {submissions.map((s) => {
            const team = teamById(s.team_id);
            const hack = team ? hackById(team.hackathon_id) : undefined;
            const badge = statusBadge(s.status);
            const juryAvg: number | null = s.jury_score;
            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/30">
                  <div className="space-y-1">
                    <h3 className="font-bold text-xl text-gray-900">
                      {hack?.title ?? `Хакатон #${team?.hackathon_id ?? "?"}`}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                      <Users size={16} />
                      Команда: {team?.name ?? "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                        Итоговый балл
                      </p>
                      <p className="text-2xl font-black text-blue-600">
                        {s.status === "evaluated" ? s.final_score.toFixed(1) : "—"}
                      </p>
                    </div>
                    <div
                      className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm ${badge.className}`}
                    >
                      <badge.Icon size={18} />
                      {badge.label}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => reload()}
                        title="Обновить статус"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <RefreshCw size={18} />
                      </button>
                      <button
                        onClick={() => handleRerun(s.id)}
                        disabled={rerunning === s.id}
                        title="Перезапустить авто-проверки заново"
                        className="px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                      >
                        {rerunning === s.id ? "..." : "Перепроверить"}
                      </button>
                    </div>
                  </div>
                </div>

                {s.status === "evaluated" ? (
                  <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <Terminal size={18} className="text-blue-600" />
                          Автоматическая проверка
                        </h4>
                        <span className="text-lg font-black text-blue-600">
                          {s.auto_score.toFixed(1)} / 10
                        </span>
                      </div>

                      <div className="space-y-2">
                        {s.code_check ? (
                          <CodeCheckBreakdown check={s.code_check} />
                        ) : (
                          <SimpleCheckRow
                            ok={false}
                            name="Код репозитория"
                            score={undefined}
                            extra="нет данных"
                          />
                        )}
                        <SimpleCheckRow
                          ok={s.doc_check?.status === "done"}
                          name={`Документация (${s.doc_check?.fmt ?? "—"})`}
                          score={s.doc_check?.score}
                          extra={
                            s.doc_check
                              ? `слов: ${s.doc_check.word_count}, картинок: ${s.doc_check.image_count}`
                              : ""
                          }
                        />
                        <SimpleCheckRow
                          ok={s.presentation_check?.status === "done"}
                          name={`Презентация (${s.presentation_check?.fmt ?? "—"})`}
                          score={s.presentation_check?.score}
                          extra={
                            s.presentation_check
                              ? `слайдов: ${s.presentation_check.slide_count}, разделов: ${s.presentation_check.sections_found.length}`
                              : ""
                          }
                        />
                        <SimpleCheckRow
                          ok={s.video_check?.status === "done"}
                          name="Видео (ffprobe)"
                          score={s.video_check?.score}
                          extra={
                            s.video_check
                              ? `${s.video_check.width}×${s.video_check.height}, ${s.video_check.codec}, ${s.video_check.duration_sec}s`
                              : ""
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 flex items-center gap-2">
                          <Award size={18} className="text-purple-600" />
                          Оценка жюри
                        </h4>
                        <span className="text-lg font-black text-purple-600">
                          {juryAvg !== null ? juryAvg.toFixed(1) : "ожидается"} / 10
                        </span>
                      </div>

                      <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-sm text-purple-800">
                        <p className="font-semibold mb-1">Что считается:</p>
                        <p className="text-xs leading-relaxed">
                          дизайн, питч, техническая сложность. Финальный балл =
                          взвешенная сумма авто-оценки и средних оценок жюри по
                          коэффициентам хакатона.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center animate-pulse">
                      <Clock size={32} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Проверка в процессе</h4>
                      <p className="text-sm text-gray-500 max-w-xs mx-auto">
                        {s.status === "error"
                          ? "Один из авто-тестов завершился с ошибкой. Можно перезапустить."
                          : "Ваш проект загружен. Оценки появятся после завершения авто-тестов и работы жюри."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SimpleCheckRow({
  ok,
  name,
  score,
  extra,
}: {
  ok: boolean;
  name: string;
  score?: number;
  extra?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex items-center gap-3 min-w-0">
        {ok ? (
          <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
        ) : (
          <Clock size={18} className="text-yellow-500 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate">{name}</p>
          {extra && <p className="text-xs text-gray-400 truncate">{extra}</p>}
        </div>
      </div>
      <span className={`text-sm font-bold ${ok ? "text-green-600" : "text-yellow-600"}`}>
        {score != null ? `${score.toFixed(1)} / 10` : "—"}
      </span>
    </div>
  );
}
