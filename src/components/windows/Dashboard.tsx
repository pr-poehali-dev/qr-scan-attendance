import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api, DashboardData } from "@/lib/api";
import { useNow, fmtDate, fmtTime, fmtDay } from "@/lib/utils-time";

const LOGO_URL = "https://cdn.poehali.dev/projects/621efeb5-f4c4-4aa2-bc50-e52960cacfa7/bucket/a6358c47-e644-4687-9ce5-1339ec279c62.jpg";

export default function Dashboard() {
  const now = useNow();
  const [data, setData] = useState<DashboardData | null>(null);
  const [lateAfter, setLateAfter] = useState("08:00");
  const [loading, setLoading] = useState(true);

  const load = (threshold = lateAfter) => {
    setLoading(true);
    api.getDashboard(threshold).then((d) => { setData(d); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setInterval(() => load(), 30000);
    return () => clearInterval(t);
  }, [lateAfter]);

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="px-8 py-5 flex items-center justify-between border-b border-border glass-card">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/40 shadow-lg shadow-primary/10 shrink-0">
            <img src={LOGO_URL} alt="Абсолют" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-widest" style={{ fontFamily: "Oswald, sans-serif" }}>АБСОЛЮТ</div>
            <div className="text-xs text-muted-foreground tracking-widest uppercase">Строительная компания</div>
          </div>
        </div>

        {/* Date / Time */}
        <div className="text-right">
          <div className="text-4xl font-bold tabular-nums text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>
            {fmtTime(now)}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{fmtDate(now)} · <span className="capitalize">{fmtDay(now)}</span></div>
        </div>
      </div>

      {/* ── SUMMARY STRIP ── */}
      <div className="px-8 py-4 grid grid-cols-4 gap-4">
        {[
          {
            label: "Всего на объектах",
            value: data ? String(data.total_present) : "—",
            icon: "Users" as const,
            color: "text-accent",
            bg: "bg-accent/10 border-accent/20",
          },
          {
            label: "Опоздали",
            value: data ? String(data.total_late) : "—",
            icon: "Clock" as const,
            color: "text-destructive",
            bg: "bg-destructive/10 border-destructive/20",
          },
          {
            label: "Пришли вовремя",
            value: data ? String(Math.max(0, data.total_present - data.total_late)) : "—",
            icon: "CheckCircle2" as const,
            color: "text-primary",
            bg: "bg-primary/10 border-primary/20",
          },
          {
            label: `Порог опоздания`,
            value: lateAfter,
            icon: "AlarmClock" as const,
            color: "text-muted-foreground",
            bg: "bg-secondary border-border",
            editable: true,
          },
        ].map((s) => (
          <div key={s.label} className={`glass-card rounded-2xl p-4 flex items-center gap-3 border ${s.bg} animate-fade-in`}>
            <Icon name={s.icon} size={24} className={s.color} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-widest truncate">{s.label}</div>
              {s.editable ? (
                <input
                  type="time"
                  value={lateAfter}
                  onChange={(e) => { setLateAfter(e.target.value); load(e.target.value); }}
                  className="text-2xl font-bold bg-transparent outline-none text-foreground w-full"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                />
              ) : (
                <div className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                  {loading ? <span className="text-muted-foreground text-lg">...</span> : s.value}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 px-8 pb-8 grid grid-cols-2 gap-6 overflow-auto">

        {/* ── LEFT: ПО ОБЪЕКТАМ ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Building2" size={18} className="text-primary" />
            <h2 className="text-lg font-bold tracking-wide" style={{ fontFamily: "Oswald, sans-serif" }}>ПО ОБЪЕКТАМ</h2>
            <button onClick={() => load()} className="ml-auto w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/15 transition-colors">
              <Icon name="RefreshCw" size={13} className={loading ? "animate-spin text-primary" : "text-muted-foreground"} />
            </button>
          </div>

          {!data || data.objects.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground text-sm">
              {loading ? "Загрузка..." : "Данных за сегодня нет"}
            </div>
          ) : (
            data.objects.map((obj, oi) => (
              <div key={obj.id} className={`glass-card rounded-2xl overflow-hidden animate-fade-in stagger-${Math.min(oi + 1, 5)}`}>
                {/* Object header */}
                <div className="px-5 py-3 bg-secondary/50 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <Icon name="MapPin" size={14} className="text-primary" />
                    <span className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif" }}>{obj.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Итого:</span>
                    <span className="text-sm font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>{obj.total}</span>
                  </div>
                </div>

                {/* Contractors table */}
                {obj.contractors.length === 0 ? (
                  <div className="px-5 py-3 text-xs text-muted-foreground">Нет данных</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {obj.contractors.map((c) => {
                      const onTime = Math.max(0, c.present - c.late);
                      const pct = c.present > 0 ? Math.round((onTime / c.present) * 100) : 0;
                      return (
                        <div key={c.name} className="px-5 py-3 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon name="Briefcase" size={13} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-center">
                              <div className="text-lg font-bold text-accent leading-none" style={{ fontFamily: "Oswald, sans-serif" }}>{c.present}</div>
                              <div className="text-[10px] text-muted-foreground">пришло</div>
                            </div>
                            <div className="text-center">
                              <div className={`text-lg font-bold leading-none ${c.late > 0 ? "text-destructive" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                                {c.late}
                              </div>
                              <div className="text-[10px] text-muted-foreground">опозд.</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── RIGHT: СВОДНО ПО ПОДРЯДЧИКАМ ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Briefcase" size={18} className="text-primary" />
            <h2 className="text-lg font-bold tracking-wide" style={{ fontFamily: "Oswald, sans-serif" }}>ПО ПОДРЯДЧИКАМ</h2>
          </div>

          {!data || data.contractors.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center text-muted-foreground text-sm">
              {loading ? "Загрузка..." : "Данных за сегодня нет"}
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden">
              {/* Header row */}
              <div className="px-5 py-3 bg-secondary/50 border-b border-border grid grid-cols-12 gap-2">
                <div className="col-span-5 text-xs text-muted-foreground uppercase tracking-widest">Подрядчик</div>
                <div className="col-span-3 text-xs text-muted-foreground uppercase tracking-widest text-center">Пришло</div>
                <div className="col-span-2 text-xs text-muted-foreground uppercase tracking-widest text-center">Опозд.</div>
                <div className="col-span-2 text-xs text-muted-foreground uppercase tracking-widest text-center">Вовремя</div>
              </div>
              <div className="divide-y divide-border/50">
                {data.contractors.map((c, i) => {
                  const onTime = Math.max(0, c.present - c.late);
                  const maxPresent = data.contractors[0]?.present || 1;
                  return (
                    <div key={c.name} className={`px-5 py-3.5 grid grid-cols-12 gap-2 items-center hover:bg-secondary/20 transition-colors animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="h-1 bg-secondary rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-primary/60 rounded-full transition-all duration-700"
                              style={{ width: `${(c.present / maxPresent) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3 text-center">
                        <span className="text-xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>{c.present}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`text-xl font-bold ${c.late > 0 ? "text-destructive" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                          {c.late}
                        </span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-xl font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>{onTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total row */}
              <div className="px-5 py-3 bg-secondary/30 border-t border-border grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 text-xs font-bold text-muted-foreground uppercase tracking-widest">Итого</div>
                <div className="col-span-3 text-center">
                  <span className="text-xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>{data.total_present}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-xl font-bold ${data.total_late > 0 ? "text-destructive" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>{data.total_late}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-xl font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>{Math.max(0, data.total_present - data.total_late)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="RefreshCw" size={11} />
            Обновляется каждые 30 секунд
          </div>
        </div>
      </div>
    </div>
  );
}
