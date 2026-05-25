/**
 * Офлайн-очередь сканирований для планшета.
 * Хранит неотправленные записи в localStorage.
 * При появлении сети автоматически отправляет их на сервер.
 */
import { api, ScanResult } from "./api";

const QUEUE_KEY = "tpro_scan_queue";

export interface QueuedScan {
  localId: string;          // уникальный локальный ID
  qr_code: string;
  object_id: number;
  object_name: string;
  scan_type: "checkin" | "checkout";
  scanned_at: string;       // ISO-строка момента сканирования
  attempts: number;         // кол-во попыток отправки
}

export interface QueueState {
  pending: QueuedScan[];    // ожидают отправки
  count: number;
}

// ── Чтение/запись из localStorage ──
function readQueue(): QueuedScan[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedScan[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

// ── Добавить запись в очередь ──
export function enqueue(scan: Omit<QueuedScan, "localId" | "attempts">): QueuedScan {
  const item: QueuedScan = {
    ...scan,
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    attempts: 0,
  };
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
  return item;
}

// ── Удалить успешно отправленную запись ──
function dequeue(localId: string): void {
  const queue = readQueue().filter(i => i.localId !== localId);
  writeQueue(queue);
}

// ── Увеличить счётчик попыток ──
function incrementAttempts(localId: string): void {
  const queue = readQueue().map(i =>
    i.localId === localId ? { ...i, attempts: i.attempts + 1 } : i
  );
  writeQueue(queue);
}

export function getQueueCount(): number {
  return readQueue().length;
}

export function getQueue(): QueuedScan[] {
  return readQueue();
}

// ── Попытка отправить одну запись ──
async function sendOne(item: QueuedScan): Promise<ScanResult> {
  return api.scan(item.qr_code, item.object_id, item.scan_type);
}

// ── Отправить всю очередь ──
// Возвращает { sent, failed }
export async function flushQueue(
  onProgress?: (sent: number, total: number) => void
): Promise<{ sent: number; failed: number }> {
  const queue = readQueue();
  if (!queue.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await sendOne(item);
      dequeue(item.localId);
      sent++;
      onProgress?.(sent, queue.length);
    } catch {
      incrementAttempts(item.localId);
      failed++;
    }
  }

  return { sent, failed };
}

// ── Singleton: фоновый flush при появлении сети ──
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _onlineHandler: (() => void) | null = null;

export function startQueueDaemon(
  onQueueChange: (count: number) => void,
  onFlushResult?: (sent: number) => void
) {
  // Сразу пробуем при старте
  const tryFlush = async () => {
    if (!navigator.onLine) return;
    const { sent } = await flushQueue();
    if (sent > 0) {
      onQueueChange(getQueueCount());
      onFlushResult?.(sent);
    }
  };

  // При появлении сети
  _onlineHandler = () => { tryFlush(); };
  window.addEventListener("online", _onlineHandler);

  // Периодически каждые 30 сек (на случай если событие online не пришло)
  _flushTimer = setInterval(() => { tryFlush(); }, 30_000);

  // Сразу попробуем
  tryFlush();

  return () => {
    if (_onlineHandler) window.removeEventListener("online", _onlineHandler);
    if (_flushTimer) clearInterval(_flushTimer);
  };
}
