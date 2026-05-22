import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

type IconName = Parameters<typeof Icon>[0]["name"];
type AppMode = "choose" | "android" | "windows";
type WinTab = "workers" | "history" | "stats" | "reports" | "settings";

interface Worker {
  id: string;
  name: string;
  position: string;
  qrData: string;
}

interface AttendanceRecord {
  id: string;
  workerId: string;
  workerName: string;
  type: "checkin" | "checkout";
  time: string;
  date: string;
  object: string;
}

const OBJECTS_DEFAULT = ["ЖК Северный", "ТЦ Галактика", "Склад №3", "БЦ Меридиан"];
const OBJECT_PASSWORD = "1234";

const MOCK_WORKERS: Worker[] = [
  { id: "w1", name: "Иванов Андрей Сергеевич", position: "Монтажник", qrData: "WORKER:w1" },
  { id: "w2", name: "Петров Василий Николаевич", position: "Сварщик", qrData: "WORKER:w2" },
  { id: "w3", name: "Сидоров Кирилл Романович", position: "Электрик", qrData: "WORKER:w3" },
  { id: "w4", name: "Козлов Дмитрий Михайлович", position: "Плотник", qrData: "WORKER:w4" },
  { id: "w5", name: "Новиков Павел Владимирович", position: "Бетонщик", qrData: "WORKER:w5" },
];

const MOCK_RECORDS: AttendanceRecord[] = [
  { id: "r1", workerId: "w1", workerName: "Иванов А.С.", type: "checkin", time: "07:42", date: "22.05.2026", object: "ЖК Северный" },
  { id: "r2", workerId: "w2", workerName: "Петров В.Н.", type: "checkin", time: "07:55", date: "22.05.2026", object: "ЖК Северный" },
  { id: "r3", workerId: "w2", workerName: "Петров В.Н.", type: "checkout", time: "16:30", date: "22.05.2026", object: "ЖК Северный" },
  { id: "r4", workerId: "w3", workerName: "Сидоров К.Р.", type: "checkin", time: "08:10", date: "22.05.2026", object: "ТЦ Галактика" },
  { id: "r5", workerId: "w4", workerName: "Козлов Д.М.", type: "checkin", time: "08:00", date: "21.05.2026", object: "ЖК Северный" },
  { id: "r6", workerId: "w4", workerName: "Козлов Д.М.", type: "checkout", time: "17:00", date: "21.05.2026", object: "ЖК Северный" },
];

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(d: Date) {
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function formatDay(d: Date) {
  return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

// Simple QR-like visual (pattern from worker id)
function QRVisual({ data, size = 120 }: { data: string; size?: number }) {
  const cells = 11;
  const hash = data.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if (r < 3 && c < 3) return true;
      if (r < 3 && c > cells - 4) return true;
      if (r > cells - 4 && c < 3) return true;
      const bit = (hash * (r + 1) * (c + 2) + r * 97 + c * 31) % 7;
      return bit < 3;
    })
  );
  const cell = size / cells;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell + 1}
              y={r * cell + 1}
              width={cell - 2}
              height={cell - 2}
              rx={1}
              fill="currentColor"
            />
          ) : null
        )
      )}
    </svg>
  );
}

// ─────────────── ANDROID APP ───────────────
function AndroidApp() {
  const now = useNow();
  const [object, setObject] = useState("ЖК Северный");
  const [objects, setObjects] = useState(OBJECTS_DEFAULT);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "success">("idle");
  const [scanType, setScanType] = useState<"checkin" | "checkout">("checkin");
  const [scannedName, setScannedName] = useState("");

  // Change object modal
  const [showObjModal, setShowObjModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [newObjName, setNewObjName] = useState("");
  const [selectedObjIndex, setSelectedObjIndex] = useState(0);

  const handleScan = () => {
    setScanState("scanning");
    const names = ["Иванов А.С.", "Козлов Д.М.", "Петров В.Н.", "Сидоров К.Р.", "Новиков П.В."];
    setTimeout(() => {
      setScannedName(names[Math.floor(Math.random() * names.length)]);
      setScanState("success");
      setTimeout(() => setScanState("idle"), 3500);
    }, 1600);
  };

  const handlePasswordSubmit = () => {
    if (pwInput === OBJECT_PASSWORD) {
      setPwOk(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPwInput("");
    }
  };

  const handleRenameObject = () => {
    if (!newObjName.trim()) return;
    const updated = [...objects];
    updated[selectedObjIndex] = newObjName.trim();
    setObjects(updated);
    if (object === objects[selectedObjIndex]) setObject(newObjName.trim());
    setShowObjModal(false);
    setPwOk(false);
    setPwInput("");
    setNewObjName("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-sm mx-auto relative">
      {/* Status bar area */}
      <div className="h-2 bg-background" />

      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Icon name="HardHat" size={14} className="text-primary" />
            </div>
            <span className="text-xs font-bold tracking-widest text-muted-foreground" style={{ fontFamily: "Oswald, sans-serif" }}>
              ТАБЕЛЬПРО
            </span>
          </div>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-lg">Android</span>
        </div>
      </div>

      {/* Object block */}
      <div className="mx-4 mt-2 glass-card rounded-2xl p-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Объект</div>
            <div className="text-2xl font-bold leading-tight" style={{ fontFamily: "Oswald, sans-serif" }}>
              {object}
            </div>
          </div>
          <button
            onClick={() => setShowObjModal(true)}
            className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-primary/15 hover:border-primary/30 border border-transparent transition-all"
          >
            <Icon name="Settings2" size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Date / Time block */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3 animate-fade-in stagger-1">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Дата</div>
          <div className="text-lg font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>
            {formatDate(now)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize">{formatDay(now)}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Время</div>
          <div className="text-lg font-bold text-accent tabular-nums" style={{ fontFamily: "Oswald, sans-serif" }}>
            {formatTime(now)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Местное время</div>
        </div>
      </div>

      {/* Scan type toggle */}
      <div className="mx-4 mt-3 flex gap-2 animate-fade-in stagger-2">
        <button
          onClick={() => setScanType("checkin")}
          className={`flex-1 py-3.5 rounded-xl font-bold text-base transition-all ${
            scanType === "checkin"
              ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
              : "bg-secondary text-muted-foreground"
          }`}
          style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          Приход
        </button>
        <button
          onClick={() => setScanType("checkout")}
          className={`flex-1 py-3.5 rounded-xl font-bold text-base transition-all ${
            scanType === "checkout"
              ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20"
              : "bg-secondary text-muted-foreground"
          }`}
          style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          Уход
        </button>
      </div>

      {/* BIG SCAN BUTTON */}
      <div className="mx-4 mt-4 animate-fade-in stagger-3">
        <button
          onClick={handleScan}
          disabled={scanState === "scanning"}
          className={`w-full rounded-3xl flex flex-col items-center justify-center gap-5 py-10 border-2 border-dashed transition-all duration-300 ${
            scanState === "scanning"
              ? "border-primary/50 bg-primary/5"
              : scanState === "success"
              ? "border-accent/50 bg-accent/5"
              : "border-border hover:border-primary/40 bg-secondary/20 active:scale-[0.98]"
          }`}
        >
          {scanState === "idle" && (
            <>
              <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center pulse-ring">
                <Icon name="QrCode" size={48} className="text-primary" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                  СКАНИРОВАТЬ QR
                </div>
                <div className="text-sm text-muted-foreground mt-1">Поднесите QR-код работника</div>
              </div>
            </>
          )}
          {scanState === "scanning" && (
            <>
              <div className="w-24 h-24 rounded-3xl bg-primary/15 flex items-center justify-center">
                <Icon name="Scan" size={48} className="text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>
                  СЧИТЫВАЕМ...
                </div>
                <div className="text-sm text-muted-foreground mt-1">Не убирайте код</div>
              </div>
            </>
          )}
          {scanState === "success" && (
            <>
              <div className="w-24 h-24 rounded-3xl bg-accent/15 flex items-center justify-center animate-scale-in">
                <Icon name="CheckCircle2" size={48} className="text-accent" />
              </div>
              <div className="text-center animate-fade-in">
                <div className="text-2xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>
                  {scanType === "checkin" ? "ПРИХОД ЗАПИСАН" : "УХОД ЗАПИСАН"}
                </div>
                <div className="text-lg font-semibold text-foreground mt-1">{scannedName}</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {object} · {formatTime(now)}
                </div>
              </div>
            </>
          )}
        </button>
      </div>

      {/* Modal: change object */}
      {showObjModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowObjModal(false); setPwOk(false); setPwInput(""); setPwError(false); } }}>
          <div className="w-full max-w-sm mx-auto glass-card rounded-3xl p-6 animate-fade-in space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>СМЕНИТЬ ОБЪЕКТ</h3>
              <button onClick={() => { setShowObjModal(false); setPwOk(false); setPwInput(""); setPwError(false); }} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                <Icon name="X" size={16} className="text-muted-foreground" />
              </button>
            </div>

            {!pwOk ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Введите пароль для изменения наименования объекта</p>
                <input
                  type="password"
                  value={pwInput}
                  onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                  placeholder="Пароль"
                  className={`w-full bg-secondary border rounded-xl px-4 py-3 text-lg text-center tracking-widest outline-none transition-colors ${
                    pwError ? "border-destructive" : "border-border focus:border-primary"
                  }`}
                />
                {pwError && <p className="text-xs text-destructive text-center">Неверный пароль</p>}
                <button onClick={handlePasswordSubmit} className="btn-primary w-full py-3.5 rounded-xl">
                  ВОЙТИ
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Выберите объект для переименования</p>
                  <div className="grid grid-cols-1 gap-2">
                    {objects.map((obj, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedObjIndex(i); setNewObjName(obj); }}
                        className={`p-3 rounded-xl text-sm text-left transition-all ${
                          selectedObjIndex === i
                            ? "bg-primary/15 border border-primary/40 text-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                        }`}
                      >
                        {obj}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Новое наименование</p>
                  <input
                    type="text"
                    value={newObjName}
                    onChange={(e) => setNewObjName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRenameObject()}
                    placeholder="Введите наименование"
                    className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setObject(objects[selectedObjIndex]); setShowObjModal(false); setPwOk(false); }}
                    className="py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold"
                    style={{ fontFamily: "Oswald, sans-serif" }}
                  >
                    ВЫБРАТЬ
                  </button>
                  <button onClick={handleRenameObject} className="btn-primary py-3 rounded-xl text-sm">
                    СОХРАНИТЬ
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

// ─────────────── WINDOWS APP ───────────────
function WindowsApp() {
  const [activeTab, setActiveTab] = useState<WinTab>("workers");
  const [workers, setWorkers] = useState<Worker[]>(MOCK_WORKERS);
  const [records] = useState<AttendanceRecord[]>(MOCK_RECORDS);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [printWorker, setPrintWorker] = useState<Worker | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleAddWorker = () => {
    if (!newName.trim()) return;
    const w: Worker = {
      id: `w${Date.now()}`,
      name: newName.trim(),
      position: newPosition.trim() || "Работник",
      qrData: `WORKER:w${Date.now()}`,
    };
    setWorkers((prev) => [...prev, w]);
    setNewName("");
    setNewPosition("");
    setShowAddWorker(false);
    setSelectedWorker(w);
  };

  const handlePrint = (w: Worker) => {
    setPrintWorker(w);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintWorker(null), 500);
    }, 150);
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
      {/* Print area (hidden except during print) */}
      {printWorker && (
        <div
          ref={printRef}
          className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[999] print-only"
          style={{ display: "none" }}
        >
          <div style={{ fontFamily: "sans-serif", textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 14, color: "#666", marginBottom: 8, letterSpacing: 2, textTransform: "uppercase" }}>
              ТАБЕЛЬПРО · Пропуск работника
            </div>
            <div style={{ color: "#111", marginBottom: 16 }}>
              <QRVisual data={printWorker.qrData} size={180} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111" }}>{printWorker.name}</div>
            <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>{printWorker.position}</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 12 }}>ID: {printWorker.id}</div>
          </div>
        </div>
      )}

      {/* Top header */}
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
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Icon name="Circle" size={8} className="text-accent fill-accent" />
            <span className="text-xs">Система активна</span>
          </div>
          <div className="text-xs">{new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 glass-card border-r border-border flex flex-col py-4 gap-1 px-2 shrink-0">
          {winTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === t.id
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon name={t.icon} size={18} />
              {t.label}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">

          {/* WORKERS TAB */}
          {activeTab === "workers" && (
            <div className="animate-fade-in space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>РАБОТНИКИ</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Список · QR-коды · Печать</p>
                </div>
                <button
                  onClick={() => setShowAddWorker(true)}
                  className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl"
                >
                  <Icon name="UserPlus" size={18} />
                  Добавить работника
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Workers list */}
                <div className="col-span-2 space-y-2">
                  {workers.map((w, i) => (
                    <button
                      key={w.id}
                      onClick={() => setSelectedWorker(w)}
                      className={`w-full glass-card rounded-xl p-4 flex items-center gap-4 hover:border-primary/40 transition-all text-left animate-fade-in stagger-${Math.min(i + 1, 6)} ${
                        selectedWorker?.id === w.id ? "border-primary/40 bg-primary/5" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <Icon name="User" size={20} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{w.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{w.position}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePrint(w); }}
                          className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors"
                          title="Распечатать QR"
                        >
                          <Icon name="Printer" size={15} className="text-muted-foreground" />
                        </button>
                        <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>

                {/* QR Preview panel */}
                <div className="glass-card rounded-2xl p-5 flex flex-col items-center">
                  {selectedWorker ? (
                    <>
                      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-4">QR-код работника</div>
                      <div className="w-36 h-36 rounded-2xl bg-white flex items-center justify-center text-gray-900 mb-4">
                        <QRVisual data={selectedWorker.qrData} size={128} />
                      </div>
                      <div className="text-center mb-4">
                        <div className="font-bold text-sm">{selectedWorker.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">{selectedWorker.position}</div>
                        <div className="text-xs text-muted-foreground mt-1">ID: {selectedWorker.id}</div>
                      </div>
                      <button
                        onClick={() => handlePrint(selectedWorker)}
                        className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2"
                      >
                        <Icon name="Printer" size={16} />
                        Распечатать
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                        <Icon name="QrCode" size={28} className="text-muted-foreground" />
                      </div>
                      <div className="text-sm text-muted-foreground">Выберите работника<br />для просмотра QR-кода</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Add worker modal */}
              {showAddWorker && (
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                  onClick={(e) => { if (e.target === e.currentTarget) setShowAddWorker(false); }}
                >
                  <div className="glass-card rounded-3xl p-6 w-full max-w-sm mx-4 animate-scale-in space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>НОВЫЙ РАБОТНИК</h3>
                      <button onClick={() => setShowAddWorker(false)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                        <Icon name="X" size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block">ФИО работника</label>
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddWorker()}
                          placeholder="Иванов Иван Иванович"
                          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block">Должность / Специальность</label>
                        <input
                          type="text"
                          value={newPosition}
                          onChange={(e) => setNewPosition(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddWorker()}
                          placeholder="Монтажник, Электрик..."
                          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button onClick={() => setShowAddWorker(false)} className="py-3 rounded-xl bg-secondary text-sm font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
                        ОТМЕНА
                      </button>
                      <button onClick={handleAddWorker} className="btn-primary py-3 rounded-xl text-sm">
                        ДОБАВИТЬ
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div className="animate-fade-in space-y-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>ИСТОРИЯ ЗАПИСЕЙ</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Все приходы и уходы</p>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground uppercase tracking-widest font-medium">Работник</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-widest font-medium">Тип</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-widest font-medium">Время</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-widest font-medium">Дата</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-widest font-medium">Объект</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={r.id} className={`border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
                        <td className="px-5 py-3.5 font-medium">{r.workerName}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                            r.type === "checkin"
                              ? "bg-accent/15 text-accent"
                              : "bg-secondary text-muted-foreground"
                          }`} style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                            <Icon name={r.type === "checkin" ? "LogIn" : "LogOut"} size={11} />
                            {r.type === "checkin" ? "ПРИХОД" : "УХОД"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-sm text-primary">{r.time}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{r.date}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{r.object}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STATS TAB */}
          {activeTab === "stats" && (
            <div className="animate-fade-in space-y-5">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>СТАТИСТИКА</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Май 2026</p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "На объектах", value: "23", icon: "Users" as IconName, color: "text-accent" },
                  { label: "Явка сегодня", value: "31", icon: "UserCheck" as IconName, color: "text-primary" },
                  { label: "Вышли", value: "8", icon: "UserMinus" as IconName, color: "text-muted-foreground" },
                  { label: "Часов отработано", value: "187", icon: "Clock" as IconName, color: "text-blue-400" },
                ].map((s, i) => (
                  <div key={s.label} className={`glass-card rounded-2xl p-5 animate-fade-in stagger-${i + 1}`}>
                    <Icon name={s.icon} size={22} className={s.color} />
                    <div className={`text-3xl font-bold mt-3 ${s.color}`} style={{ fontFamily: "Oswald, sans-serif" }}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="glass-card rounded-2xl p-5">
                <div className="font-bold mb-5" style={{ fontFamily: "Oswald, sans-serif" }}>ТОП — ЧАСЫ ЗА МАЙ</div>
                <div className="space-y-4">
                  {[
                    { name: "Иванов А.С.", hours: 164, days: 21 },
                    { name: "Козлов Д.М.", hours: 152, days: 19 },
                    { name: "Петров В.Н.", hours: 144, days: 18 },
                    { name: "Новиков П.В.", hours: 138, days: 17 },
                    { name: "Сидоров К.Р.", hours: 130, days: 16 },
                  ].map((w, i) => (
                    <div key={w.name} className="flex items-center gap-4">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`} style={{ fontFamily: "Oswald, sans-serif" }}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{w.name}</span>
                          <span className="text-sm font-bold text-primary">{w.hours} ч · {w.days} дн.</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${(w.hours / 164) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === "reports" && (
            <div className="animate-fade-in space-y-4">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>ОТЧЁТЫ ПО ЯВКАМ</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Скачать или распечатать</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { title: "Явка за май 2026", desc: "31 работник · 21 рабочий день · все объекты", icon: "CalendarCheck" as IconName },
                  { title: "Переработки", desc: "7 случаев сверхурочных · 42 часа сверх нормы", icon: "AlarmClock" as IconName },
                  { title: "Нарушения дисциплины", desc: "3 опоздания · 1 прогул · ЖК Северный", icon: "AlertTriangle" as IconName },
                  { title: "Сводный по объектам", desc: "4 объекта · 2 недели · детализация по дням", icon: "Building2" as IconName },
                  { title: "Рабочие часы", desc: "Итоговая таблица по работникам за период", icon: "Clock" as IconName },
                  { title: "Экспорт в Excel", desc: "Все данные за выбранный период", icon: "Sheet" as IconName },
                ].map((r, i) => (
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

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="animate-fade-in space-y-5 max-w-xl">
              <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>НАСТРОЙКИ</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Подключение и синхронизация</p>
              </div>
              {[
                {
                  title: "Подключение",
                  items: [
                    { label: "Адрес сервера", value: "api.tabelpr0.ru", icon: "Server" as IconName },
                    { label: "Порт", value: "8443", icon: "Network" as IconName },
                    { label: "База данных", value: "Подключено ✓", icon: "Database" as IconName },
                  ],
                },
                {
                  title: "Синхронизация",
                  items: [
                    { label: "Режим синхронизации", value: "Авто · каждые 5 минут", icon: "RefreshCw" as IconName },
                    { label: "Последняя синхронизация", value: "22.05.2026 в 14:37", icon: "Clock" as IconName },
                    { label: "Офлайн-буфер", value: "Включён · до 500 записей", icon: "WifiOff" as IconName },
                  ],
                },
                {
                  title: "Безопасность",
                  items: [
                    { label: "Пароль на смену объекта", value: "•••• (установлен)", icon: "Lock" as IconName },
                    { label: "Версия приложения", value: "1.0.0", icon: "Info" as IconName },
                  ],
                },
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
                        <button className="text-xs text-primary hover:underline">Изменить</button>
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
          body > #root > * { display: none !important; }
          .print-only { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

// ─────────────── MODE CHOOSER ───────────────
export default function Index() {
  const [mode, setMode] = useState<AppMode>("choose");

  if (mode === "android") return (
    <div>
      <button
        onClick={() => setMode("choose")}
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/80 border border-border px-3 py-2 rounded-xl hover:text-foreground transition-colors backdrop-blur-sm"
      >
        <Icon name="ArrowLeft" size={14} />
        Режимы
      </button>
      <AndroidApp />
    </div>
  );

  if (mode === "windows") return (
    <div>
      <button
        onClick={() => setMode("choose")}
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/80 border border-border px-3 py-2 rounded-xl hover:text-foreground transition-colors backdrop-blur-sm"
      >
        <Icon name="ArrowLeft" size={14} />
        Режимы
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
          <h1 className="text-5xl font-bold tracking-wider text-foreground mb-2">ТАБЕЛЬПРО</h1>
          <p className="text-muted-foreground">Выберите режим работы</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => setMode("android")}
            className="glass-card rounded-3xl p-6 flex items-center gap-5 hover:border-accent/50 transition-all duration-200 group animate-fade-in stagger-1"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
              <Icon name="Smartphone" size={30} className="text-accent" />
            </div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>ANDROID · НА ОБЪЕКТЕ</div>
              <div className="text-sm text-muted-foreground mt-1">Объект · Дата и время · QR-сканер · Приход/Уход</div>
              <div className="text-xs text-muted-foreground/60 mt-1.5">Для планшета или телефона на объекте</div>
            </div>
            <Icon name="ChevronRight" size={22} className="text-muted-foreground group-hover:text-accent transition-colors" />
          </button>

          <button
            onClick={() => setMode("windows")}
            className="glass-card rounded-3xl p-6 flex items-center gap-5 hover:border-primary/50 transition-all duration-200 group animate-fade-in stagger-2"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <Icon name="Monitor" size={30} className="text-primary" />
            </div>
            <div className="text-left flex-1">
              <div className="text-xl font-bold text-primary" style={{ fontFamily: "Oswald, sans-serif" }}>WINDOWS · УПРАВЛЕНИЕ</div>
              <div className="text-sm text-muted-foreground mt-1">Работники · QR-генерация · Печать · История · Отчёты</div>
              <div className="text-xs text-muted-foreground/60 mt-1.5">Для компьютера в офисе или прорабской</div>
            </div>
            <Icon name="ChevronRight" size={22} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
