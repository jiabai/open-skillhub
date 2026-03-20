from datetime import datetime, timezone

from skillhub.config.settings import settings
from skillhub.repositories.audit_log import AuditLogRepository
from skillhub.services.audit import AuditService


class DeprecationNotifier:
    def __init__(self, audit_repo: AuditLogRepository, day_offsets: list[int] | None = None):
        self.audit_repo = audit_repo
        self.day_offsets = day_offsets if day_offsets is not None else list(settings.DEPRECATION_NOTIFY_OFFSETS_DAYS)

    @staticmethod
    def _parse_sunset_date(value: str) -> datetime | None:
        raw = str(value or "").strip()
        if not raw:
            return None
        normalized = raw.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    async def notify_upcoming_deprecation(self, deprecated_endpoints: dict[str, str] | None = None) -> list[dict]:
        source = deprecated_endpoints if deprecated_endpoints is not None else settings.DEPRECATED_ENDPOINTS
        notifications: list[dict] = []
        today = datetime.now(timezone.utc).date()
        service = AuditService(self.audit_repo)
        for endpoint, sunset_date_str in source.items():
            sunset_date = self._parse_sunset_date(str(sunset_date_str))
            if sunset_date is None:
                continue
            days_until_removal = (sunset_date.date() - today).days
            if days_until_removal not in self.day_offsets:
                continue
            notification = {
                "endpoint": endpoint,
                "sunset_date": sunset_date.date().isoformat(),
                "days_remaining": days_until_removal,
                "severity": "warning" if days_until_removal > 7 else "critical",
            }
            notifications.append(notification)
            await service.create_event(
                actor_id="system",
                action="deprecation_notice",
                target=str(endpoint),
                result="pending",
                metadata=notification,
            )
        await self._send_notifications(notifications)
        return notifications

    async def _send_notifications(self, notifications: list[dict]) -> None:
        return None
