CREATE TABLE IF NOT EXISTS t_p46198453_qr_scan_attendance.tablet_heartbeat (
  object_id   INTEGER PRIMARY KEY REFERENCES t_p46198453_qr_scan_attendance.objects(id),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
