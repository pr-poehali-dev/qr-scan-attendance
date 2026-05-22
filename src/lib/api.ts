const BASE = "https://functions.poehali.dev/8a2c667d-3c58-41d2-adc8-7f514abc1794";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
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
}

export interface ObjectDashboard {
  id: number;
  name: string;
  total: number;
  contractors: ContractorStat[];
}

export interface DashboardData {
  objects: ObjectDashboard[];
  contractors: ContractorStat[];
  total_present: number;
  total_late: number;
  late_threshold: string;
}

export const api = {
  getWorkers: () => req<Worker[]>("/workers"),
  addWorker: (name: string, position: string, contractor: string) =>
    req<Worker>("/workers", { method: "POST", body: JSON.stringify({ name, position, contractor }) }),
  deleteWorker: (id: number) =>
    req<{ ok: boolean }>(`/workers/${id}`, { method: "DELETE" }),

  getObjects: () => req<ObjectItem[]>("/objects"),
  renameObject: (id: number, name: string, password: string) =>
    req<{ ok: boolean; name: string }>(`/objects/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, password }),
    }),

  scan: (qr_code: string, object_id: number, scan_type: "checkin" | "checkout") =>
    req<ScanResult>("/scan", {
      method: "POST",
      body: JSON.stringify({ qr_code, object_id, scan_type }),
    }),

  getRecords: (params?: { date?: string; object_id?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set("date", params.date);
    if (params?.object_id) qs.set("object_id", String(params.object_id));
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return req<AttendanceRecord[]>(`/records${q ? "?" + q : ""}`);
  },

  getStats: () => req<Stats>("/stats"),

  getDashboard: (lateAfter = "08:00") =>
    req<DashboardData>(`/dashboard?late_after=${lateAfter}`),
};
