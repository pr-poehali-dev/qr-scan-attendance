import { useState } from "react";
import Icon from "@/components/ui/icon";
import AndroidApp from "@/components/android/AndroidApp";
import WindowsApp from "@/components/windows/WindowsApp";

type AppMode = "choose" | "android" | "windows";

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
