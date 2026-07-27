# `indusk run`

::: warning STUB — filled at plan close
This page is a placeholder stubbed during Phase 0 of the [dawn-external-orchestrator](/decisions/) plan. The full reference — loop behavior, gate enforcement, and the model matrix — is written when the plan closes (Phase 3 fills the loop behavior + `--model`; Phase 4 adds the second provider).
:::

The external orchestrator: run a plan through a model-agnostic, gated agentic loop — InDusk's discipline lifted out of Claude Code so the same gates fire behind any model.

```bash
indusk run <plan> --model claude|gpt|gemini|grok
```

## `--model`

Selects the driver. Accepts a friendly alias — `claude`, `gpt`, `gemini`, `grok` — or a bare provider name (`anthropic`, `openai`, `google`, `xai`), resolved through the provider registry into a driver config (`provider`, key env var, default model). Direct per-provider API keys, no commercial gateway (each provider is hit with your own key so per-provider credit arbitrage is preserved). Defaults to `claude`.

Provider keys are read from the environment: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `XAI_API_KEY`.

_As of Phase 0 the command resolves `--model` and reports the driver config; the agentic loop and gate enforcement land in later phases._
