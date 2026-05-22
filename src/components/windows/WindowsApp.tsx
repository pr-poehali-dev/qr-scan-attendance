import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import Icon from "@/components/ui/icon";
import { api, Worker, AttendanceRecord, Stats } from "@/lib/api";
import { fmtScanned } from "@/lib/utils-time";

type WinTab = "workers" | "history" | "stats" | "reports" | "settings";
type IconName = Parameters<typeof Icon>[0]["name"];

export default function WindowsApp() {
  const [activeTab, setActiveTab] = useState<WinTab>("workers");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPos, setNewPos] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printWorker, setPrintWorker] = useState<Worker | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [w, r, s] = await Promise.all([api.getWorkers(), api.getRecords({ limit: 200 }), api.getStats()]);
    setWorkers(w); setRecords(r); setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const t = setInterval(() => {
      api.getRecords({ limit: 200 }).then(setRecords);
      api.getStats().then(setStats);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const w = await api.addWorker(newName.trim(), newPos.trim() || "Работник");
    setWorkers((prev) => [...prev, w]);
    setSelectedWorker(w);
    setNewName(""); setNewPos(""); setShowAdd(false); setAdding(false);
  };

  const handleDelete = async (id: number) => {
    await api.deleteWorker(id);
    setWorkers((prev) => prev.filter(w => w.id !== id));
    if (selectedWorker?.id === id) setSelectedWorker(null);
  };

  const handlePrint = (w: Worker) => {
    setPrintWorker(w);
    setTimeout(() => { window.print(); setTimeout(() => setPrintWorker(null), 500); }, 200);
  };

  const winTabs: { id: WinTab; label: string; icon: IconName }[] = [
    { id: "workers", label: "Работники", icon: "Users" },
    { id: "history", label: "История", icon: "ClipboardList" },
    { id: "stats", label: "Статистика", icon: "BarChart3" },
    { id: "reports", label: "Отчёты", icon: "FileText" },
    { id: "settings", label: "Настройки", icon: "Settings2" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {printWorker && (
        <div className="fixed inset-0 z-[999] bg-white flex-col items-center justify-center print-show" style={{ display: "none" }}>
          <div style={{ textAlign: "center", padding: 40, fontFamily: "sans-serif" }}>
            <div style={{ fontSize: 12, color: "#888", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>ТАБЕЛЬПРО · Пропуск работника</div>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <QRCodeSVG value={printWorker.qr_code} size={200} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>{printWorker.name}</div>
            <div style={{ fontSize: 14, color: "#666", marginTop: 6 }}>{printWorker.position}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 10 }}>QR: {printWorker.qr_code}</div>
          </div>
        </div>
      )}

      <header className="glass-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Icon name="HardHat" size={18} className="text-primary" />
          </div>
          <div>
            <div className="text-base font-bold tracking-widest" style={{ fontFamily: "Oswald, sans-serif" }}>ТАБЕЛЬПРО</div>
            <div className="text-xs text-muted-foreground">Панель управления · Windows</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {stats && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-accent text-xs font-semibold">
                <Icon name="Circle" size={8} className="fill-accent text-accent" />
                {stats.on_site} на объекте
              </span>
              <span className="text-muted-foreground text-xs">{stats.checked_in_today} явок сегодня</span>
            </div>
          )}
          <button onClick={loadAll} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/15 transition-colors" title="Обновить">
            <Icon name="RefreshCw" size={15} className={loading ? "animate-spin text-primary" : "text-muted-foreground"} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 glass-card border-r border-border flex flex-col py-4 gap-1 px-2 shrink-0">
          {winTabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === t.id ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}>
              <Icon name={t.icon} size={18} />{t.label}
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-auto p-6">

          {activeTab === "workers" && (
            <div className="animate-fade-in space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>РАБОТНИКИ</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{workers.length} чел. · QR-коды · Печать</p>
                </div>
                <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl">
                  <Icon name="UserPlus" size={18} />Добавить работника
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  {loading && <div className="text-muted-foreground text-sm py-8 text-center">Загрузка...</div>}
                  {workers.map((w, i) => (
                    <div key={w.id} onClick={() => setSelectedWorker(w)}
                      className={`glass-card rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-all animate-fade-in stagger-${Math.min(i + 1, 6)} ${selectedWorker?.id === w.id ? "border-primary/40 bg-primary/5" : ""}`}>
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <Icon name="User" size={20} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{w.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{w.position}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); handlePrint(w); }}
                          className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors" title="Печать QR">
                          <Icon name="Printer" size={14} className="text-muted-foreground" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                          className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors" title="Удалить">
                          <Icon name="Trash2" size={14} className="text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="glass-card rounded-2xl p-5 flex flex-col items-center">
                  {selectedWorker ? (<>
                    <div className="text-xs text-muted-foreground uppercase tracking-widest mb-4">QR-код работника</div>
                    <div className="w-44 h-44 rounded-2xl bg-white flex items-center justify-center mb-4 p-2">
                      <QRCodeSVG value={selectedWorker.qr_code} size={160} />
                    </div>
                    <div className="text-center mb-4">
                      <div className="font-bold text-sm">{selectedWorker.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{selectedWorker.position}</div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono break-all">{selectedWorker.qr_code}</div>
                    </div>
                    <button onClick={() => handlePrint(selectedWorker)} className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2">
                      <Icon name="Printer" size={16} />Распечатать
                    </button>
                  </>) : (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                        <Icon name="QrCode" size={28} className="text-muted-foreground" />
                      </div>
                      <div className="text-sm text-muted-foreground">Выберите работника<br />для просмотра QR-кода</div>
                    </div>
                  )}
                </div>
              </div>

              {showAdd && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                  onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
                  <div className="glass-card rounded-3xl p-6 w-full max-w-sm mx-4 animate-scale-in space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>НОВЫЙ РАБОТНИК</h3>
                      <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                        <Icon name="X" size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block">ФИО работника</label>
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="Иванов Иван Иванович"
                          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors" autoFocus />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block">Должность</label>
                        <input type="text" value={newPos} onChange={(e) => setNewPos(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAdd()} placeholder="Монтажник, Электрик..."
                          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button onClick={() => setShowAdd(false)} className="py-3 rounded-xl bg-secondary text-sm font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>ОТМЕНА</button>
                      <button onClick={handleAdd} disabled={adding} className="btn-primary py-3 rounded-xl text-sm">{adding ? "..." : "ДОБАВИТЬ"}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="animate-fade-in space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>ИСТОРИЯ ЗАПИСЕЙ</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{records.length} записей · обновляется каждые 15 сек</p>
                </div>
                <button onClick={() => api.getRecords({ limit: 200 }).then(setRecords)}
                  className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/30 px-3 py-2 rounded-xl hover:bg-primary/20 transition-colors">
                  <Icon name="RefreshCw" size={13} />Обновить
                </button>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                {records.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">Записей пока нет</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Работник", "Должность", "Тип", "Время", "Объект"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-widest font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={r.id} className={`border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
                          <td className="px-4 py-3.5 font-medium">{r.worker_name}</td>
                          <td className="px-4 py-3.5 text-muted-foreground text-xs">{r.worker_position}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${r.scan_type === "checkin" ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground"}`}
                              style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                              <Icon name={r.scan_type === "checkin" ? "LogIn" : "LogOut"} size={11} />
                              {r.scan_type === "checkin" ? "ПРИХОД" : "УХОД"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-primary">{fmtScanned(r.scanned_at)}</td>
                          <td className="px-4 py-3.5 text-muted-foreground">{r.object_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === "stats" && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>СТАТИСТИКА</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Данные в реальном времени</p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {stats && ([
                  { label: "На объектах", value: String(stats.on_site), icon: "Users" as IconName, color: "text-accent" },
                  { label: "Явка сегодня", value: String(stats.checked_in_today), icon: "UserCheck" as IconName, color: "text-primary" },
                  { label: "Вышли", value: String(stats.checked_out_today), icon: "UserMinus" as IconName, color: "text-muted-foreground" },
                  { label: "Всего зарегистрировано", value: String(stats.total_registered), icon: "Database" as IconName, color: "text-blue-400" },
                ]).map((s, i) => (
                  <div key={s.label} className={`glass-card rounded-2xl p-5 animate-fade-in stagger-${i + 1}`}>
                    <Icon name={s.icon} size={22} className={s.color} />
                    <div className={`text-3xl font-bold mt-3 ${s.color}`} style={{ fontFamily: "Oswald, sans-serif" }}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="animate-fade-in space-y-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>ОТЧЁТЫ ПО ЯВКАМ</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Скачать или распечатать</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { title: "Явка за сегодня", desc: "Все приходы и уходы за текущий день", icon: "CalendarCheck" as IconName },
                  { title: "Переработки", desc: "Сотрудники с временем сверх нормы", icon: "AlarmClock" as IconName },
                  { title: "Нарушения дисциплины", desc: "Опоздания и прогулы по объектам", icon: "AlertTriangle" as IconName },
                  { title: "Сводный по объектам", desc: "Детализация по каждому объекту", icon: "Building2" as IconName },
                  { title: "Рабочие часы", desc: "Итоговая таблица по работникам", icon: "Clock" as IconName },
                  { title: "Список работников", desc: "Все зарегистрированные сотрудники", icon: "Users" as IconName },
                ]).map((r, i) => (
                  <button key={r.title} className={`glass-card rounded-2xl p-5 flex items-center gap-4 hover:border-primary/40 transition-all group animate-fade-in stagger-${Math.min(i + 1, 6)} text-left`}>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon name={r.icon} size={24} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{r.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                    </div>
                    <Icon name="Download" size={18} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="animate-fade-in space-y-5 max-w-xl">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>НАСТРОЙКИ</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Подключение и синхронизация</p>
              </div>
              {[
                { title: "Подключение", items: [
                  { label: "Сервер API", value: "functions.poehali.dev", icon: "Server" as IconName },
                  { label: "База данных", value: "PostgreSQL · подключено ✓", icon: "Database" as IconName },
                ]},
                { title: "Синхронизация", items: [
                  { label: "Автообновление истории", value: "Каждые 15 секунд", icon: "RefreshCw" as IconName },
                ]},
                { title: "Безопасность", items: [
                  { label: "Пароль смены объекта (Android)", value: "1234 (по умолчанию)", icon: "Lock" as IconName },
                  { label: "Версия", value: "1.0.0", icon: "Info" as IconName },
                ]},
              ].map((section) => (
                <div key={section.title} className="glass-card rounded-2xl p-5">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-4">{section.title}</div>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <div key={item.label} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                        <Icon name={item.icon} size={16} className="text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">{item.label}</div>
                          <div className="text-sm font-medium mt-0.5">{item.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <style>{`
        @media print {
          body > div > * { display: none !important; }
          .print-show { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
