"""
Главный API для системы учёта рабочего времени ТабельПро.
Обрабатывает: работников, объекты, сканирование QR, историю записей.
"""
import json
import os
import uuid
from datetime import datetime, timezone
import psycopg2

SCHEMA = "t_p46198453_qr_scan_attendance"

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token",
    "Content-Type": "application/json",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data, status=200):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(data, ensure_ascii=False, default=str)}


def err(msg, status=400):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    """Единое API: workers, objects, scan, records, stats."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/").rstrip("/") or "/"
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    params = event.get("queryStringParameters") or {}

    # ── GET /workers ── список работников
    if method == "GET" and path == "/workers":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id, name, position, qr_code, is_active, created_at FROM {SCHEMA}.workers WHERE is_active = TRUE ORDER BY name")
        rows = cur.fetchall()
        conn.close()
        workers = [{"id": r[0], "name": r[1], "position": r[2], "qr_code": r[3], "is_active": r[4], "created_at": str(r[5])} for r in rows]
        return ok(workers)

    # ── POST /workers ── добавить работника
    if method == "POST" and path == "/workers":
        name = (body.get("name") or "").strip()
        position = (body.get("position") or "Работник").strip()
        if not name:
            return err("Имя обязательно")
        qr_code = f"TPRO-{uuid.uuid4().hex[:12].upper()}"
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.workers (name, position, qr_code) VALUES (%s, %s, %s) RETURNING id, name, position, qr_code, created_at",
            (name, position, qr_code)
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({"id": row[0], "name": row[1], "position": row[2], "qr_code": row[3], "created_at": str(row[4])}, 201)

    # ── DELETE /workers/{id} ── удалить работника
    if method == "DELETE" and path.startswith("/workers/"):
        worker_id = path.split("/")[-1]
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"UPDATE {SCHEMA}.workers SET is_active = FALSE WHERE id = %s", (worker_id,))
        conn.commit()
        conn.close()
        return ok({"ok": True})

    # ── GET /objects ── список объектов
    if method == "GET" and path == "/objects":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id, name, address, is_active FROM {SCHEMA}.objects ORDER BY id")
        rows = cur.fetchall()
        conn.close()
        return ok([{"id": r[0], "name": r[1], "address": r[2], "is_active": r[3]} for r in rows])

    # ── PUT /objects/{id} ── переименовать объект
    if method == "PUT" and path.startswith("/objects/"):
        obj_id = path.split("/")[-1]
        new_name = (body.get("name") or "").strip()
        password = (body.get("password") or "")
        if not new_name:
            return err("Название обязательно")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT password_hash FROM {SCHEMA}.objects WHERE id = %s", (obj_id,))
        row = cur.fetchone()
        if not row:
            conn.close()
            return err("Объект не найден", 404)
        if row[0] != password:
            conn.close()
            return err("Неверный пароль", 403)
        cur.execute(f"UPDATE {SCHEMA}.objects SET name = %s WHERE id = %s", (new_name, obj_id))
        conn.commit()
        conn.close()
        return ok({"ok": True, "name": new_name})

    # ── POST /scan ── зафиксировать сканирование QR
    if method == "POST" and path == "/scan":
        qr_code = (body.get("qr_code") or "").strip()
        object_id = body.get("object_id")
        scan_type = body.get("scan_type", "checkin")
        if not qr_code or not object_id:
            return err("qr_code и object_id обязательны")
        if scan_type not in ("checkin", "checkout"):
            return err("scan_type должен быть checkin или checkout")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id, name, position FROM {SCHEMA}.workers WHERE qr_code = %s AND is_active = TRUE", (qr_code,))
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
                (worker_id, worker_name, worker_position, object_id, object_name, scan_type, qr_code)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, scanned_at""",
            (worker[0], worker[1], worker[2], obj[0], obj[1], scan_type, qr_code)
        )
        rec = cur.fetchone()
        conn.commit()
        conn.close()
        return ok({
            "id": rec[0],
            "worker_name": worker[1],
            "worker_position": worker[2],
            "object_name": obj[1],
            "scan_type": scan_type,
            "scanned_at": str(rec[1]),
        })

    # ── GET /records ── история (с фильтрами date, object_id, limit)
    if method == "GET" and path == "/records":
        limit = int(params.get("limit", 100))
        date_filter = params.get("date")
        object_id = params.get("object_id")
        conn = get_conn()
        cur = conn.cursor()
        sql = f"""SELECT id, worker_name, worker_position, object_name, scan_type, scanned_at
                  FROM {SCHEMA}.attendance_records WHERE 1=1"""
        args = []
        if date_filter:
            sql += " AND DATE(scanned_at AT TIME ZONE 'Europe/Moscow') = %s"
            args.append(date_filter)
        if object_id:
            sql += " AND object_id = %s"
            args.append(object_id)
        sql += " ORDER BY scanned_at DESC LIMIT %s"
        args.append(limit)
        cur.execute(sql, args)
        rows = cur.fetchall()
        conn.close()
        return ok([{
            "id": r[0], "worker_name": r[1], "worker_position": r[2],
            "object_name": r[3], "scan_type": r[4], "scanned_at": str(r[5])
        } for r in rows])

    # ── GET /stats ── статистика за сегодня
    if method == "GET" and path == "/stats":
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"""
            SELECT
                COUNT(DISTINCT CASE WHEN scan_type='checkin' THEN worker_id END) as checked_in,
                COUNT(DISTINCT CASE WHEN scan_type='checkout' THEN worker_id END) as checked_out,
                COUNT(DISTINCT worker_id) as total_workers
            FROM {SCHEMA}.attendance_records
            WHERE DATE(scanned_at AT TIME ZONE 'Europe/Moscow') = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'
        """)
        row = cur.fetchone()
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.workers WHERE is_active = TRUE")
        total = cur.fetchone()[0]
        conn.close()
        on_site = (row[0] or 0) - (row[1] or 0)
        return ok({
            "on_site": max(on_site, 0),
            "checked_in_today": row[0] or 0,
            "checked_out_today": row[1] or 0,
            "total_registered": total,
        })

    return err("Маршрут не найден", 404)
