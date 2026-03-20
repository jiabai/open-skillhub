from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from skillhub.models.request_metric import RequestMetric


class RequestMetricRepository:
    def __init__(self, session):
        self.session = session

    def _get_insert(self):
        dialect_name = self.session.bind.dialect.name if self.session.bind else "sqlite"
        if dialect_name == "postgresql":
            return pg_insert
        if dialect_name == "sqlite":
            return sqlite_insert
        return sqlite_insert

    async def upsert_hour_bucket(self, user_id: str, bucket_start: datetime, success: bool) -> None:
        insert_stmt = self._get_insert()(RequestMetric).values(
            user_id=user_id,
            bucket_start=bucket_start,
            total_count=1,
            success_count=1 if success else 0,
            failure_count=0 if success else 1,
        )
        update_stmt = insert_stmt.on_conflict_do_update(
            index_elements=["user_id", "bucket_start"],
            set_={
                "total_count": RequestMetric.total_count + 1,
                "success_count": RequestMetric.success_count + (1 if success else 0),
                "failure_count": RequestMetric.failure_count + (0 if success else 1),
                "updated_at": func.now(),
            },
        )
        await self.session.execute(update_stmt)
        await self.session.commit()

    async def aggregate_window(self, user_id: str, start: datetime, end: datetime) -> tuple[int, int]:
        result = await self.session.execute(
            select(
                func.coalesce(func.sum(RequestMetric.total_count), 0),
                func.coalesce(func.sum(RequestMetric.success_count), 0),
            ).where(
                RequestMetric.user_id == user_id,
                RequestMetric.bucket_start >= start,
                RequestMetric.bucket_start < end,
            )
        )
        total, success = result.one()
        return int(total or 0), int(success or 0)

    async def cleanup_before(self, cutoff: datetime) -> int:
        result = await self.session.execute(delete(RequestMetric).where(RequestMetric.bucket_start < cutoff))
        await self.session.commit()
        return int(result.rowcount or 0)

    async def delete_window(self, user_id: str, start: datetime, end: datetime) -> int:
        result = await self.session.execute(
            delete(RequestMetric).where(
                RequestMetric.user_id == user_id,
                RequestMetric.bucket_start >= start,
                RequestMetric.bucket_start < end,
            )
        )
        await self.session.commit()
        return int(result.rowcount or 0)
