import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";
import { api, DashboardData, ObjectDashboard } from "@/lib/api";
import { useNow, fmtDate, fmtTime, fmtDay } from "@/lib/utils-time";

const LOGO_URL = "https://cdn.poehali.dev/projects/621efeb5-f4c4-4aa2-bc50-e52960cacfa7/bucket/a6358c47-e644-4687-9ce5-1339ec279c62.jpg";

// ── Модалка настройки порогов одного объекта ──
function ObjectSettingsModal({
  obj,
  onClose,
  onSaved,
}: {
  obj: ObjectDashboard;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [start, setStart] = useState(obj.work_start);
  const [end, setEnd] = useState(obj.work_end);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const checkPw = () => {
    if (pw === "1234") { setPwOk(true); setPwErr(false); }
    else { setPwErr(true); setPw(""); }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveErr("");
    try {
      await api.updateObject(obj.id, { password: "1234", work_start: start, work_end: end });
      onSaved();
      onClose();
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : "Ошибка");
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-card rounded-3xl p-6 w-full max-w-sm mx-4 animate-scale-in space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>РАБОЧЕЕ ВРЕМЯ</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{obj.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Icon name="X" size={16} className="text-muted-foreground" />
          </button>
        </div>

        {!pwOk ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Введите пароль для изменения настроек</p>
            <input
              type="password" value={pw}
              onChange={(e) => { setPw(e.target.value); setPwErr(false); }}
              onKeyDown={(e) => e.key === "Enter" && checkPw()}
              placeholder="Пароль"
              className={`w-full bg-secondary border rounded-xl px-4 py-3 text-lg text-center tracking-widest outline-none transition-colors ${pwErr ? "border-destructive" : "border-border focus:border-primary"}`}
            />
            {pwErr && <p className="text-xs text-destructive text-center">Неверный пароль</p>}
            <button onClick={checkPw} className="btn-primary w-full py-3.5 rounded-xl">ВОЙТИ</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
                  <span className="flex items-center gap-1.5">
                    <Icon name="LogIn" size={11} className="text-accent" /> Начало работы
                  </span>
                </label>
                <input
                  type="time" value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-xl font-bold text-accent outline-none focus:border-accent transition-colors text-center"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                />
                <p className="text-xs text-muted-foreground mt-1.5 text-center">Порог опоздания</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-widest mb-2 block">
                  <span className="flex items-center gap-1.5">
                    <Icon name="LogOut" size={11} className="text-destructive" /> Конец работы
                  </span>
                </label>
                <input
                  type="time" value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-xl font-bold text-destructive outline-none focus:border-destructive transition-colors text-center"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                />
                <p className="text-xs text-muted-foreground mt-1.5 text-center">Порог раннего ухода</p>
              </div>
            </div>
            {saveErr && <p className="text-xs text-destructive text-center">{saveErr}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="py-3 rounded-xl bg-secondary text-sm font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>ОТМЕНА</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary py-3 rounded-xl text-sm">
                {saving ? "..." : "СОХРАНИТЬ"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Главный Dashboard ──
export default function Dashboard() {
  const now = useNow();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsObj, setSettingsObj] = useState<ObjectDashboard | null>(null);

  const load = () => {
    setLoading(true);
    api.getDashboard().then((d) => { setData(d); setLoading(false); });
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">

      {/* ── TOP BAR ── */}
      <div className="px-8 py-5 flex items-center justify-between border-b border-border glass-card">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/40 shadow-lg shadow-primary/10 shrink-0">
            <img src={LOGO_URL} alt="Абсолют" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-xl font-bold tracking-widest" style={{ fontFamily: "Oswald, sans-serif" }}>АБСОЛЮТ</div>
            <div className="text-xs text-muted-foreground tracking-widest uppercase">Строительная компания</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold tabular-nums text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>{fmtTime(now)}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{fmtDate(now)} · <span className="capitalize">{fmtDay(now)}</span></div>
        </div>
      </div>

      {/* ── SUMMARY STRIP ── */}
      <div className="px-8 py-4 grid grid-cols-4 gap-4">
        {[
          { label: "Всего на объектах",    value: data?.total_present,    icon: "Users"        as const, color: "text-accent",          bg: "bg-accent/10 border-accent/20" },
          { label: "Опоздали",             value: data?.total_late,        icon: "Clock"        as const, color: "text-destructive",      bg: "bg-destructive/10 border-destructive/20" },
          { label: "Ушли раньше срока",    value: data?.total_early_leave, icon: "LogOut"       as const, color: "text-yellow-400",       bg: "bg-yellow-400/10 border-yellow-400/20" },
          { label: "Пришли вовремя",       value: data ? Math.max(0, data.total_present - data.total_late) : undefined, icon: "CheckCircle2" as const, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
        ].map((s) => (
          <div key={s.label} className={`glass-card rounded-2xl p-4 flex items-center gap-3 border ${s.bg} animate-fade-in`}>
            <Icon name={s.icon} size={24} className={s.color} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground uppercase tracking-widest truncate">{s.label}</div>
              <div className={`text-2xl font-bold mt-0.5 ${s.color}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                {loading || s.value === undefined ? <span className="text-muted-foreground text-lg">...</span> : s.value}
              </div>
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
            <button onClick={load} className="ml-auto w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/15 transition-colors" title="Обновить">
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
                {/* Заголовок объекта */}
                <div className="px-5 py-3 bg-secondary/50 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="MapPin" size={14} className="text-primary shrink-0" />
                    <span className="font-bold text-sm truncate" style={{ fontFamily: "Oswald, sans-serif" }}>{obj.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Пороги объекта */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-accent">
                        <Icon name="LogIn" size={10} />{obj.work_start}
                      </span>
                      <span className="text-muted-foreground">—</span>
                      <span className="flex items-center gap-1 text-destructive">
                        <Icon name="LogOut" size={10} />{obj.work_end}
                      </span>
                    </div>
                    <button
                      onClick={() => setSettingsObj(obj)}
                      className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors"
                      title="Настроить время"
                    >
                      <Icon name="Settings2" size={12} className="text-muted-foreground" />
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Итого:</span>
                      <span className="text-sm font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>{obj.total}</span>
                    </div>
                  </div>
                </div>

                {/* Подрядчики */}
                {obj.contractors.length === 0 ? (
                  <div className="px-5 py-3 text-xs text-muted-foreground">Нет данных</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {/* Шапка */}
                    <div className="px-5 py-1.5 grid grid-cols-12 gap-1">
                      <div className="col-span-5 text-[10px] text-muted-foreground uppercase tracking-widest">Подрядчик</div>
                      <div className="col-span-3 text-[10px] text-muted-foreground uppercase tracking-widest text-center">Пришло</div>
                      <div className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-widest text-center">Опозд.</div>
                      <div className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-widest text-center">Ушли ран.</div>
                    </div>
                    {obj.contractors.map((c) => {
                      const onTime = Math.max(0, c.present - c.late);
                      const pct = c.present > 0 ? Math.round((onTime / c.present) * 100) : 0;
                      return (
                        <div key={c.name} className="px-5 py-2.5 grid grid-cols-12 gap-1 items-center">
                          <div className="col-span-5 min-w-0">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{pct}%</span>
                            </div>
                          </div>
                          <div className="col-span-3 text-center">
                            <span className="text-lg font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>{c.present}</span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`text-lg font-bold ${c.late > 0 ? "text-destructive" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                              {c.late}
                            </span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className={`text-lg font-bold ${c.early_leave > 0 ? "text-yellow-400" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                              {c.early_leave}
                            </span>
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
              {/* Шапка */}
              <div className="px-5 py-3 bg-secondary/50 border-b border-border grid grid-cols-12 gap-2">
                <div className="col-span-4 text-xs text-muted-foreground uppercase tracking-widest">Подрядчик</div>
                <div className="col-span-2 text-xs text-muted-foreground uppercase tracking-widest text-center">Пришло</div>
                <div className="col-span-2 text-xs text-muted-foreground uppercase tracking-widest text-center">Опозд.</div>
                <div className="col-span-2 text-xs text-muted-foreground uppercase tracking-widest text-center">Ушли ран.</div>
                <div className="col-span-2 text-xs text-muted-foreground uppercase tracking-widest text-center">Вовремя</div>
              </div>

              <div className="divide-y divide-border/50">
                {data.contractors.map((c, i) => {
                  const onTime = Math.max(0, c.present - c.late);
                  const maxPresent = data.contractors[0]?.present || 1;
                  return (
                    <div key={c.name} className={`px-5 py-3.5 grid grid-cols-12 gap-2 items-center hover:bg-secondary/20 transition-colors animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
                      <div className="col-span-4 flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="h-1 bg-secondary rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(c.present / maxPresent) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>{c.present}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`text-xl font-bold ${c.late > 0 ? "text-destructive" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>{c.late}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`text-xl font-bold ${c.early_leave > 0 ? "text-yellow-400" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>{c.early_leave}</span>
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="text-xl font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>{onTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Итого */}
              <div className="px-5 py-3 bg-secondary/30 border-t border-border grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Итого</div>
                <div className="col-span-2 text-center">
                  <span className="text-xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>{data.total_present}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-xl font-bold ${data.total_late > 0 ? "text-destructive" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>{data.total_late}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-xl font-bold ${data.total_early_leave > 0 ? "text-yellow-400" : "text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>{data.total_early_leave}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-xl font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>{Math.max(0, data.total_present - data.total_late)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon name="RefreshCw" size={11} />
            Обновляется каждые 30 секунд · нажмите ⚙ на объекте для настройки времени
          </div>
        </div>
      </div>

      {/* ── Модалка настроек объекта ── */}
      {settingsObj && (
        <ObjectSettingsModal
          obj={settingsObj}
          onClose={() => setSettingsObj(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
