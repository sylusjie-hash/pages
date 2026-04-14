#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import io
import json
import os
import sqlite3
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

DB_PATH = os.environ.get(
    "SURVEY_DB_PATH", os.path.join(os.path.dirname(__file__), "survey_data.sqlite3")
)
HOST = os.environ.get("SURVEY_HOST", "0.0.0.0")
PORT = int(os.environ.get("SURVEY_PORT", "8765"))
API_TOKEN = os.environ.get("SURVEY_API_TOKEN", "").strip()

REVIEW_DIMENSIONS = [
    ("question_quality", "试题质量"),
    ("analysis_quality", "解析质量"),
    ("standardization", "规范性"),
    ("difficulty", "难度设计"),
    ("structure", "结构合理性"),
    ("simulation", "仿真度"),
]


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS survey_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            survey_type TEXT NOT NULL,
            user_id TEXT,
            source_label TEXT,
            date TEXT,
            timestamp INTEGER,
            submit_time TEXT,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS paper_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paper_name TEXT,
            batch TEXT,
            paper_id TEXT NOT NULL,
            module TEXT,
            reviewer TEXT NOT NULL,
            review_date TEXT,
            total_score REAL NOT NULL DEFAULT 0,
            pass_status TEXT NOT NULL,
            veto INTEGER NOT NULL DEFAULT 0,
            suggestion TEXT,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(paper_id, reviewer)
        )
    """
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_survey_type ON survey_responses(survey_type)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_survey_timestamp ON survey_responses(timestamp)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_review_batch ON paper_reviews(batch)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_review_status ON paper_reviews(pass_status)"
    )
    cur.execute(
        "CREATE INDEX IF NOT EXISTS idx_review_date ON paper_reviews(review_date)"
    )
    conn.commit()
    conn.close()


def now_iso():
    return datetime.utcnow().isoformat() + "Z"


def normalize_text(value):
    return (value or "").strip()


def parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in ("1", "true", "yes", "y", "on")


def serialize_review_row(row):
    payload = json.loads(row["payload_json"])
    payload["_id"] = row["id"]
    payload["_createdAt"] = row["created_at"]
    payload["_updatedAt"] = row["updated_at"]
    payload["paper_name"] = payload.get("paper_name") or row["paper_name"]
    payload["batch"] = payload.get("batch") or row["batch"]
    payload["paper_id"] = payload.get("paper_id") or row["paper_id"]
    payload["module"] = payload.get("module") or row["module"]
    payload["reviewer"] = payload.get("reviewer") or row["reviewer"]
    payload["review_date"] = payload.get("review_date") or row["review_date"]
    payload["total_score"] = payload.get("total_score", row["total_score"])
    result = payload.get("result") or {}
    result["is_pass"] = result.get("is_pass") or row["pass_status"]
    result["veto"] = bool(result.get("veto", row["veto"]))
    result["suggestion"] = result.get("suggestion") or row["suggestion"] or ""
    payload["result"] = result
    return payload


def validate_review_payload(payload):
    errors = []
    paper_name = normalize_text(payload.get("paper_name"))
    paper_id = normalize_text(payload.get("paper_id"))
    reviewer = normalize_text(payload.get("reviewer"))
    batch = normalize_text(payload.get("batch"))
    module = normalize_text(payload.get("module"))
    review_date = normalize_text(payload.get("review_date"))
    scores = payload.get("scores") or {}
    result = payload.get("result") or {}
    pass_status = normalize_text(result.get("is_pass"))
    veto = parse_bool(result.get("veto"))

    if not paper_id:
        errors.append("paper_id is required")
    if not reviewer:
        errors.append("reviewer is required")
    if not pass_status:
        errors.append("result.is_pass is required")

    total_score = 0
    normalized_scores = {}
    for key, _label in REVIEW_DIMENSIONS:
        item = scores.get(key) or {}
        raw_score = item.get("score", 0)
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            errors.append(f"scores.{key}.score must be numeric")
            score = 0
        comment = normalize_text(item.get("comment"))
        normalized_scores[key] = {
            "score": score,
            "comment": comment,
        }
        total_score += score

    if veto:
        pass_status = "不合格"

    normalized_payload = {
        "paper_name": paper_name,
        "batch": batch,
        "paper_id": paper_id,
        "module": module,
        "reviewer": reviewer,
        "review_date": review_date,
        "scores": normalized_scores,
        "total_score": round(total_score, 2),
        "result": {
            "is_pass": pass_status,
            "veto": veto,
            "suggestion": normalize_text(result.get("suggestion")),
        },
    }
    return errors, normalized_payload


def review_to_csv(records):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "试卷名称",
            "批次",
            "编号",
            "学科模块",
            "审核人员",
            "审核日期",
            "试题质量",
            "解析质量",
            "规范性",
            "难度设计",
            "结构合理性",
            "仿真度",
            "总分",
            "审核结论",
            "一票否决",
            "修改建议",
            "提交时间",
        ]
    )

    for item in records:
        scores = item.get("scores") or {}
        row = [
            item.get("_id"),
            item.get("paper_name", ""),
            item.get("batch", ""),
            item.get("paper_id", ""),
            item.get("module", ""),
            item.get("reviewer", ""),
            item.get("review_date", ""),
        ]
        for key, _label in REVIEW_DIMENSIONS:
            row.append((scores.get(key) or {}).get("score", ""))
        result = item.get("result") or {}
        row.extend(
            [
                item.get("total_score", ""),
                result.get("is_pass", ""),
                "是" if result.get("veto") else "否",
                result.get("suggestion", ""),
                item.get("_createdAt", ""),
            ]
        )
        writer.writerow(row)
    return output.getvalue().encode("utf-8-sig")


class SurveyHandler(BaseHTTPRequestHandler):
    server_version = "SurveySQLiteHTTP/2.0"

    def _send_bytes(self, status, body, content_type="application/json; charset=utf-8", extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self._send_bytes(status, body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def _check_token(self, parsed=None):
        if not API_TOKEN:
            return True
        header_token = self.headers.get("X-API-Token", "").strip()
        if header_token == API_TOKEN:
            return True
        if parsed:
            params = parse_qs(parsed.query)
            query_token = (params.get("apiToken", [""])[0] or "").strip()
            if query_token == API_TOKEN:
                return True
        return False

    def do_OPTIONS(self):
        self._send_json(200, {"ok": True})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self._send_json(
                200,
                {"ok": True, "dbPath": DB_PATH, "serverTime": now_iso()},
            )
            return

        if path == "/api/surveys":
            self.handle_get_surveys(parsed)
            return

        if path == "/api/reviews":
            self.handle_get_reviews(parsed)
            return

        if path.startswith("/api/reviews/"):
            self.handle_get_review_detail(path)
            return

        if path == "/api/reviews-export":
            self.handle_export_reviews(parsed)
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/surveys":
            self.handle_post_surveys()
            return

        if parsed.path == "/api/reviews":
            self.handle_post_reviews()
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

    def handle_get_surveys(self, parsed):
        if not self._check_token(parsed):
            self._send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        params = parse_qs(parsed.query)
        survey_type = (params.get("surveyType", ["all"])[0] or "all").strip()
        limit = int((params.get("limit", ["1000"])[0] or "1000"))
        limit = max(1, min(limit, 5000))

        conn = get_conn()
        cur = conn.cursor()
        if survey_type == "all":
            cur.execute(
                """
                SELECT * FROM survey_responses
                ORDER BY COALESCE(timestamp, 0) DESC, id DESC
                LIMIT ?
            """,
                (limit,),
            )
        else:
            cur.execute(
                """
                SELECT * FROM survey_responses
                WHERE survey_type = ?
                ORDER BY COALESCE(timestamp, 0) DESC, id DESC
                LIMIT ?
            """,
                (survey_type, limit),
            )

        rows = cur.fetchall()
        conn.close()

        records = []
        for row in rows:
            payload = json.loads(row["payload_json"])
            payload["_id"] = row["id"]
            payload["_surveyType"] = row["survey_type"]
            payload["_source"] = row["source_label"] or (
                "教研版" if row["survey_type"] == "research" else "用户版"
            )
            payload["userId"] = payload.get("userId") or row["user_id"]
            payload["date"] = payload.get("date") or row["date"]
            payload["timestamp"] = payload.get("timestamp") or row["timestamp"]
            payload["submitTime"] = payload.get("submitTime") or row["submit_time"]
            records.append(payload)

        self._send_json(200, {"ok": True, "count": len(records), "records": records})

    def handle_post_surveys(self):
        if not self._check_token():
            self._send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        try:
            body = self._read_json()
            survey_type = (body.get("surveyType") or "user").strip()
            payload = body.get("payload") or {}
            if survey_type not in ("user", "research"):
                self._send_json(400, {"ok": False, "error": "Invalid surveyType"})
                return

            created_at = now_iso()
            source_label = "教研版" if survey_type == "research" else "用户版"
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO survey_responses (
                    survey_type, user_id, source_label, date, timestamp, submit_time, payload_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    survey_type,
                    payload.get("userId"),
                    source_label,
                    payload.get("date"),
                    payload.get("timestamp"),
                    payload.get("submitTime"),
                    json.dumps(payload, ensure_ascii=False),
                    created_at,
                ),
            )
            record_id = cur.lastrowid
            conn.commit()
            conn.close()

            self._send_json(200, {"ok": True, "id": record_id})
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})

    def handle_get_reviews(self, parsed):
        if not self._check_token(parsed):
            self._send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        params = parse_qs(parsed.query)
        limit = int((params.get("limit", ["100"])[0] or "100"))
        limit = max(1, min(limit, 1000))
        batch = normalize_text(params.get("batch", [""])[0])
        pass_status = normalize_text(params.get("status", [""])[0])
        keyword = normalize_text(params.get("keyword", [""])[0])

        query = "SELECT * FROM paper_reviews WHERE 1=1"
        values = []

        if batch:
            query += " AND batch = ?"
            values.append(batch)
        if pass_status:
            query += " AND pass_status = ?"
            values.append(pass_status)
        if keyword:
            like_value = f"%{keyword}%"
            query += (
                " AND (paper_name LIKE ? OR paper_id LIKE ? OR reviewer LIKE ? OR module LIKE ?)"
            )
            values.extend([like_value, like_value, like_value, like_value])

        query += " ORDER BY COALESCE(review_date, '') DESC, id DESC LIMIT ?"
        values.append(limit)

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(query, values)
        rows = cur.fetchall()

        cur.execute("SELECT DISTINCT batch FROM paper_reviews WHERE batch <> '' ORDER BY batch")
        batches = [item["batch"] for item in cur.fetchall()]
        conn.close()

        records = [serialize_review_row(row) for row in rows]
        self._send_json(
            200,
            {
                "ok": True,
                "count": len(records),
                "records": records,
                "filters": {"batches": batches},
            },
        )

    def handle_get_review_detail(self, path):
        parsed = urlparse(self.path)
        if not self._check_token(parsed):
            self._send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        review_id = path.rsplit("/", 1)[-1].strip()
        if not review_id.isdigit():
            self._send_json(400, {"ok": False, "error": "Invalid review id"})
            return

        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT * FROM paper_reviews WHERE id = ?", (int(review_id),))
        row = cur.fetchone()
        conn.close()

        if not row:
            self._send_json(404, {"ok": False, "error": "Review not found"})
            return

        self._send_json(200, {"ok": True, "record": serialize_review_row(row)})

    def handle_export_reviews(self, parsed):
        if not self._check_token(parsed):
            self._send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        params = parse_qs(parsed.query)
        batch = normalize_text(params.get("batch", [""])[0])
        pass_status = normalize_text(params.get("status", [""])[0])
        keyword = normalize_text(params.get("keyword", [""])[0])

        query = "SELECT * FROM paper_reviews WHERE 1=1"
        values = []

        if batch:
            query += " AND batch = ?"
            values.append(batch)
        if pass_status:
            query += " AND pass_status = ?"
            values.append(pass_status)
        if keyword:
            like_value = f"%{keyword}%"
            query += (
                " AND (paper_name LIKE ? OR paper_id LIKE ? OR reviewer LIKE ? OR module LIKE ?)"
            )
            values.extend([like_value, like_value, like_value, like_value])

        query += " ORDER BY COALESCE(review_date, '') DESC, id DESC"

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(query, values)
        rows = cur.fetchall()
        conn.close()

        records = [serialize_review_row(row) for row in rows]
        body = review_to_csv(records)
        filename = f"paper_reviews_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        self._send_bytes(
            200,
            body,
            content_type="text/csv; charset=utf-8",
            extra_headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    def handle_post_reviews(self):
        if not self._check_token():
            self._send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        try:
            body = self._read_json()
            payload = body.get("payload") or body
            errors, normalized_payload = validate_review_payload(payload)
            if errors:
                self._send_json(400, {"ok": False, "error": "; ".join(errors)})
                return

            current_time = now_iso()
            result = normalized_payload["result"]
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO paper_reviews (
                    paper_name, batch, paper_id, module, reviewer, review_date,
                    total_score, pass_status, veto, suggestion, payload_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(paper_id, reviewer) DO UPDATE SET
                    paper_name = excluded.paper_name,
                    batch = excluded.batch,
                    module = excluded.module,
                    review_date = excluded.review_date,
                    total_score = excluded.total_score,
                    pass_status = excluded.pass_status,
                    veto = excluded.veto,
                    suggestion = excluded.suggestion,
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
            """,
                (
                    normalized_payload["paper_name"] or normalized_payload["paper_id"],
                    normalized_payload["batch"],
                    normalized_payload["paper_id"],
                    normalized_payload["module"],
                    normalized_payload["reviewer"],
                    normalized_payload["review_date"],
                    normalized_payload["total_score"],
                    result["is_pass"],
                    1 if result["veto"] else 0,
                    result["suggestion"],
                    json.dumps(normalized_payload, ensure_ascii=False),
                    current_time,
                    current_time,
                ),
            )
            review_id = cur.lastrowid
            if not review_id:
                cur.execute(
                    "SELECT id FROM paper_reviews WHERE paper_id = ? AND reviewer = ?",
                    (
                        normalized_payload["paper_id"],
                        normalized_payload["reviewer"],
                    ),
                )
                existing = cur.fetchone()
                review_id = existing["id"] if existing else None

            conn.commit()
            conn.close()

            self._send_json(
                200,
                {
                    "ok": True,
                    "id": review_id,
                    "message": "saved",
                    "record": normalized_payload,
                },
            )
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), SurveyHandler)
    print(f"Survey SQLite server running on http://{HOST}:{PORT}")
    print(f"SQLite DB: {DB_PATH}")
    server.serve_forever()
