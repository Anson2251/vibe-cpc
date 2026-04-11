# Debugger Design (MVP)

## Background

The interpreter is environment-agnostic and already decoupled from Node.js. We want a built-in debugger system that works in CLI and future web editor contexts without requiring DAP/CDP in the first phase.

This document defines an internal debugger protocol and runtime architecture. DAP/CDP compatibility can later be added as bridge layers.

## Goals

- Add a minimal debugger runtime that supports pause and resume.
- Add a new statement: `DEBUGGER`.
- Support conditional breakpoints via normal language flow:
  - `IF <condition> THEN DEBUGGER ENDIF`
- Provide machine-friendly debug events and snapshots.
- Keep runtime and UI transport decoupled.

## Non-Goals (MVP)

- No virtual file system integration.
- No DAP/CDP implementation.
- No advanced expression evaluator in watches.
- No persistent breakpoint storage.

## Debugger Trigger Model

### 1) Programmatic breakpoint

- `DEBUGGER` statement pauses execution unconditionally.

### 2) Conditional breakpoint

- Use language control flow:
  - `IF x > 10 THEN DEBUGGER ENDIF`

### 3) Behavior without debugger session

- If debugger is not attached/enabled, `DEBUGGER` is treated as a no-op.

## Internal Architecture

## Components

- `DebuggerController`
  - state machine: `idle | running | paused | terminated`
  - pause/resume coordination
  - event emission
- `DebuggerSnapshotBuilder`
  - creates pause snapshots from `ExecutionContext` + `Environment`
- Runtime hook integration in `Evaluator`
  - executes pause logic when hitting `DebuggerNode`

## Data Flow

1. Interpreter starts execution with optional debugger enabled.
2. Evaluator reaches `DebuggerNode`.
3. Evaluator asks `DebuggerController.pause(...)`.
4. Controller emits `paused` event with snapshot.
5. Execution awaits controller command (`continue`).
6. Controller emits `resumed`; evaluator continues.

## Internal Protocol (v0)

The protocol is transport-agnostic JSON-like payloads. It can be in-process events now and WebSocket messages later.

### Commands

- `continue`
- `terminate`
- (reserved) `stepOver`, `stepInto`, `setBreakpoint`, `clearBreakpoint`, `evaluate`

### Events

- `paused`
- `resumed`
- `terminated`
- `output` (optional pass-through)
- `error`

### Core Types

```ts
type DebugPauseReason = "debugger-statement" | "exception" | "manual";

interface DebugLocation {
  line?: number;
  column?: number;
}

interface DebugVariable {
  name: string;
  type: string;
  value: unknown;
  isConstant: boolean;
}

interface DebugScope {
  scopeName: "local" | "global";
  variables: DebugVariable[];
}

interface DebugFrame {
  routineName: string;
  line?: number;
  column?: number;
}

interface DebugSnapshot {
  reason: DebugPauseReason;
  location: DebugLocation;
  scopes: DebugScope[];
  callStack: DebugFrame[];
}

interface DebugEvent {
  type: "paused" | "resumed" | "terminated" | "error";
  snapshot?: DebugSnapshot;
  message?: string;
}
```

## Language and Runtime Changes

## Lexer

- Add keyword token: `DEBUGGER`.

## Parser / AST

- Add AST node type:

```ts
interface DebuggerNode extends StatementNode {
  type: "Debugger";
}
```

- Add statement parser branch for `DEBUGGER`.

## Evaluator

- Extend evaluatable statement union to include `Debugger`.
- Add `evaluateDebugger(node)`:
  - if debugger disabled: return immediately
  - if enabled: construct snapshot and pause

## Interpreter

- Add optional debugger integration methods:
  - `attachDebugger(controller)`
  - `getDebuggerController()`

## Error and UX Rules

- Debugger events should not mutate program output semantics.
- If an exception occurs while paused/resumed transitions happen, emit `error` then terminate execution safely.
- Snapshot generation should avoid throwing; if variable serialization fails, emit placeholder value.

## Testing Plan

## Unit tests

- Parser parses `DEBUGGER` into `DebuggerNode`.
- Evaluator:
  - no-op when debugger disabled
  - pauses when debugger enabled
  - snapshot contains line/column and variable scopes
- Controller state transitions:
  - `running -> paused -> running`
  - `running -> paused -> terminated`

## Integration tests

- Program pauses at `DEBUGGER` and continues to completion.
- Conditional pause works with `IF ... THEN DEBUGGER ENDIF`.
- Multiple `DEBUGGER` statements pause multiple times.

## Rollout Milestones

### M1 (this design)

- Internal protocol definitions
- `DEBUGGER` statement parsing and no-op runtime behavior

### M2

- Pause/resume controller wired to evaluator
- Basic snapshots and pause event stream

### M3

- Step controls (`stepOver`, `stepInto`)
- Source-level breakpoints

### M4

- Bridge layer mapping to DAP/CDP

## Future Bridge Strategy

- Keep internal protocol stable.
- Implement `dap-bridge` and `cdp-bridge` as adapters:
  - map internal `paused` to DAP `stopped` / CDP `Debugger.paused`
  - map internal `continue` to DAP `continue` / CDP `Debugger.resume`

This keeps interpreter core unchanged while adding ecosystem compatibility later.
