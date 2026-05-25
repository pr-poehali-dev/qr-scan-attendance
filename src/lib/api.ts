const BASE = "https://functions.poehali.dev/8a2c667d-3c58-41d2-adc8-7f514abc1794";

async function req<T>(qs: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}?${qs}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка сервера");
  return data as T;
}

export interface Worker {
  id: number;
  name: string;
  position: string;
  contractor: string;
  qr_code: string;
  created_at: string;
}

export interface ObjectItem {
  id: number;
  name: string;
  address: string;
  is_active: boolean;
  work_start: string;
  work_end: string;
}

export interface AttendanceRecord {
  id: number;
  worker_name: string;
  worker_position: string;
  contractor: string;
  object_name: string;
  scan_type: "checkin" | "checkout";
  scanned_at: string;
}

export interface Stats {
  on_site: number;
  checked_in_today: number;
  checked_out_today: number;
  total_registered: number;
}

export interface ScanResult {
  id: number;
  worker_name: string;
  worker_position: string;
  contractor: string;
  object_name: string;
  scan_type: string;
  scanned_at: string;
}

export interface ContractorStat {
  name: string;
  present: number;
  late: number;
  early_leave: number;
}

export interface ObjectDashboard {
  id: number;
  name: string;
  work_start: string;
  work_end: string;
  total: number;
  contractors: ContractorStat[];
}

export interface DashboardData {
  objects: ObjectDashboard[];
  contractors: ContractorStat[];
  total_present: number;
  total_late: number;
  total_early_leave: number;
}

export interface TabletStatus {
  object_id: number;
  object_name: string;
  last_seen: string | null;
  seconds_ago: number | null;
  online: boolean;
}

export const api = {
  getWorkers: () =>
    req<Worker[]>("action=workers"),

  addWorker: (name: string, position: string, contractor: string) =>
    req<Worker>("action=workers", {
      method: "POST",
      body: JSON.stringify({ name, position, contractor }),
    }),

  deleteWorker: (id: number) =>
    req<{ ok: boolean }>(`action=workers&id=${id}`, { method: "DELETE" }),

  getObjects: () =>
    req<ObjectItem[]>("action=objects"),

  updateObject: (id: number, payload: { name?: string; password: string; work_start?: string; work_end?: string }) =>
    req<{ ok: boolean; name: string }>(`action=objects&id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  scan: (qr_code: string, object_id: number, scan_type: "checkin" | "checkout") =>
    req<ScanResult>("action=scan", {
      method: "POST",
      body: JSON.stringify({ qr_code, object_id, scan_type }),
    }),

  getRecords: (params?: { date?: string; object_id?: number; limit?: number }) => {
    const qs = new URLSearchParams({ action: "records" });
    if (params?.date) qs.set("date", params.date);
    if (params?.object_id) qs.set("object_id", String(params.object_id));
    if (params?.limit) qs.set("limit", String(params.limit));
    return req<AttendanceRecord[]>(qs.toString());
  },

  getStats: () =>
    req<Stats>("action=stats"),

  getDashboard: () =>
    req<DashboardData>("action=dashboard"),

  sendHeartbeat: (object_id: number) =>
    req<{ ok: boolean }>("action=heartbeat", {
      method: "POST",
      body: JSON.stringify({ object_id }),
    }),

  getHeartbeats: () =>
    req<TabletStatus[]>("action=heartbeat"),
};
