# Golden conversation suite (V8 eval — P1)

Heuristic `runPromptEvalSuite()` is not enough for production regression. Add one JSON file per scenario:

```json
{
  "id": "spec-mode-clarify",
  "mode": "spec",
  "turns": [
    { "role": "user", "content": "Build a notification system" },
    { "role": "assistant", "expect": { "contains": ["requirements"], "toolCalls": [] } }
  ]
}
```

Run (future): `npm run eval:prompt:llm` with `OPENAI_API_KEY` — CI optional job.
