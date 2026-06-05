import { useEffect, useRef, useState, useCallback } from "react";
import {
  IconBell as Bell,
  IconCheck as Check,
  IconChecks as CheckCheck,
} from "@tabler/icons-react";
import { api } from "../../lib/api";
import type { AppNotification, NotificationList } from "../../lib/types";

function timeAgo(s: string): string {
  const d = new Date(s);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return d.toLocaleDateString("ru-RU");
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<NotificationList>("/notifications");
      setItems(data.items);
      setUnread(data.unread);
    } catch {

    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markRead = async (n: AppNotification) => {
    if (n.read) return;
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api.post(`/notifications/${n.id}/read`);
    } catch {
      void load();
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    try {
      await api.post("/notifications/read-all");
    } catch {
      void load();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
        className="relative text-gray-500 hover:text-blue-600 transition-colors"
        aria-label="Уведомления"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-bold text-sm text-gray-900">Уведомления</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline"
              >
                <CheckCheck size={14} />
                Прочитать все
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Уведомлений пока нет</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <div
                    className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      n.read ? "bg-transparent" : "bg-blue-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                      {n.read && <Check size={12} className="text-gray-300 flex-shrink-0" />}
                    </div>
                    {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
