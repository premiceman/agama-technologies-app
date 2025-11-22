
---

### 2.5 `docs/AI_SPEC.md`

```md
# AI Specification

This document specifies the AI-powered behaviours for Engagement Rooms and related objects.

All AI calls use:

- OpenAI Chat Completions
- Default model: `gpt-4o-mini` (unless otherwise specified)
- System prompts that clearly state the model's role and the desired JSON schema

---

## 1. Room Summary Copilot

### Route

`POST /api/rooms/:roomId/ai/summary`

### Input

Body:

```json
{
  "timeWindowHours": 24
}
