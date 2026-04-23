# 23个 AI 编程助手 SKILL 全局路径一览

> 数据来源：Aghub 项目代码 `crates/agents/src/agents/*.rs`

## 完整路径列表

| 序号 | Agent | 显示名称 | 全局 SKILL 路径（读取） | 支持 Skills |
|------|-------|---------|----------------------|-------------|
| 1 | Claude | Claude Code | 1. `~/.claude/skills`<br>2. `~/.claude/plugins/marketplaces/*/skills` (动态发现) | ✓ |
| 2 | Cursor | Cursor | 1. `~/.cursor/skills`<br>2. `~/.claude/skills`<br>3. `~/.codex/skills` | ✓ |
| 3 | Windsurf | Windsurf | `~/.codeium/windsurf/skills` | ✓ |
| 4 | Copilot | GitHub Copilot | `~/.copilot/skills` | ✓ |
| 5 | RooCode | RooCode | `~/.roo/skills` | ✓ |
| 6 | Cline | Cline | `~/.agents/skills` | ✓ |
| 7 | Gemini | Gemini CLI | `~/.gemini/skills` | ✓ |
| 8 | Codex | OpenAI Codex | 1. `~/.codex/skills`<br>2. `~/.agents/skills`<br>3. `/etc/codex/skills` (仅非Windows) | ✓ |
| 9 | OpenCode | OpenCode | 1. `~/.config/opencode/skills`<br>2. `~/.claude/skills`<br>3. `~/.agents/skills` | ✓ |
| 10 | KiloCode | KiloCode | `~/.kilocode/skills` | ✓ |
| 11 | Amp | Amp | `~/.config/agents/skills` | ✓ (universal) |
| 12 | Zed | Zed | 不支持 | ✗ |
| 13 | Kiro | Kiro | `~/.kiro/skills` | ✓ |
| 14 | Warp | Warp | `~/.agents/skills` | ✓ |
| 15 | Trae | Trae | `~/.trae/skills` | ✓ |
| 16 | Factory | Factory | `~/.factory/skills` | ✓ |
| 17 | Kimi | Kimi Code CLI | `~/.config/agents/skills` | ✓ (universal) |
| 18 | Mistral | Mistral Le Chat | `~/.vibe/skills` | ✓ |
| 19 | Pi | Pi Coding Agent | `~/.pi/agent/skills` | ✓ |
| 20 | Antigravity | Antigravity | `~/.gemini/antigravity/skills` | ✓ |
| 21 | OpenClaw | OpenClaw | 优先级检测（单选）：<br>1. `~/.openclaw/skills` (优先)<br>2. `~/.clawdbot/skills`<br>3. `~/.moltbot/skills` | ✓ |
| 22 | AugmentCode | AugmentCode | 不支持 | ✗ |
| 23 | JetBrains AI | JetBrains AI | 不支持 | ✗ |

## 多路径读取 Agent 详情

以下 Agent 会同时读取多个路径中的 Skills：

### Claude
```
~/.claude/skills                        # 主路径
~/.claude/plugins/marketplaces/*/skills # 动态发现 marketplaces 子目录
```

### Cursor
```
~/.cursor/skills    # 主路径
~/.claude/skills    # 兼容 Claude
~/.codex/skills     # 兼容 Codex
```

### OpenCode
```
~/.config/opencode/skills  # 主路径
~/.claude/skills           # 兼容 Claude
~/.agents/skills           # Universal 路径
```

### Codex
```
~/.codex/skills      # 主路径
~/.agents/skills     # Universal 路径
/etc/codex/skills    # 系统路径 (仅 Linux/macOS，Windows 无此路径)
```

## 备注

- **universal=true** 的 Agent (Amp, Kimi) 会额外读取 `$XDG_CONFIG_HOME/agents/skills` (默认 `~/.config/agents/skills`)
- **OpenClaw** 是优先级检测，不是多路径同时读取，只会选择第一个存在的路径
- **不支持 Skills 的 Agent**: Zed、AugmentCode、JetBrains AI (仅支持 MCP)