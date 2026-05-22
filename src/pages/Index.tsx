import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import Icon from "@/components/ui/icon";
import { api, Worker, ObjectItem, AttendanceRecord, Stats } from "@/lib/api";

type AppMode = "choose" | "android" | "windows";
type WinTab = "workers" | "history" | "stats" | "reports" | "settings";
type IconName = Parameters<typeof Icon>[0]["name"];

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDay(d: Date) {
  return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}
function fmtScanned(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// ── QR Scanner через html5-qrcode ──
function QRScanner({ onScan, active }: { onScan: (code: string) => void; active: boolean }) {
  const divId = "qr-reader-box";
  const scannerRef = useRef<unknown>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (mountedRef.current) return;
    mountedRef.current = true;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      const scanner = new Html5Qrcode(divId);
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text: string) => { onScan(text); },
        () => {}
      ).catch(() => {});
    });

    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        const s = scannerRef.current as { stop: () => Promise<void>; clear: () => void };
        s.stop().then(() => s.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [active, onScan]);

  return <div id={divId} className="w-full rounded-2xl overflow-hidden" style={{ minHeight: 260 }} />;
}

// ═══════════════════════════════════════════
//  ANDROID APP
// ═══════════════════════════════════════════
function AndroidApp() {
  const now = useNow();
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [selectedObj, setSelectedObj] = useState<ObjectItem | null>(null);
  const [scanType, setScanType] = useState<"checkin" | "checkout">("checkin");
  const [scanActive, setScanActive] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [lastResult, setLastResult] = useState<{ name: string; position: string; time: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showObjModal, setShowObjModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const justScanned = useRef(false);

  useEffect(() => {
    api.getObjects().then((data) => {
      setObjects(data);
      if (data.length) setSelectedObj(data[0]);
    });
  }, []);

  const handleQR = useCallback(async (code: string) => {
    if (justScanned.current || !selectedObj) return;
    justScanned.current = true;
    setScanActive(false);
    setScanState("scanning");
    try {
      const res = await api.scan(code, selectedObj.id, scanType);
      setLastResult({ name: res.worker_name, position: res.worker_position, time: fmtScanned(res.scanned_at) });
      setScanState("success");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Ошибка");
      setScanState("error");
    }
    setTimeout(() => { setScanState("idle"); justScanned.current = false; }, 4000);
  }, [selectedObj, scanType]);

  const handlePwSubmit = () => {
    if (pwInput === "1234") { setPwOk(true); setPwError(false); }
    else { setPwError(true); setPwInput(""); }
  };

  const handleRename = async () => {
    if (!newName.trim() || !objects[selIdx]) return;
    setSaving(true);
    try {
      await api.renameObject(objects[selIdx].id, newName.trim(), "1234");
      const updated = await api.getObjects();
      setObjects(updated);
      const found = updated.find(o => o.id === objects[selIdx].id);
      if (found && selectedObj?.id === found.id) setSelectedObj(found);
      setShowObjModal(false); setPwOk(false); setPwInput(""); setNewName("");
    } catch { /* ignore */ }
    setSaving(false);
  };

  const closeObjModal = () => { setShowObjModal(false); setPwOk(false); setPwInput(""); setPwError(false); };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-sm mx-auto">
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Icon name="HardHat" size={14} className="text-primary" />
          </div>
          <span className="text-xs font-bold tracking-widest text-muted-foreground" style={{ fontFamily: "Oswald, sans-serif" }}>ТАБЕЛЬПРО</span>
        </div>
        <span className="text-xs bg-accent/15 text-accent px-2 py-1 rounded-lg font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>ОБЪЕКТ</span>
      </div>

      <div className="mx-4 mt-2 glass-card rounded-2xl p-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Объект</div>
            <div className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>{selectedObj?.name ?? "..."}</div>
            {selectedObj?.address && <div className="text-xs text-muted-foreground mt-0.5">{selectedObj.address}</div>}
          </div>
          <button onClick={() => setShowObjModal(true)} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-primary/15 transition-all border border-transparent hover:border-primary/30">
            <Icon name="Settings2" size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-3 animate-fade-in stagger-1">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Дата</div>
          <div className="text-lg font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>{fmtDate(now)}</div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize">{fmtDay(now)}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Время</div>
          <div className="text-lg font-bold text-accent tabular-nums" style={{ fontFamily: "Oswald, sans-serif" }}>{fmtTime(now)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Местное время</div>
        </div>
      </div>

      <div className="mx-4 mt-3 flex gap-2 animate-fade-in stagger-2">
        {(["checkin", "checkout"] as const).map((t) => (
          <button key={t} onClick={() => setScanType(t)}
            className={`flex-1 py-3.5 rounded-xl font-bold text-base transition-all ${
              scanType === t
                ? t === "checkin" ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" : "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20"
                : "bg-secondary text-muted-foreground"
            }`}
            style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t === "checkin" ? "Приход" : "Уход"}
          </button>
        ))}
      </div>

      <div className="mx-4 mt-4 mb-6 animate-fade-in stagger-3">
        {scanActive && scanState === "idle" ? (
          <div className="glass-card rounded-2xl overflow-hidden">
            <QRScanner onScan={handleQR} active={scanActive} />
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Направьте камеру на QR-код работника</span>
              <button onClick={() => setScanActive(false)} className="text-xs text-destructive">Отмена</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { if (scanState === "idle" || scanState === "error") { setScanState("idle"); setScanActive(true); } }}
            disabled={scanState === "scanning"}
            className={`w-full rounded-3xl flex flex-col items-center justify-center gap-5 py-10 border-2 border-dashed transition-all duration-300 ${
              scanState === "scanning" ? "border-primary/50 bg-primary/5"
              : scanState === "success" ? "border-accent/50 bg-accent/5"
              : scanState === "error" ? "border-destructive/50 bg-destructive/5"
              : "border-border hover:border-primary/40 bg-secondary/20 active:scale-[0.98]"
            }`}>
            {scanState === "idle" && (<>
              <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center pulse-ring">
                <Icon name="QrCode" size={48} className="text-primary" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>СКАНИРОВАТЬ QR</div>
                <div className="text-sm text-muted-foreground mt-1">Нажмите — откроется камера</div>
              </div>
            </>)}
            {scanState === "scanning" && (<>
              <div className="w-24 h-24 rounded-3xl bg-primary/15 flex items-center justify-center">
                <Icon name="Loader2" size={48} className="text-primary animate-spin" />
              </div>
              <div className="text-primary font-bold text-xl" style={{ fontFamily: "Oswald, sans-serif" }}>ОТПРАВКА...</div>
            </>)}
            {scanState === "success" && lastResult && (<>
              <div className="w-24 h-24 rounded-3xl bg-accent/15 flex items-center justify-center animate-scale-in">
                <Icon name="CheckCircle2" size={48} className="text-accent" />
              </div>
              <div className="text-center animate-fade-in">
                <div className="text-2xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>{scanType === "checkin" ? "ПРИХОД ЗАПИСАН" : "УХОД ЗАПИСАН"}</div>
                <div className="text-lg font-semibold text-foreground mt-1">{lastResult.name}</div>
                <div className="text-sm text-muted-foreground">{lastResult.position}</div>
                <div className="text-sm text-muted-foreground">{selectedObj?.name} · {lastResult.time}</div>
              </div>
            </>)}
            {scanState === "error" && (<>
              <div className="w-24 h-24 rounded-3xl bg-destructive/15 flex items-center justify-center animate-scale-in">
                <Icon name="XCircle" size={48} className="text-destructive" />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-destructive" style={{ fontFamily: "Oswald, sans-serif" }}>ОШИБКА</div>
                <div className="text-sm text-muted-foreground mt-1">{errorMsg}</div>
                <div className="text-xs text-muted-foreground mt-1">Нажмите для повтора</div>
              </div>
            </>)}
          </button>
        )}
      </div>

      {showObjModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) closeObjModal(); }}>
          <div className="w-full max-w-sm mx-auto glass-card rounded-3xl p-6 animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>НАСТРОЙКА ОБЪЕКТА</h3>
              <button onClick={closeObjModal} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <Icon name="X" size={16} className="text-muted-foreground" />
              </button>
            </div>
            {!pwOk ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Введите пароль для изменения</p>
                <input type="password" value={pwInput} onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handlePwSubmit()} placeholder="Пароль"
                  className={`w-full bg-secondary border rounded-xl px-4 py-3 text-lg text-center tracking-widest outline-none transition-colors ${pwError ? "border-destructive" : "border-border focus:border-primary"}`} />
                {pwError && <p className="text-xs text-destructive text-center">Неверный пароль</p>}
                <button onClick={handlePwSubmit} className="btn-primary w-full py-3.5 rounded-xl">ВОЙТИ</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Выберите объект</p>
                  <div className="space-y-2">
                    {objects.map((obj, i) => (
                      <button key={obj.id} onClick={() => { setSelIdx(i); setNewName(obj.name); }}
                        className={`w-full p-3 rounded-xl text-sm text-left transition-all ${selIdx === i ? "bg-primary/15 border border-primary/40" : "bg-secondary text-muted-foreground"}`}>
                        {obj.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Новое наименование</p>
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { if (objects[selIdx]) { setSelectedObj(objects[selIdx]); closeObjModal(); } }}
                    className="py-3 rounded-xl bg-secondary text-sm font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>ВЫБРАТЬ</button>
                  <button onClick={handleRename} disabled={saving} className="btn-primary py-3 rounded-xl text-sm">
                    {saving ? "..." : "СОХРАНИТЬ"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  WINDOWS APP
// ═══════════════════════════════════════════
function WindowsApp() {
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

// ═══════════════════════════════════════════
//  ROOT: выбор режима
// ═══════════════════════════════════════════
export default function Index() {
  const [mode, setMode] = useState<AppMode>("choose");

  if (mode === "android") return (
    <div>
      <button onClick={() => setMode("choose")}
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/80 border border-border px-3 py-2 rounded-xl hover:text-foreground transition-colors backdrop-blur-sm">
        <Icon name="ArrowLeft" size={14} />Режимы
      </button>
      <AndroidApp />
    </div>
  );

  if (mode === "windows") return (
    <div>
      <button onClick={() => setMode("choose")}
        className="fixed top-4 right-6 z-50 flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/80 border border-border px-3 py-2 rounded-xl hover:text-foreground transition-colors backdrop-blur-sm">
        <Icon name="ArrowLeft" size={14} />Режимы
      </button>
      <WindowsApp />
    </div>
  );

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 border border-primary/30 mb-5">
            <Icon name="HardHat" size={40} className="text-primary" />
          </div>
          <h1 className="text-5xl font-bold tracking-wider mb-2" style={{ fontFamily: "Oswald, sans-serif" }}>ТАБЕЛЬПРО</h1>
          <p className="text-muted-foreground">Выберите режим работы</p>
        </div>
        <div className="space-y-4">
          <button onClick={() => setMode("android")}
            className="w-full glass-card rounded-3xl p-6 flex items-center gap-5 hover:border-accent/50 transition-all duration-200 group animate-fade-in stagger-1">
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
              <Icon name="Smartphone" size={30} className="text-accent" />
            </div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>ANDROID · ПЛАНШЕТ НА ОБЪЕКТЕ</div>
              <div className="text-sm text-muted-foreground mt-1">Сканирование QR · Фиксация прихода и ухода</div>
              <div className="text-xs text-muted-foreground/60 mt-1">Данные отправляются на сервер в реальном времени</div>
            </div>
            <Icon name="ChevronRight" size={22} className="text-muted-foreground group-hover:text-accent transition-colors" />
          </button>
          <button onClick={() => setMode("windows")}
            className="w-full glass-card rounded-3xl p-6 flex items-center gap-5 hover:border-primary/50 transition-all duration-200 group animate-fade-in stagger-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <Icon name="Monitor" size={30} className="text-primary" />
            </div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>WINDOWS · ПАНЕЛЬ УПРАВЛЕНИЯ</div>
              <div className="text-sm text-muted-foreground mt-1">Работники · Генерация QR · История · Статистика</div>
              <div className="text-xs text-muted-foreground/60 mt-1">Получает данные со всех объектов через интернет</div>
            </div>
            <Icon name="ChevronRight" size={22} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
