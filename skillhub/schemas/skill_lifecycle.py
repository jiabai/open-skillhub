from pydantic import BaseModel


class SkillInstallInstructionsResponse(BaseModel):
    strategy: str
    dependencies: list[str]
    requirements_text: str
    commands: list[str]
    ecosystem: str | None = None
    manifests: dict | None = None
    dependency_spec: dict | None = None


class SkillVersionDiffFile(BaseModel):
    path: str
    diff: str


class SkillVersionDiffResponse(BaseModel):
    from_version: str
    to_version: str
    added: list[str]
    removed: list[str]
    modified: list[SkillVersionDiffFile]
