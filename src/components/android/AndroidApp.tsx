import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { api, ObjectItem } from "@/lib/api";
import { useNow, fmtDate, fmtTime, fmtDay, fmtScanned } from "@/lib/utils-time";
import {
  enqueue, flushQueue, getQueueCount, getQueue,
  startQueueDaemon, QueuedScan,
} from "@/lib/offline-queue";

// ── QR Scanner ──
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

// ── Панель очереди (раскрывается по клику) ──
function QueuePanel({ queue, onFlush, flushing }: {
  queue: QueuedScan[];
  onFlush: () => void;
  flushing: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!queue.length) return null;

  return (
    <div className="mx-4 mt-3 animate-fade-in">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/40 hover:bg-yellow-400/15 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name="WifiOff" size={15} className="text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-400" style={{ fontFamily: "Oswald, sans-serif" }}>
            {queue.length} ЗАПИС{queue.length === 1 ? "Ь" : queue.length < 5 ? "И" : "ЕЙ"} В ОЧЕРЕДИ
          </span>
        </div>
        <div className="flex items-center gap-2">
          {navigator.onLine && (
            <button
              onClick={(e) => { e.stopPropagation(); onFlush(); }}
              disabled={flushing}
              className="text-xs bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-lg hover:bg-yellow-400/30 transition-colors flex items-center gap-1.5"
            >
              <Icon name="Send" size={11} className={flushing ? "animate-pulse" : ""} />
              {flushing ? "Отправка..." : "Отправить"}
            </button>
          )}
          <Icon name={open ? "ChevronUp" : "ChevronDown"} size={14} className="text-yellow-400" />
        </div>
      </button>

      {open && (
        <div className="mt-2 glass-card rounded-xl overflow-hidden border border-yellow-400/20 animate-fade-in">
          <div className="px-4 py-2 bg-yellow-400/5 border-b border-yellow-400/15">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Ожидают отправки</span>
          </div>
          <div className="divide-y divide-border/50 max-h-48 overflow-auto">
            {queue.map((item) => (
              <div key={item.localId} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  item.scan_type === "checkin"
                    ? "bg-accent/15 text-accent"
                    : "bg-destructive/15 text-destructive"
                }`} style={{ fontFamily: "Oswald, sans-serif" }}>
                  {item.scan_type === "checkin" ? "ПРИХОД" : "УХОД"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.object_name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(item.scanned_at).toLocaleString("ru-RU", {
                      day: "2-digit", month: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                    {item.attempts > 0 && ` · ${item.attempts} попыт.`}
                  </div>
                </div>
                <Icon name="Clock" size={13} className="text-yellow-400/60 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Основной компонент ──
export default function AndroidApp() {
  const now = useNow();
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [selectedObj, setSelectedObj] = useState<ObjectItem | null>(null);
  const [scanType, setScanType] = useState<"checkin" | "checkout">("checkin");
  const [scanActive, setScanActive] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "success" | "queued" | "error">("idle");
  const [lastResult, setLastResult] = useState<{ name?: string; position?: string; time: string; queued?: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Очередь
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Модалка объекта
  const [showObjModal, setShowObjModal] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [pwOk, setPwOk] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const justScanned = useRef(false);

  const refreshQueue = useCallback(() => {
    setQueue(getQueue());
  }, []);

  // Загрузка объектов
  useEffect(() => {
    api.getObjects().then((data) => {
      setObjects(data);
      if (data.length) setSelectedObj(data[0]);
    }).catch(() => {
      // Офлайн — объекты не загрузились, используем кэш если есть
    });
  }, []);

  // Трекинг онлайн/офлайн
  useEffect(() => {
    const onOnline = () => { setIsOnline(true); };
    const onOffline = () => { setIsOnline(false); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Запуск фонового демона очереди
  useEffect(() => {
    refreshQueue();
    const stop = startQueueDaemon(
      () => refreshQueue(),
      (sent) => {
        refreshQueue();
        // Показываем уведомление об успешной отправке
        if (sent > 0) {
          setLastResult({ time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), queued: false });
          setScanState("success");
          setTimeout(() => setScanState("idle"), 3000);
        }
      }
    );
    return stop;
  }, [refreshQueue]);

  // Ручная отправка очереди
  const handleManualFlush = useCallback(async () => {
    setFlushing(true);
    await flushQueue();
    refreshQueue();
    setFlushing(false);
  }, [refreshQueue]);

  const handleQR = useCallback(async (code: string) => {
    if (justScanned.current || !selectedObj) return;
    justScanned.current = true;
    setScanActive(false);
    setScanState("scanning");

    const scannedAt = new Date().toISOString();

    if (!navigator.onLine) {
      // Офлайн — сразу в очередь
      enqueue({
        qr_code: code,
        object_id: selectedObj.id,
        object_name: selectedObj.name,
        scan_type: scanType,
        scanned_at: scannedAt,
      });
      refreshQueue();
      setLastResult({ time: fmtScanned(scannedAt), queued: true });
      setScanState("queued");
      setTimeout(() => { setScanState("idle"); justScanned.current = false; }, 4000);
      return;
    }

    // Онлайн — пробуем сразу
    try {
      const res = await api.scan(code, selectedObj.id, scanType);
      setLastResult({ name: res.worker_name, position: res.worker_position, time: fmtScanned(res.scanned_at), queued: false });
      setScanState("success");
    } catch {
      // Сервер недоступен — кладём в очередь
      enqueue({
        qr_code: code,
        object_id: selectedObj.id,
        object_name: selectedObj.name,
        scan_type: scanType,
        scanned_at: scannedAt,
      });
      refreshQueue();
      setLastResult({ time: fmtScanned(scannedAt), queued: true });
      setScanState("queued");
    }
    setTimeout(() => { setScanState("idle"); justScanned.current = false; }, 4000);
  }, [selectedObj, scanType, refreshQueue]);

  const handlePwSubmit = () => {
    if (pwInput === "1234") { setPwOk(true); setPwError(false); }
    else { setPwError(true); setPwInput(""); }
  };

  const handleRename = async () => {
    if (!newName.trim() || !objects[selIdx]) return;
    setSaving(true);
    try {
      await api.updateObject(objects[selIdx].id, { name: newName.trim(), password: "1234" });
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

      {/* Header */}
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Icon name="HardHat" size={14} className="text-primary" />
          </div>
          <span className="text-xs font-bold tracking-widest text-muted-foreground" style={{ fontFamily: "Oswald, sans-serif" }}>ТАБЕЛЬПРО</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Индикатор сети */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${isOnline ? "bg-accent/15 text-accent" : "bg-yellow-400/15 text-yellow-400"}`}>
            <Icon name={isOnline ? "Wifi" : "WifiOff"} size={11} />
            <span className="font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>{isOnline ? "ОНЛАЙН" : "ОФЛАЙН"}</span>
          </div>
          {getQueueCount() > 0 && (
            <div className="w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
              <span className="text-[10px] font-bold text-black">{getQueueCount()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Очередь */}
      <QueuePanel queue={queue} onFlush={handleManualFlush} flushing={flushing} />

      {/* Объект */}
      <div className="mx-4 mt-3 glass-card rounded-2xl p-4 animate-fade-in">
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

      {/* Дата / Время */}
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

      {/* Тип сканирования */}
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

      {/* Сканер */}
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
          <button
            onClick={() => { if (scanState === "idle" || scanState === "error") { setScanState("idle"); setScanActive(true); } }}
            disabled={scanState === "scanning"}
            className={`w-full rounded-3xl flex flex-col items-center justify-center gap-5 py-10 border-2 border-dashed transition-all duration-300 ${
              scanState === "scanning" ? "border-primary/50 bg-primary/5"
              : scanState === "success" ? "border-accent/50 bg-accent/5"
              : scanState === "queued" ? "border-yellow-400/50 bg-yellow-400/5"
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
              <div className="text-primary font-bold text-xl" style={{ fontFamily: "Oswald, sans-serif" }}>
                {isOnline ? "ОТПРАВКА..." : "СОХРАНЕНИЕ..."}
              </div>
            </>)}

            {scanState === "success" && lastResult && (<>
              <div className="w-24 h-24 rounded-3xl bg-accent/15 flex items-center justify-center animate-scale-in">
                <Icon name="CheckCircle2" size={48} className="text-accent" />
              </div>
              <div className="text-center animate-fade-in">
                <div className="text-2xl font-bold text-accent" style={{ fontFamily: "Oswald, sans-serif" }}>
                  {scanType === "checkin" ? "ПРИХОД ЗАПИСАН" : "УХОД ЗАПИСАН"}
                </div>
                {lastResult.name && <div className="text-lg font-semibold text-foreground mt-1">{lastResult.name}</div>}
                {lastResult.position && <div className="text-sm text-muted-foreground">{lastResult.position}</div>}
                <div className="text-sm text-muted-foreground">{selectedObj?.name} · {lastResult.time}</div>
              </div>
            </>)}

            {scanState === "queued" && lastResult && (<>
              <div className="w-24 h-24 rounded-3xl bg-yellow-400/15 flex items-center justify-center animate-scale-in">
                <Icon name="CloudOff" size={48} className="text-yellow-400" />
              </div>
              <div className="text-center animate-fade-in">
                <div className="text-2xl font-bold text-yellow-400" style={{ fontFamily: "Oswald, sans-serif" }}>
                  СОХРАНЕНО В ОЧЕРЕДИ
                </div>
                <div className="text-sm text-muted-foreground mt-1">Нет связи с сервером</div>
                <div className="text-sm text-muted-foreground">{selectedObj?.name} · {lastResult.time}</div>
                <div className="text-xs text-yellow-400/70 mt-1">Отправится автоматически при появлении сети</div>
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

      {/* Модалка объекта */}
      {showObjModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeObjModal(); }}>
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
