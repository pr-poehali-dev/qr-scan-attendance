"""
Главный API для системы учёта рабочего времени ТабельПро.
Роутинг через query-параметр: ?action=workers|objects|scan|records|stats|dashboard|heartbeat
"""
import json
import os
import uuid
import psycopg2
from datetime import timezone, timedelta

SCHEMA = "t_p46198453_qr_scan_attendance"
MSK = timezone(timedelta(hours=3))

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token",
    "Content-Type": "application/json",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data, status=200):
    return {"statusCode": status, "headers": CORS_HEADERS,
            "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, status=400):
    return {"statusCode": status, "headers": CORS_HEADERS,
            "body": json.dumps({"error": msg}, ensure_ascii=False)}


def to_hm(t):
    parts = str(t).split(":")
    return int(parts[0]), int(parts[1])


def handler(event: dict, context) -> dict:
    """Роутинг: ?action=<action>&id=<id>"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")
    row_id = params.get("id", "")

    # ════════════════════════════════
    #  WORKERS
    # ════════════════════════════════

    if action == "workers" and method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""SELECT id, name, position, contractor, qr_code, is_active, created_at
                        FROM {SCHEMA}.workers WHERE is_active = TRUE ORDER BY name""")
        rows = cur.fetchall()
        conn.close()
        return ok([{"id": r[0], "name": r[1], "position": r[2], "contractor": r[3],
                    "qr_code": r[4], "is_active": r[5], "created_at": str(r[6])} for r in rows])

    if action == "workers" and method == "POST":
        name = (body.get("name") or "").strip()
        position = (body.get("position") or "Работник").strip()
        contractor = (body.get("contractor") or "").strip()
        if not name:
            return err("Имя обязательно")
        qr_code = f"TPRO-{uuid.uuid4().hex[:12].upper()}"
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {SCHEMA}.workers (name, position, contractor, qr_code)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, position, contractor, qr_code, created_at""",
            (name, position, contractor, qr_code)
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"id": row[0], "name": row[1], "position": row[2], "contractor": row[3],
                   "qr_code": row[4], "created_at": str(row[5])}, 201)

    if action == "workers" and method == "DELETE":
        if not row_id:
            return err("id обязателен")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.workers SET is_active = FALSE WHERE id = %s", (row_id,))
        conn.commit()
        conn.close()
        return ok({"ok": True})

    # ════════════════════════════════
    #  OBJECTS
    # ════════════════════════════════

    if action == "objects" and method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id, name, address, is_active, work_start, work_end FROM {SCHEMA}.objects ORDER BY id")
        rows = cur.fetchall()
        conn.close()
        return ok([{"id": r[0], "name": r[1], "address": r[2], "is_active": r[3],
                    "work_start": r[4], "work_end": r[5]} for r in rows])

    if action == "objects" and method == "PUT":
        if not row_id:
            return err("id обязателен")
        new_name   = (body.get("name") or "").strip()
        password   = (body.get("password") or "")
        work_start = (body.get("work_start") or "").strip()
        work_end   = (body.get("work_end") or "").strip()

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT password_hash, name FROM {SCHEMA}.objects WHERE id = %s", (row_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return err("Объект не найден", 404)
        if row[0] != password:
            conn.close()
            return err("Неверный пароль", 403)

        update_name  = new_name   if new_name   else row[1]
        update_start = work_start if work_start else None
        update_end   = work_end   if work_end   else None

        if update_start and update_end:
            cur.execute(
                f"UPDATE {SCHEMA}.objects SET name=%s, work_start=%s, work_end=%s WHERE id=%s",
                (update_name, update_start, update_end, row_id))
        elif update_start:
            cur.execute(
                f"UPDATE {SCHEMA}.objects SET name=%s, work_start=%s WHERE id=%s",
                (update_name, update_start, row_id))
        elif update_end:
            cur.execute(
                f"UPDATE {SCHEMA}.objects SET name=%s, work_end=%s WHERE id=%s",
                (update_name, update_end, row_id))
        else:
            cur.execute(f"UPDATE {SCHEMA}.objects SET name=%s WHERE id=%s", (update_name, row_id))

        conn.commit()
        conn.close()
        return ok({"ok": True, "name": update_name})

    # ════════════════════════════════
    #  SCAN
    # ════════════════════════════════

    if action == "scan" and method == "POST":
        qr_code   = (body.get("qr_code") or "").strip()
        object_id = body.get("object_id")
        scan_type = body.get("scan_type", "checkin")
        if not qr_code or not object_id:
            return err("qr_code и object_id обязательны")
        if scan_type not in ("checkin", "checkout"):
            return err("scan_type должен быть checkin или checkout")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, name, position, contractor FROM {SCHEMA}.workers WHERE qr_code = %s AND is_active = TRUE",
            (qr_code,))
        worker = cur.fetchone()
        if not worker:
            conn.close()
            return err("Работник с таким QR не найден", 404)
        cur.execute(f"SELECT id, name FROM {SCHEMA}.objects WHERE id = %s", (object_id,))
        obj = cur.fetchone()
        if not obj:
            conn.close()
            return err("Объект не найден", 404)
        cur.execute(
            f"""INSERT INTO {SCHEMA}.attendance_records
                (worker_id, worker_name, worker_position, contractor, object_id, object_name, scan_type, qr_code)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, scanned_at""",
            (worker[0], worker[1], worker[2], worker[3], obj[0], obj[1], scan_type, qr_code))
        rec = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"id": rec[0], "worker_name": worker[1], "worker_position": worker[2],
                   "contractor": worker[3], "object_name": obj[1],
                   "scan_type": scan_type, "scanned_at": str(rec[1])})

    # ════════════════════════════════
    #  RECORDS
    # ════════════════════════════════

    if action == "records" and method == "GET":
        limit       = int(params.get("limit", 100))
        date_filter = params.get("date")
        object_id   = params.get("object_id")
        conn = get_conn()
        cur = conn.cursor()
        sql = f"""SELECT id, worker_name, worker_position, contractor, object_name, scan_type, scanned_at
                  FROM {SCHEMA}.attendance_records WHERE 1=1"""
        args = []
        if date_filter:
            sql += " AND DATE(scanned_at + interval '3 hours') = %s"
            args.append(date_filter)
        if object_id:
            sql += " AND object_id = %s"
            args.append(object_id)
        sql += " ORDER BY scanned_at DESC LIMIT %s"
        args.append(limit)
        cur.execute(sql, args)
        rows = cur.fetchall()
        conn.close()
        return ok([{"id": r[0], "worker_name": r[1], "worker_position": r[2],
                    "contractor": r[3], "object_name": r[4],
                    "scan_type": r[5], "scanned_at": str(r[6])} for r in rows])

    # ════════════════════════════════
    #  STATS
    # ════════════════════════════════

    if action == "stats" and method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            SELECT
                COUNT(DISTINCT CASE WHEN scan_type='checkin' THEN worker_id END),
                COUNT(DISTINCT CASE WHEN scan_type='checkout' THEN worker_id END)
            FROM {SCHEMA}.attendance_records
            WHERE DATE(scanned_at + interval '3 hours') = DATE(NOW() + interval '3 hours')
        """)
        row = cur.fetchone()
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.workers WHERE is_active = TRUE")
        total = cur.fetchone()[0]
        conn.close()
        on_site = (row[0] or 0) - (row[1] or 0)
        return ok({"on_site": max(on_site, 0), "checked_in_today": row[0] or 0,
                   "checked_out_today": row[1] or 0, "total_registered": total})

    # ════════════════════════════════
    #  DASHBOARD
    # ════════════════════════════════

    if action == "dashboard" and method == "GET":
        conn = get_conn()
        cur = conn.cursor()

        cur.execute(f"SELECT id, name, work_start, work_end FROM {SCHEMA}.objects WHERE is_active = TRUE ORDER BY id")
        objects_rows = cur.fetchall()
        obj_thresholds = {r[1]: {"id": r[0], "work_start": r[2], "work_end": r[3]} for r in objects_rows}

        cur.execute(f"""
            SELECT worker_id, worker_name, contractor, object_name, object_id,
                   MIN(scanned_at) AS first_checkin
            FROM {SCHEMA}.attendance_records
            WHERE scan_type = 'checkin'
              AND DATE(scanned_at + interval '3 hours') = DATE(NOW() + interval '3 hours')
            GROUP BY worker_id, worker_name, contractor, object_name, object_id
        """)
        checkins = cur.fetchall()

        cur.execute(f"""
            SELECT worker_id, object_name, MAX(scanned_at) AS last_checkout
            FROM {SCHEMA}.attendance_records
            WHERE scan_type = 'checkout'
              AND DATE(scanned_at + interval '3 hours') = DATE(NOW() + interval '3 hours')
            GROUP BY worker_id, object_name
        """)
        checkouts = {(r[0], r[1]): r[2] for r in cur.fetchall()}
        conn.close()

        objects_map = {r[1]: {"id": r[0], "name": r[1], "work_start": r[2], "work_end": r[3],
                               "total": 0, "contractors": {}} for r in objects_rows}
        contractors_global = {}
        total_present = total_late = total_early_leave = 0

        for worker_id, worker_name, contractor, object_name, object_id, first_checkin in checkins:
            cname = contractor if contractor else "Без подрядчика"
            thresh = obj_thresholds.get(object_name, {"work_start": "08:00", "work_end": "17:00"})

            local_ci = first_checkin.astimezone(MSK) if first_checkin.tzinfo else first_checkin
            late_h, late_m = to_hm(thresh["work_start"])
            is_late = (local_ci.hour, local_ci.minute) > (late_h, late_m)

            last_co = checkouts.get((worker_id, object_name))
            is_early_leave = False
            if last_co:
                local_co = last_co.astimezone(MSK) if last_co.tzinfo else last_co
                end_h, end_m = to_hm(thresh["work_end"])
                is_early_leave = (local_co.hour, local_co.minute) < (end_h, end_m)

            if object_name not in objects_map:
                objects_map[object_name] = {"id": object_id, "name": object_name,
                                             "work_start": thresh["work_start"], "work_end": thresh["work_end"],
                                             "total": 0, "contractors": {}}
            obj_e = objects_map[object_name]
            obj_e["total"] += 1
            if cname not in obj_e["contractors"]:
                obj_e["contractors"][cname] = {"present": 0, "late": 0, "early_leave": 0}
            obj_e["contractors"][cname]["present"] += 1
            if is_late: obj_e["contractors"][cname]["late"] += 1
            if is_early_leave: obj_e["contractors"][cname]["early_leave"] += 1

            if cname not in contractors_global:
                contractors_global[cname] = {"present": 0, "late": 0, "early_leave": 0}
            contractors_global[cname]["present"] += 1
            if is_late: contractors_global[cname]["late"] += 1
            if is_early_leave: contractors_global[cname]["early_leave"] += 1

            total_present += 1
            if is_late: total_late += 1
            if is_early_leave: total_early_leave += 1

        return ok({
            "objects": [{"id": v["id"], "name": v["name"],
                         "work_start": v["work_start"], "work_end": v["work_end"],
                         "total": v["total"],
                         "contractors": [{"name": k, "present": cv["present"],
                                          "late": cv["late"], "early_leave": cv["early_leave"]}
                                         for k, cv in v["contractors"].items()]}
                        for v in objects_map.values()],
            "contractors": [{"name": k, "present": v["present"], "late": v["late"],
                              "early_leave": v["early_leave"]}
                             for k, v in sorted(contractors_global.items(), key=lambda x: -x[1]["present"])],
            "total_present": total_present,
            "total_late": total_late,
            "total_early_leave": total_early_leave,
        })

    # ════════════════════════════════
    #  HEARTBEAT
    # ════════════════════════════════

    if action == "heartbeat" and method == "POST":
        object_id = body.get("object_id")
        if not object_id:
            return err("object_id обязателен")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {SCHEMA}.tablet_heartbeat (object_id, last_seen)
            VALUES (%s, NOW())
            ON CONFLICT (object_id) DO UPDATE SET last_seen = NOW()
        """, (object_id,))
        conn.commit()
        conn.close()
        return ok({"ok": True})

    if action == "heartbeat" and method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            SELECT o.id, o.name,
                   h.last_seen,
                   EXTRACT(EPOCH FROM (NOW() - h.last_seen)) AS seconds_ago
            FROM {SCHEMA}.objects o
            LEFT JOIN {SCHEMA}.tablet_heartbeat h ON h.object_id = o.id
            WHERE o.is_active = TRUE
            ORDER BY o.id
        """)
        rows = cur.fetchall()
        conn.close()
        result = []
        for r in rows:
            last_seen   = str(r[2]) if r[2] else None
            seconds_ago = int(r[3]) if r[3] is not None else None
            online = seconds_ago is not None and seconds_ago < 360
            result.append({"object_id": r[0], "object_name": r[1],
                            "last_seen": last_seen, "seconds_ago": seconds_ago, "online": online})
        return ok(result)

    return err("Неизвестный action", 404)