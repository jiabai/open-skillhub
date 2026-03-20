from datetime import datetime

from sqlalchemy import and_, select

from skillhub.models.audit_log import AuditLog
from skillhub.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository):
    async def create_event(self, **data) -> AuditLog:
        log = AuditLog(**data)
        self.session.add(log)
        await self.session.commit()
        await self.session.refresh(log)
        return log

    async def list_events(
        self,
        actor_id: str | None = None,
        action: str | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[AuditLog]:
        filters = []
        if actor_id:
            filters.append(AuditLog.actor_id == actor_id)
        if action:
            filters.append(AuditLog.action == action)
        if start:
            filters.append(AuditLog.timestamp >= start)
        if end:
            filters.append(AuditLog.timestamp <= end)
        stmt = select(AuditLog)
        if filters:
            stmt = stmt.where(and_(*filters))
        stmt = stmt.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
