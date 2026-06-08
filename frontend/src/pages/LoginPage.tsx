import { useState } from "react";
import { useNavigate } from "react-router";
import {
  IconMail as Mail,
  IconUser as User,
  IconKey as KeyRound,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

type Mode = "login" | "register";

const DEMO_ACCOUNTS = [
  { role: "Организатор", emails: ["organizer@hackauth.com"] },
  { role: "Жюри", emails: ["john@jury.com", "jane@jury.com", "alex@jury.com", "reviewer@jury.com"] },
  { role: "Участники", emails: ["alex@team.com", "sarah@team.com", "mike@team.com"] },
];

export function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Заполните email и пароль");
      return;
    }
    if (mode === "register" && !name) {
      toast.error("Укажите ФИО");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Введите корректный email");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Добро пожаловать!");
      } else {
        await register(name, email, password);
        toast.success("Аккаунт создан");
      }
      navigate("/");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Не удалось войти";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-canvas flex min-h-screen items-center justify-center p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />
        <div className="px-8 pb-6 pt-8 text-center">
          <div className="relative mx-auto mb-4 h-12 w-12">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_8px_24px_-6px_rgba(59,130,246,0.7)]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="block h-[3px] w-4 rounded-full bg-white/95" />
              <span className="block h-[3px] w-5 rounded-full bg-white/80" />
              <span className="block h-[3px] w-[22px] rounded-full bg-white/60" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Базис</h1>
          <p className="mt-2 text-sm text-slate-500">Система автоматической проверки решений</p>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-3 text-sm font-semibold ${
              mode === "login"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 py-3 text-sm font-semibold ${
              mode === "register"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={submit} className="p-8 space-y-6">
          {mode === "register" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User size={16} />
                ФИО
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-900"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Mail size={16} />
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.ru"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-900"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <KeyRound size={16} />
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-900"
              required
            />
          </div>

          {mode === "register" && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Регистрация создаёт аккаунт участника. Роли жюри и организатора
              назначает организатор.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "Подождите..." : mode === "login" ? "Войти в систему" : "Создать аккаунт"}
          </button>

          <div className="text-xs text-gray-400 space-y-2 pt-2 border-t border-gray-100">
            <p className="text-center font-semibold text-gray-500">
              Демо-аккаунты (пароль: <span className="font-mono">password</span>)
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMO_ACCOUNTS.map((g) => (
                <div key={g.role} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-gray-400">{g.role}</span>
                  {g.emails.map((em) => (
                    <button
                      type="button"
                      key={em}
                      onClick={() => {
                        setMode("login");
                        setEmail(em);
                        setPassword("password");
                      }}
                      className="text-left font-mono text-[11px] text-blue-600 hover:underline"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
