import csv
import io
import json
from datetime import datetime

from backend.repositories.audit_log import AuditLogRepository


class AuditService:
    def __init__(self, repo: AuditLogRepository):
        self.repo = repo

    async def create_event(
        self,
        actor_id: str,
        action: str,
        target: str = "",
        result: str = "success",
        ip: str = "",
        user_agent: str = "",
        metadata: dict | None = None,
    ):
        payload = {
            "actor_id": actor_id,
            "action": action,
            "target": target,
            "result": result,
            "ip": ip,
            "user_agent": user_agent,
            "details": metadata or {},
        }
        return await self.repo.create_event(**payload)

    async def list_events(
        self,
        actor_id: str | None = None,
        action: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        skip: int = 0,
        limit: int = 100,
    ):
        return await self.repo.list_events(
            actor_id=actor_id,
            action=action,
            start=start,
            end=end,
            skip=skip,
            limit=limit,
        )

    @staticmethod
    def export_json(items: list[dict]) -> str:
        return json.dumps(items, ensure_ascii=False)

    @staticmethod
    def export_csv(items: list[dict]) -> str:
        output = io.StringIO()
        fieldnames = [
            "id",
            "actor_id",
            "action",
            "target",
            "result",
            "timestamp",
            "ip",
            "user_agent",
            "metadata",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow(item)
        return output.getvalue()
