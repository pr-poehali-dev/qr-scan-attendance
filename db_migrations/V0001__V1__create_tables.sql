
CREATE TABLE IF NOT EXISTS t_p46198453_qr_scan_attendance.objects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '1234',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO t_p46198453_qr_scan_attendance.objects (name, address) VALUES
  ('ЖК Северный', 'ул. Полярная, 12'),
  ('ТЦ Галактика', 'пр. Победы, 44'),
  ('Склад №3', 'ул. Промышленная, 8');

CREATE TABLE IF NOT EXISTS t_p46198453_qr_scan_attendance.workers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT DEFAULT 'Работник',
  qr_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p46198453_qr_scan_attendance.attendance_records (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER REFERENCES t_p46198453_qr_scan_attendance.workers(id),
  worker_name TEXT NOT NULL,
  worker_position TEXT NOT NULL,
  object_id INTEGER REFERENCES t_p46198453_qr_scan_attendance.objects(id),
  object_name TEXT NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('checkin', 'checkout')),
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  qr_code TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_scanned_at ON t_p46198453_qr_scan_attendance.attendance_records(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_worker_id ON t_p46198453_qr_scan_attendance.attendance_records(worker_id);
