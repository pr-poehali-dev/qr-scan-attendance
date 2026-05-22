import { useState } from "react";
import Icon from "@/components/ui/icon";

type IconName = Parameters<typeof Icon>[0]["name"];

type Role = "admin" | "foreman" | "worker";
type Tab = "scan" | "history" | "objects" | "stats" | "reports" | "settings";

interface Worker {
  id: string;
  name: string;
  role: string;
  checkinTime: string;
  checkoutTime?: string;
  object: string;
  date: string;
  status: "present" | "left" | "absent";
}

const MOCK_WORKERS: Worker[] = [
  { id: "1", name: "Иванов А.С.", role: "Монтажник", checkinTime: "07:42", object: "ЖК Северный", date: "22.05.2026", status: "present" },
  { id: "2", name: "Петров В.Н.", role: "Сварщик", checkinTime: "07:55", checkoutTime: "16:30", object: "ЖК Северный", date: "22.05.2026", status: "left" },
  { id: "3", name: "Сидоров К.Р.", role: "Электрик", checkinTime: "08:10", object: "ТЦ Галактика", date: "22.05.2026", status: "present" },
  { id: "4", name: "Козлов Д.М.", role: "Плотник", checkinTime: "08:00", checkoutTime: "17:00", object: "ЖК Северный", date: "21.05.2026", status: "left" },
  { id: "5", name: "Новиков П.В.", role: "Бетонщик", checkinTime: "07:30", object: "Склад №3", date: "22.05.2026", status: "present" },
];

const OBJECTS = ["ЖК Северный", "ТЦ Галактика", "Склад №3", "БЦ Меридиан"];

const STATS = [
  { label: "На объектах", value: "23", icon: "Users", color: "text-accent" },
  { label: "Явка сегодня", value: "31", icon: "UserCheck", color: "text-primary" },
  { label: "Вышли", value: "8", icon: "UserMinus", color: "text-muted-foreground" },
  { label: "Часов отработано", value: "187", icon: "Clock", color: "text-blue-400" },
];

const roleConfig: Record<Role, { label: string; color: string; tabs: Tab[] }> = {
  admin: {
    label: "Администратор",
    color: "text-primary",
    tabs: ["scan", "history", "objects", "stats", "reports", "settings"],
  },
  foreman: {
    label: "Бригадир",
    color: "text-accent",
    tabs: ["scan", "history", "objects", "stats"],
  },
  worker: {
    label: "Работник",
    color: "text-blue-400",
    tabs: ["scan", "history"],
  },
};

const tabMeta: Record<Tab, { label: string; icon: string }> = {
  scan: { label: "Сканер", icon: "QrCode" },
  history: { label: "История", icon: "ClipboardList" },
  objects: { label: "Объекты", icon: "Building2" },
  stats: { label: "Статистика", icon: "BarChart3" },
  reports: { label: "Отчёты", icon: "FileText" },
  settings: { label: "Настройки", icon: "Settings2" },
};

export default function Index() {
  const [role, setRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const [scanState, setScanState] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [selectedObject, setSelectedObject] = useState("ЖК Северный");
  const [scanType, setScanType] = useState<"checkin" | "checkout">("checkin");
  const [scannedName, setScannedName] = useState("");

  const handleScan = () => {
    setScanState("scanning");
    setTimeout(() => {
      const names = ["Михайлов Р.А.", "Захаров И.П.", "Воронов С.Е."];
      setScannedName(names[Math.floor(Math.random() * names.length)]);
      setScanState("success");
      setTimeout(() => setScanState("idle"), 3000);
    }, 1800);
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-background grid-bg flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
              <Icon name="HardHat" size={32} className="text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-wide text-foreground mb-1">ТАБЕЛЬПРО</h1>
            <p className="text-muted-foreground text-sm">Учёт рабочего времени на объектах</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4 text-center">Выберите роль входа</p>
            {(["admin", "foreman", "worker"] as Role[]).map((r, i) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl glass-card hover:border-primary/40 transition-all duration-200 group animate-fade-in stagger-${i + 1}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  r === "admin" ? "bg-primary/15" : r === "foreman" ? "bg-accent/15" : "bg-blue-400/15"
                }`}>
                  <Icon
                    name={r === "admin" ? "Shield" : r === "foreman" ? "HardHat" : "User"}
                    size={24}
                    className={roleConfig[r].color}
                  />
                </div>
                <div className="text-left flex-1">
                  <div className={`font-semibold text-lg ${roleConfig[r].color}`} style={{ fontFamily: 'Oswald, sans-serif' }}>
                    {roleConfig[r].label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {r === "admin" ? "Полный доступ ко всем разделам" : r === "foreman" ? "Управление бригадой и объектами" : "Отметка прихода и ухода"}
                  </div>
                </div>
                <Icon name="ChevronRight" size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tabs = roleConfig[role].tabs;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 glass-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Icon name="HardHat" size={16} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide" style={{ fontFamily: 'Oswald, sans-serif' }}>ТАБЕЛЬПРО</div>
            <div className={`text-xs status-badge ${roleConfig[role].color}`}>{roleConfig[role].label}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-muted-foreground">22 мая 2026</div>
            <div className="text-sm font-semibold text-foreground">{selectedObject}</div>
          </div>
          <button
            onClick={() => setRole(null)}
            className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/20 transition-colors"
          >
            <Icon name="LogOut" size={16} className="text-muted-foreground" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-24">
        {/* SCAN TAB */}
        {activeTab === "scan" && (
          <div className="p-4 space-y-4 animate-fade-in">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Текущий объект</p>
              <div className="grid grid-cols-2 gap-2">
                {OBJECTS.map((obj) => (
                  <button
                    key={obj}
                    onClick={() => setSelectedObject(obj)}
                    className={`p-3 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
                      selectedObject === obj
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                    }`}
                  >
                    {obj}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setScanType("checkin")}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                    scanType === "checkin"
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                  style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase' }}
                >
                  Приход
                </button>
                <button
                  onClick={() => setScanType("checkout")}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                    scanType === "checkout"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                  style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase' }}
                >
                  Уход
                </button>
              </div>

              <button
                onClick={handleScan}
                disabled={scanState === "scanning"}
                className={`w-full aspect-square max-h-64 rounded-2xl flex flex-col items-center justify-center gap-4 border-2 border-dashed transition-all duration-300 ${
                  scanState === "scanning"
                    ? "border-primary/60 bg-primary/5"
                    : scanState === "success"
                    ? "border-accent/60 bg-accent/5"
                    : "border-border hover:border-primary/50 bg-secondary/30 hover:bg-primary/5"
                }`}
              >
                {scanState === "idle" && (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center pulse-ring">
                      <Icon name="QrCode" size={40} className="text-primary" />
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>НАЖМИТЕ ДЛЯ СКАНИРОВАНИЯ</div>
                      <div className="text-xs text-muted-foreground mt-1">QR-код работника</div>
                    </div>
                  </>
                )}
                {scanState === "scanning" && (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center">
                      <Icon name="Scan" size={40} className="text-primary animate-pulse" />
                    </div>
                    <div className="text-primary font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>СКАНИРОВАНИЕ...</div>
                  </>
                )}
                {scanState === "success" && (
                  <>
                    <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center animate-scale-in">
                      <Icon name="CheckCircle" size={40} className="text-accent" />
                    </div>
                    <div className="text-center animate-fade-in">
                      <div className="text-accent font-bold text-lg" style={{ fontFamily: 'Oswald, sans-serif' }}>
                        {scanType === "checkin" ? "ПРИХОД ОТМЕЧЕН" : "УХОД ОТМЕЧЕН"}
                      </div>
                      <div className="text-foreground font-semibold mt-1">{scannedName}</div>
                      <div className="text-xs text-muted-foreground">{selectedObject} · {new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card rounded-2xl p-4 animate-fade-in stagger-1">
                <div className="text-2xl font-bold text-accent" style={{ fontFamily: 'Oswald, sans-serif' }}>18</div>
                <div className="text-xs text-muted-foreground mt-1">На объекте сейчас</div>
              </div>
              <div className="glass-card rounded-2xl p-4 animate-fade-in stagger-2">
                <div className="text-2xl font-bold text-primary" style={{ fontFamily: 'Oswald, sans-serif' }}>07:42</div>
                <div className="text-xs text-muted-foreground mt-1">Первый приход</div>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>ИСТОРИЯ ЗАПИСЕЙ</h2>
              <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">22 мая 2026</span>
            </div>
            {MOCK_WORKERS.map((w, i) => (
              <div key={w.id} className={`glass-card rounded-2xl p-4 animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    w.status === "present" ? "bg-accent/15" : "bg-secondary"
                  }`}>
                    <Icon
                      name={w.status === "present" ? "UserCheck" : "UserMinus"}
                      size={20}
                      className={w.status === "present" ? "text-accent" : "text-muted-foreground"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{w.name}</span>
                      <span className={`status-badge shrink-0 ${
                        w.status === "present" ? "text-accent" : "text-muted-foreground"
                      }`}>
                        {w.status === "present" ? "НА МЕСТЕ" : "УШЁЛ"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{w.role} · {w.object}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Icon name="LogIn" size={12} className="text-accent" />
                        <span className="text-foreground font-medium">{w.checkinTime}</span>
                      </div>
                      {w.checkoutTime && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Icon name="LogOut" size={12} className="text-muted-foreground" />
                          <span className="text-muted-foreground">{w.checkoutTime}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs">
                        <Icon name="Calendar" size={12} className="text-muted-foreground" />
                        <span className="text-muted-foreground">{w.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* OBJECTS TAB */}
        {activeTab === "objects" && (
          <div className="p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>ОБЪЕКТЫ РАБОТЫ</h2>
              {role === "admin" && (
                <button className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/30 px-3 py-2 rounded-xl hover:bg-primary/20 transition-colors">
                  <Icon name="Plus" size={14} />
                  Добавить
                </button>
              )}
            </div>
            {[
              { name: "ЖК Северный", workers: 18, address: "ул. Полярная, 12", status: "active", completion: 68 },
              { name: "ТЦ Галактика", workers: 7, address: "пр. Победы, 44", status: "active", completion: 34 },
              { name: "Склад №3", workers: 5, address: "ул. Промышленная, 8", status: "active", completion: 91 },
              { name: "БЦ Меридиан", workers: 0, address: "ул. Центральная, 1", status: "pause", completion: 12 },
            ].map((obj, i) => (
              <div key={obj.name} className={`glass-card rounded-2xl p-4 animate-fade-in stagger-${i + 1}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-bold text-base" style={{ fontFamily: 'Oswald, sans-serif' }}>{obj.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{obj.address}</div>
                  </div>
                  <span className={`status-badge px-2 py-1 rounded-lg ${
                    obj.status === "active" ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground"
                  }`}>
                    {obj.status === "active" ? "АКТИВЕН" : "ПАУЗА"}
                  </span>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Icon name="Users" size={14} className="text-primary" />
                    <span className="font-semibold text-primary">{obj.workers}</span>
                    <span className="text-muted-foreground text-xs">чел.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground text-xs">Готовность: <span className="text-foreground font-medium">{obj.completion}%</span></span>
                  </div>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${obj.completion}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === "stats" && (
          <div className="p-4 space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>СТАТИСТИКА</h2>
            <div className="grid grid-cols-2 gap-3">
              {STATS.map((s, i) => (
                <div key={s.label} className={`glass-card rounded-2xl p-4 animate-fade-in stagger-${i + 1}`}>
                  <Icon name={s.icon as IconName} size={22} className={s.color} />
                  <div className={`text-3xl font-bold mt-2 ${s.color}`} style={{ fontFamily: 'Oswald, sans-serif' }}>{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="glass-card rounded-2xl p-4">
              <div className="text-sm font-semibold mb-4" style={{ fontFamily: 'Oswald, sans-serif' }}>ТОП РАБОТНИКИ — МАЙ 2026</div>
              <div className="space-y-3">
                {[
                  { name: "Иванов А.С.", hours: 164, days: 21 },
                  { name: "Козлов Д.М.", hours: 152, days: 19 },
                  { name: "Петров В.Н.", hours: 144, days: 18 },
                  { name: "Новиков П.В.", hours: 138, days: 17 },
                ].map((w, i) => (
                  <div key={w.name} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                    }`} style={{ fontFamily: 'Oswald, sans-serif' }}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{w.name}</span>
                        <span className="text-xs text-primary font-semibold">{w.hours} ч</span>
                      </div>
                      <div className="h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${(w.hours / 164) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground w-12 text-right">{w.days} дн.</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <div className="p-4 space-y-3 animate-fade-in">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>ОТЧЁТЫ</h2>
            {[
              { title: "Явка за май 2026", desc: "31 работник · 21 рабочий день", icon: "CalendarCheck" },
              { title: "Переработки", desc: "7 случаев сверхурочных", icon: "AlarmClock" },
              { title: "Нарушения дисциплины", desc: "3 опоздания, 1 прогул", icon: "AlertTriangle" },
              { title: "Сводный отчёт по объектам", desc: "4 объекта · 2 недели", icon: "Building2" },
            ].map((r, i) => (
              <button key={r.title} className={`w-full glass-card rounded-2xl p-4 flex items-center gap-4 hover:border-primary/40 transition-all duration-200 group animate-fade-in stagger-${i + 1}`}>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name={r.icon as IconName} size={24} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                </div>
                <Icon name="Download" size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div className="p-4 space-y-4 animate-fade-in">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Oswald, sans-serif' }}>НАСТРОЙКИ</h2>
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Подключение</div>
              {[
                { label: "Адрес сервера", value: "api.tabelpr0.ru", icon: "Server" },
                { label: "База данных", value: "Подключено ✓", icon: "Database" },
                { label: "Синхронизация", value: "Авто · каждые 5 мин", icon: "RefreshCw" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <Icon name={s.icon as IconName} size={18} className="text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-sm font-medium mt-0.5">{s.value}</div>
                  </div>
                  <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
                </div>
              ))}
            </div>
            <div className="glass-card rounded-2xl p-4 space-y-4">
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Приложение</div>
              {[
                { label: "Версия", value: "1.0.0", icon: "Info" },
                { label: "Уведомления", value: "Включены", icon: "Bell" },
                { label: "Офлайн-режим", value: "Активен", icon: "WifiOff" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <Icon name={s.icon as IconName} size={18} className="text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-sm font-medium mt-0.5">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass-card border-t border-border px-2 py-2 z-10">
        <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all duration-200 ${
                activeTab === tab
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Icon name={tabMeta[tab].icon as IconName} size={22} />
              <span className="text-[10px] font-medium leading-none">{tabMeta[tab].label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}