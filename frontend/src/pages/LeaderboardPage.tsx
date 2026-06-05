import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal } from "lucide-react";
import { useApi } from "../lib/useApi";
import type { Hackathon, TeamResult } from "../lib/types";

const MEDAL = ["text-yellow-500", "text-gray-400", "text-amber-700"];

export function LeaderboardPage() {
  const { data: hackathons } = useApi<Hackathon[]>("/hackathons");
  const [selected, setSelected] = useState<number | "">("");

  // default to the first hackathon once loaded
  useEffect(() => {
    if (selected === "" && hackathons && hackathons.length > 0) {
      setSelected(hackathons[0].id);
    }
  }, [hackathons, selected]);

  const { data: ranking, loading } = useApi<TeamResult[]>(
    selected ? `/results/hackathons/${selected}/ranking` : null,
    [selected],
  );

  const rows = useMemo(() => ranking ?? [], [ranking]);
  const current = hackathons?.find((h) => h.id === selected);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Рейтинг команд</h1>
          <p className="text-gray-500">Итоговая таблица по сумме авто-оценки и оценок жюри.</p>
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value ? Number(e.target.value) : "")}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none w-full md:w-auto"
        >
          <option value="">Выберите хакатон...</option>
          {(hackathons ?? []).map((h) => (
            <option key={h.id} value={h.id}>
              {h.title}
            </option>
          ))}
        </select>
      </div>

      {current?.prize_pool && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Trophy size={16} className="text-yellow-500" />
          Призовой фонд: <span className="font-bold text-gray-900">{current.prize_pool}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Пока нет оценённых команд.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[560px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                    Место
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Команда
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Авто
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Жюри
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Итог
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, idx) => {
                  const place = r.rank ?? (r.final_score > 0 ? idx + 1 : null);
                  return (
                    <tr key={r.team_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        {place && place <= 3 ? (
                          <span className="inline-flex items-center gap-1 font-black">
                            <Medal size={18} className={MEDAL[place - 1]} />
                            {place}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-bold">{place ?? "—"}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{r.team_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {r.auto_score.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {r.jury_score != null ? r.jury_score.toFixed(1) : "—"}
                      </td>
                      <td className="px-6 py-4 font-mono font-black text-blue-600">
                        {r.final_score.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
