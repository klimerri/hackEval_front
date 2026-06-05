import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  IconChevronLeft as ChevronLeft,
  IconCircleCheck as CheckCircle2,
  IconAlertCircle as AlertCircle,
  IconUsers as Users,
  IconClock as Clock,
  IconArrowRight as ArrowRight,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useApi } from "../lib/useApi";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Hackathon, Team, JoinRequestOut } from "../lib/types";

type ApplicationStatus = "none" | "pending" | "approved" | "rejected";

export function HackathonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hackathonId = Number(id);

  const { data: hackathon, loading, error } = useApi<Hackathon>(
    hackathonId ? `/hackathons/${hackathonId}` : null,
    [hackathonId],
  );
  const { data: myTeams, reload: reloadTeams } = useApi<Team[]>("/teams");
  const { data: explore, reload: reloadExplore } = useApi<Team[]>("/teams/explore");

  const myTeam = myTeams?.find((t) => t.hackathon_id === hackathonId);

  const applicationStatus: ApplicationStatus = myTeam
    ? myTeam.status === "approved"
      ? "approved"
      : myTeam.status === "rejected"
        ? "rejected"
        : "pending"
    : "none";

  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [requestedTeamIds, setRequestedTeamIds] = useState<Set<number>>(new Set());

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      toast.error("Введите название команды");
      return;
    }
    setSubmitting(true);
    try {
      await api.post<Team>("/teams", { name: newTeamName, hackathon_id: hackathonId });
      toast.success("Команда создана, заявка отправлена организатору");
      setCreating(false);
      reloadTeams();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось создать команду");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (teamId: number) => {
    setSubmitting(true);
    try {
      await api.post<JoinRequestOut>(`/teams/${teamId}/join`, { message: joinMessage });
      toast.success("Заявка отправлена капитану команды");
      setRequestedTeamIds((prev) => new Set(prev).add(teamId));
      setJoinMessage("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Не удалось отправить заявку");
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) return <div className="text-gray-400">Загрузка...</div>;
  if (error) return <div className="text-red-500">Ошибка: {error}</div>;
  if (!hackathon) return null;

  const openTeams = (explore ?? []).filter(
    (t) => t.hackathon_id === hackathonId && t.status === "approved",
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ChevronLeft size={20} />
        Назад к списку
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">{hackathon.title}</h1>
            <p className="text-sm text-gray-600 leading-relaxed">{hackathon.description}</p>

            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Дедлайн подачи:</span>
                <span className="font-bold text-red-600">
                  {new Date(hackathon.submission_deadline).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Ваша команда:</span>
                <span className="font-bold text-blue-600">{myTeam?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Статус заявки:</span>
                <span
                  className={cn(
                    "font-bold px-2 py-0.5 rounded text-[10px] uppercase",
                    applicationStatus === "none" && "bg-gray-100 text-gray-600",
                    applicationStatus === "pending" && "bg-yellow-100 text-yellow-600",
                    applicationStatus === "approved" && "bg-green-100 text-green-600",
                    applicationStatus === "rejected" && "bg-red-100 text-red-600",
                  )}
                >
                  {applicationStatus === "none" && "Не подана"}
                  {applicationStatus === "pending" && "На рассмотрении"}
                  {applicationStatus === "approved" && "Одобрена"}
                  {applicationStatus === "rejected" && "Отклонена"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
            <h3 className="font-bold text-blue-900 flex items-center gap-2">
              <AlertCircle size={18} />
              Правила подачи
            </h3>
            <ul className="space-y-2">
              {hackathon.rules.map((rule, idx) => (
                <li
                  key={idx}
                  className="text-xs text-blue-800 flex items-start gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2">
          {user?.role !== "participant" ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Режим просмотра</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Создание команд и подача заявок доступны только участникам. Вы вошли как
                {user?.role === "jury" ? " член жюри" : " организатор"} — оценка и управление
                хакатоном находятся в соответствующих разделах.
              </p>
            </div>
          ) : (
          <>
          {applicationStatus === "none" && !creating && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Users size={40} />
              </div>
              <div className="space-y-2 max-w-sm mx-auto">
                <h2 className="text-2xl font-bold text-gray-900">Готовы участвовать?</h2>
                <p className="text-gray-500">
                  Создайте свою команду или присоединитесь к открытой.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  Создать команду
                  <ArrowRight size={20} />
                </button>
              </div>

              {openTeams.length > 0 && (
                <div className="pt-8 text-left space-y-3">
                  <h3 className="text-sm font-bold text-gray-500 uppercase">
                    Открытые команды ({openTeams.length})
                  </h3>
                  <input
                    value={joinMessage}
                    onChange={(e) => setJoinMessage(e.target.value)}
                    placeholder="Сообщение капитану (необязательно)"
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-500 outline-none"
                  />
                  {openTeams.slice(0, 5).map((t) => {
                    const requested = requestedTeamIds.has(t.id);
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                      >
                        <span className="font-semibold text-sm">{t.name}</span>
                        <button
                          onClick={() => handleJoin(t.id)}
                          disabled={submitting || requested}
                          className={`text-xs px-3 py-1.5 rounded-lg ${
                            requested
                              ? "bg-gray-200 text-gray-500 cursor-default"
                              : "bg-blue-600 text-white hover:bg-blue-700"
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

          {creating && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Создание команды</h2>
              <input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Название команды"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCreateTeam}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
                >
                  {submitting ? "Создание..." : "Создать и подать заявку"}
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl"
                >
                  Отмена
                </button>
              </div>
              {user && (
                <p className="text-xs text-gray-500">
                  Капитаном станет {user.name} ({user.email})
                </p>
              )}
            </div>
          )}

          {applicationStatus === "pending" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center">
                <Clock size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">Заявка на рассмотрении</h3>
                <p className="text-gray-500 max-w-xs">
                  Организатор проверит команду. После одобрения станет доступна форма подачи
                  артефактов.
                </p>
              </div>
              <button
                onClick={() => {
                  reloadTeams();
                  reloadExplore();
                }}
                className="text-xs text-blue-500 hover:underline"
              >
                Обновить статус
              </button>
            </div>
          )}

          {applicationStatus === "approved" && myTeam && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center space-y-5 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-2 max-w-sm mx-auto">
                <h2 className="text-xl font-bold text-gray-900">Участие одобрено</h2>
                <p className="text-gray-500">
                  Команда «{myTeam.name}» допущена. Загрузка и обновление артефактов
                  решения — в личном кабинете команды.
                </p>
              </div>
              <button
                onClick={() => navigate("/teams")}
                className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                Перейти в Командный центр
                <ArrowRight size={20} />
              </button>
            </div>
          )}
          {applicationStatus === "rejected" && (
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-20 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Заявка отклонена</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Организатор не одобрил вашу команду для участия. Свяжитесь с ним для уточнения
                причин.
              </p>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
