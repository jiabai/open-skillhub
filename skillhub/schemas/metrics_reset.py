from pydantic import BaseModel


class MetricsReset24hResponse(BaseModel):
    removed: int
    window_hours: int
    window_start: str
    window_end: str
