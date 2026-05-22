import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { api, ObjectItem } from "@/lib/api";
import { useNow, fmtDate, fmtTime, fmtDay, fmtScanned } from "@/lib/utils-time";

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

export default function AndroidApp() {
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
