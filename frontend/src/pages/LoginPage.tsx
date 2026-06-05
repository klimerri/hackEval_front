import { useState } from "react";
import { useNavigate } from "react-router";
import {
  IconTrophy as Trophy,
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
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8 bg-blue-600 text-white text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
            <Trophy size={32} />
          </div>
          <h1 className="text-2xl font-bold">HackAuth Automation</h1>
          <p className="text-blue-100 mt-2">Система автоматической проверки решений</p>
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50"
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
