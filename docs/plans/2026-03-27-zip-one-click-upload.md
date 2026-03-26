# ZIP 一站式上传设计

## 概述

改进 Skill 上传体验，实现 ZIP 包一站式创建和上传，无需先创建 Skill 记录。

## 问题

当前上传流程存在以下问题：
1. 操作繁琐 - 需要先创建 Skill 再上传文件
2. ZIP 上传功能未在前端暴露
3. 不支持批量上传
4. 缺少拖拽、进度条等现代 UX

## 解决方案

### 后端改动

修改现有 `POST /api/v1/skills/upload` 端点，将 `skill_uuid` 参数改为可选：

**请求参数：**
- `file`: ZIP 文件（必须包含 SKILL.md）
- `skill_uuid`: 可选，已有 Skill 的 UUID
- `visibility`: 可选，默认 "private"（仅无 skill_uuid 时生效）
- `metadata`: 可选，JSON 字符串

**处理逻辑：**
- 有 `skill_uuid` → 现有逻辑（上传到已有 Skill）
- 无 `skill_uuid` → 从 ZIP 解析 SKILL.md，自动创建 Skill 并上传

**自动创建流程：**
1. 解压 ZIP，验证 SKILL.md 存在
2. 解析 frontmatter 提取 name、description、version、dependencies
3. 检查 Skill 名称是否已存在（重名则报错）
4. 自动创建 Skill 记录
5. 存储文件、创建版本
6. 返回完整的 Skill 信息

**响应：**
```json
{
  "id": "uuid",
  "name": "从 SKILL.md 提取",
  "description": "从 SKILL.md 提取",
  "version": "1.0.0",
  "current_version": "1.0.0",
  "files": ["SKILL.md", "reference.md"]
}
```

### 前端改动

改造 `/skills/new` 页面：

**UI 组件：**
1. 拖拽上传区域（页面主体）
   - 大虚线框，支持拖拽 ZIP 文件
   - 或点击选择文件
   - 显示上传进度条

2. 预览确认区域（上传后显示）
   - 从 ZIP 解析的 Skill 名称、描述
   - 可见性选择（私有/团队/企业）
   - 文件列表预览
   - 确认/取消按钮

3. 成功后
   - 显示成功消息
   - 自动跳转到 Skill 详情页

**交互流程：**
```
拖入 ZIP → 上传 → 显示预览 → 用户确认 → 创建完成 → 跳转详情页
```

## 文件改动清单

### 后端
- `backend/api/v1/skills.py` - 修改 upload_skill_file 端点
- `backend/services/skill.py` - 新增 upload_zip_create_skill 方法

### 前端
- `frontend/src/app/skills/new/page.tsx` - 重构为拖拽上传
- `frontend/src/lib/api.ts` - 更新 uploadSkillFile 方法

## 向后兼容

- 现有 `skill_uuid` 必填的调用方式继续有效
- 前端旧版创建流程可保留作为备选入口
