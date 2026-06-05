import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  IconCalendar as Calendar,
  IconUsers as Users,
  IconSearch as Search,
  IconFilter as Filter,
} from "@tabler/icons-react";
import { useApi } from "../lib/useApi";
import type { Hackathon } from "../lib/types";

function fmtDate(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
  } catch {
    return s;
  }
}

export function HackathonListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data, loading, error } = useApi<Hackathon[]>("/hackathons");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = searchTerm.toLowerCase().trim();
    if (!q) return data;
    return data.filter(
      (h) =>
        h.title.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q) ||
        h.type.toLowerCase().includes(q),
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Каталог хакатонов</h1>
          <p className="text-gray-500">Выберите подходящее мероприятие и подайте заявку.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Найти хакатон..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 transition-all"
            />
          </div>
          <button className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-400">Загрузка...</div>}
      {error && <div className="text-red-500">Ошибка: {error}</div>}

      {data && data.length === 0 && (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-500">
          Хакатоны пока не созданы.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filtered.map((h) => (
          <div
            key={h.id}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
              {h.image_url ? (
                <img
                  src={h.image_url}
                  alt={h.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/70 text-5xl font-black">
                  {h.title[0]}
                </div>
              )}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-blue-600 shadow-sm">
                {h.type}
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md">
                  {h.status}
                </span>
                <span className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-bold rounded-md">
                  до {fmtDate(h.submission_deadline)}
                </span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {h.title}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-2 mb-6">{h.description}</p>

              <div className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <span>
                      {fmtDate(h.start_date)} – {fmtDate(h.end_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-gray-400" />
                    <span>{h.teams_count} ком.</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="text-sm">
                    <span className="text-gray-400">Призовой:</span>
                    <span className="ml-2 font-bold text-gray-900">
                      {h.prize_pool || "—"}
                    </span>
                  </div>
                  <Link
                    to={`/hackathons/${h.id}`}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Подробнее
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
