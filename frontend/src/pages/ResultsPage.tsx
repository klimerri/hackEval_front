import {
  IconCircleCheck as CheckCircle2,
  IconClock as Clock,
  IconCircleX as XCircle,
  IconTerminal2 as Terminal,
  IconUsers as Users,
  IconAward as Award,
  IconRefresh as RefreshCw,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../lib/api";
import type { Hackathon, Submission, Team } from "../lib/types";

function statusBadge(s: Submission["status"]) {
  if (s === "evaluated")
    return { className: "bg-green-100 text-green-700", label: "Оценено", Icon: CheckCircle2 };
  if (s === "error")
    return { className: "bg-red-100 text-red-700", label: "Ошибка", Icon: XCircle };
  return { className: "bg-yellow-100 text-yellow-700", label: "На проверке", Icon: Clock };
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

                      <div className="space-y-3">
                        <CheckRow
                          ok={s.code_check?.status === "done"}
                          name="Код (README, LICENSE, deps, LOC, секреты)"
                          score={s.code_check?.score}
                          extra={
                            s.code_check
                              ? `LOC: ${s.code_check.loc}, линтер: ${s.code_check.lint_issues}, секретов: ${s.code_check.secrets_found}`
                              : ""
                          }
                        />
                        <CheckRow
                          ok={s.doc_check?.status === "done"}
                          name={`Документация (${s.doc_check?.fmt ?? "—"})`}
                          score={s.doc_check?.score}
                          extra={
                            s.doc_check
                              ? `слов: ${s.doc_check.word_count}, картинок: ${s.doc_check.image_count}`
                              : ""
                          }
                        />
                        <CheckRow
                          ok={s.presentation_check?.status === "done"}
                          name={`Презентация (${s.presentation_check?.fmt ?? "—"})`}
                          score={s.presentation_check?.score}
                          extra={
                            s.presentation_check
                              ? `слайдов: ${s.presentation_check.slide_count}, разделов: ${s.presentation_check.sections_found.length}`
                              : ""
                          }
                        />
                        <CheckRow
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

function CheckRow({
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
