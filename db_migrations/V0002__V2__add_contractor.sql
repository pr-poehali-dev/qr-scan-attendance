ALTER TABLE t_p46198453_qr_scan_attendance.workers
  ADD COLUMN IF NOT EXISTS contractor TEXT NOT NULL DEFAULT '';

ALTER TABLE t_p46198453_qr_scan_attendance.attendance_records
  ADD COLUMN IF NOT EXISTS contractor TEXT NOT NULL DEFAULT '';
