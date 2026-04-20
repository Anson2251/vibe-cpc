# Recommended Execution Model: Frame Stack + Syscall Runtime

**Status**: Recommended for CPC Long-term Architecture  
**Based on**: Design 2 (Syscall CPS) with Frame Stack improvement  
**Evolution Path**: Towards Bytecode VM

---

## Overview

This document describes the recommended execution model for CPC based on architecture review. It combines the **Syscall CPS** approach with an **explicit Frame Stack** to eliminate closure allocation overhead while maintaining clean separation between pure evaluation and side effects.

This model is inspired by:
- Lua VM execution model
- QuickJS runtime boundary design
- Wasm hostcall model
- Production bytecode interpreters

---

## Core Philosophy

### Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                    Interpreter Core                         │
│  - Value stack                                                │
│  - Call stack (frames)                                        │
│  - Environment stack                                          │
│  - Frame stack (execution state)                              │
│  - Current node / PC                                          │
│                     ↓                                         │
│              Pure Computation                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Syscall Request
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  Effects Boundary                           │
│  - print()          - input()                                 │
│  - sleep()          - host function calls                     │
│  - debugger hooks   - async operations                        │
│                     ↓                                         │
│              Side Effects Only                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Async Result
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Trampoline                               │
│  - Drives execution loop                                      │
│  - Handles async bridge                                       │
│  - Manages state persistence                                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Insight

**Evaluator only computes values. Runtime handles all side effects.**

When evaluator needs external capability (IO, async, host call), it:
1. Returns a **syscall request** with current execution state
2. Yields control to Trampoline
3. Trampoline performs the operation
4. Execution resumes with the result

---

## Architecture Components

### 1. Frame Stack (Explicit Continuations)

Instead of closure-based continuations (which allocate and create GC pressure), we use an explicit frame stack:

```typescript
// Frame types represent "what to do next"
type Frame =
  | { kind: 'BinaryRight'; op: string; right: AstNode }
  | { kind: 'BinaryOp'; op: string; leftValue: unknown }
  | { kind: 'CallArgs'; callee: string; index: number; args: unknown[] }
  | { kind: 'CallOp'; callee: string; args: unknown[] }
  | { kind: 'ArrayIndex'; array: unknown[] }
  | { kind: 'Return'; frame: CallFrame }
  | { kind: 'DebugPause'; location: SourceLocation };

// Execution context - ALL mutable state
interface ExecutionContext {
  // Operand stack for expression evaluation
  valueStack: unknown[];
  
  // Frame stack for execution flow
  frameStack: Frame[];
  
  // Call stack for function calls
  callStack: CallFrame[];
  
  // Environment chain for variable lookup
  envStack: Environment[];
  
  // Current AST node being evaluated
  currentNode: AstNode | null;
  
  // Source location for debugging
  currentLoc: SourceLocation;
}

interface CallFrame {
  returnPC: number;
  savedEnv: Environment;
  name: string;
}

interface Environment {
  variables: Map<string, unknown>;
  parent: Environment | null;
}
```

### 2. Syscall Interface

```typescript
interface Syscall {
  type: 'io_input' | 'io_output' | 'host_call' | 'debug_pause' | 'sleep';
  data: unknown;
  loc: SourceLocation;
}

interface SyscallRequest {
  kind: 'syscall';
  call: Syscall;
  ctx: ExecutionContext;  // Serializable state
}

interface Completion {
  kind: 'complete';
  value: unknown;
}

type ExecutionResult = SyscallRequest | Completion;
```

### 3. Stateless Evaluator

```typescript
class FrameEvaluator {
  // Pure function: takes context, returns next step
  step(ctx: ExecutionContext): ExecutionResult {
    // If we have a current node, evaluate it
    if (ctx.currentNode) {
      return this.evalNode(ctx, ctx.currentNode);
    }
    
    // No current node - check frame stack
    if (ctx.frameStack.length > 0) {
      return this.resumeFrame(ctx);
    }
    
    // Nothing to do - complete
    return {
      kind: 'complete',
      value: ctx.valueStack.pop()
    };
  }

  private evalNode(ctx: ExecutionContext, node: AstNode): ExecutionResult {
    switch (node.type) {
      case 'Literal':
        ctx.valueStack.push(node.value);
        ctx.currentNode = null;
        return { kind: 'syscall', call: null as any, ctx }; // Continue
        
      case 'Identifier':
        ctx.valueStack.push(this.lookup(ctx, node.name));
        ctx.currentNode = null;
        return { kind: 'syscall', call: null as any, ctx };
        
      case 'BinaryExpression':
        // Push continuation frame, evaluate left
        ctx.frameStack.push({
          kind: 'BinaryRight',
          op: node.operator,
          right: node.right
        });
        ctx.currentNode = node.left;
        return { kind: 'syscall', call: null as any, ctx };
        
      case 'CallExpression':
        ctx.frameStack.push({
          kind: 'CallArgs',
          callee: node.callee,
          index: 0,
          args: []
        });
        if (node.args.length > 0) {
          ctx.currentNode = node.args[0];
        } else {
          // No args, make call immediately
          return this.makeHostCall(ctx, node.callee, []);
        }
        return { kind: 'syscall', call: null as any, ctx };
    }
  }

  private resumeFrame(ctx: ExecutionContext): ExecutionResult {
    const frame = ctx.frameStack.pop()!;
    
    switch (frame.kind) {
      case 'BinaryRight': {
        // Left operand done, value on stack
        const leftValue = ctx.valueStack.pop()!;
        ctx.frameStack.push({
          kind: 'BinaryOp',
          op: frame.op,
          leftValue
        });
        ctx.currentNode = frame.right;
        return { kind: 'syscall', call: null as any, ctx };
      }
      
      case 'BinaryOp': {
        // Right operand done, apply operator
        const rightValue = ctx.valueStack.pop()!;
        const result = this.applyOp(frame.leftValue, rightValue, frame.op);
        ctx.valueStack.push(result);
        ctx.currentNode = null;
        return { kind: 'syscall', call: null as any, ctx };
      }
      
      case 'CallArgs': {
        // Current arg evaluated
        const argValue = ctx.valueStack.pop()!;
        frame.args.push(argValue);
        
        if (frame.index + 1 < /* get arg count */ 0) {
          // More args to evaluate
          frame.index++;
          ctx.frameStack.push(frame);
          // ctx.currentNode = nextArg;  // Set next arg
          return { kind: 'syscall', call: null as any, ctx };
        } else {
          // All args ready, make call
          return this.makeHostCall(ctx, frame.callee, frame.args);
        }
      }
    }
  }

  private makeHostCall(ctx: ExecutionContext, callee: string, args: unknown[]): ExecutionResult {
    return {
      kind: 'syscall',
      call: {
        type: 'host_call',
        data: { name: callee, args },
        loc: ctx.currentLoc
      },
      ctx: {
        ...ctx,
        currentNode: null
      }
    };
  }

  private applyOp(left: unknown, right: unknown, op: string): unknown {
    switch (op) {
      case '+': return (left as number) + (right as number);
      case '-': return (left as number) - (right as number);
      case '*': return (left as number) * (right as number);
      case '/': return (left as number) / (right as number);
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  private lookup(ctx: ExecutionContext, name: string): unknown {
    for (let i = ctx.envStack.length - 1; i >= 0; i--) {
      const env = ctx.envStack[i];
      if (env.variables.has(name)) {
        return env.variables.get(name);
      }
    }
    throw new Error(`Undefined variable: ${name}`);
  }
}
```

### 4. Trampoline Driver

```typescript
class FrameTrampoline {
  private io: IOInterface;
  private debugger?: DebuggerInterface;

  async run(evaluator: FrameEvaluator, entryNode: AstNode): Promise<unknown> {
    let ctx = this.createInitialContext(entryNode);
    let result = evaluator.step(ctx);

    while (result.kind === 'syscall') {
      // Handle syscall
      const syscallResult = await this.handleSyscall(result.call);
      
      // Continue execution
      result = evaluator.step(result.ctx);
    }

    return result.value;
  }

  private async handleSyscall(call: Syscall): Promise<unknown> {
    switch (call.type) {
      case 'io_input':
        return await this.io.read();
        
      case 'io_output':
        this.io.write(call.data);
        return undefined;
        
      case 'host_call':
        const { name, args } = call.data as { name: string; args: unknown[] };
        return await this.callHostFunction(name, args);
        
      case 'debug_pause':
        if (this.debugger) {
          await this.debugger.pause(call.loc);
        }
        return undefined;
        
      case 'sleep':
        await this.sleep(call.data as number);
        return undefined;
    }
  }

  private createInitialContext(node: AstNode): ExecutionContext {
    return {
      valueStack: [],
      frameStack: [],
      callStack: [],
      envStack: [{ variables: new Map(), parent: null }],
      currentNode: node,
      currentLoc: { line: 0, column: 0 }
    };
  }
}
```

---

## Execution Example

### Expression: `Add(10, 20) * 3`

**Step-by-step execution:**

```
Initial State:
  valueStack: []
  frameStack: []
  currentNode: BinaryExpression(*, Call(Add, [10,20]), Literal(3))

Step 1: Eval BinaryExpression
  Push frame: BinaryRight(op='*', right=Literal(3))
  currentNode = CallExpression(Add, [10, 20])
  
Step 2: Eval CallExpression
  Push frame: CallArgs(callee='Add', index=0, args=[])
  currentNode = Literal(10)
  
Step 3: Eval Literal(10)
  valueStack.push(10)
  currentNode = null
  
Step 4: Resume CallArgs
  Pop frame, push arg value
  args = [10]
  Push frame: CallArgs(callee='Add', index=1, args=[10])
  currentNode = Literal(20)
  
Step 5: Eval Literal(20)
  valueStack.push(20)
  currentNode = null
  
Step 6: Resume CallArgs
  Pop frame, push arg value
  args = [10, 20]
  All args evaluated
  → SYSCALL: host_call(Add, [10, 20])
  
Step 7: Handle Syscall
  Trampoline calls Add(10, 20) → returns 30
  valueStack.push(30)
  
Step 8: Resume BinaryRight
  Pop frame, push left value
  Push frame: BinaryOp(op='*', leftValue=30)
  currentNode = Literal(3)
  
Step 9: Eval Literal(3)
  valueStack.push(3)
  currentNode = null
  
Step 10: Resume BinaryOp
  Pop frame, apply operator
  result = 30 * 3 = 90
  valueStack.push(90)
  
Step 11: Complete
  valueStack = [90]
  Return 90
```

---

## Advantages Over Current Model

### 1. No Async Pollution

| Aspect | Current (Async/Await) | Frame Stack Model |
|--------|----------------------|-------------------|
| Sync path | Must be `Promise` wrapped | Plain function calls |
| Hot path overhead | Promise allocation | None |
| Stack trace | Async frames | Synchronous frames |
| Mental model | "Everything is async" | "Only syscalls are async" |

### 2. Stack Safety

```typescript
// Deep expression: (((1+2)+3)+4)+...+N

// Current: Call stack overflow at ~10K depth
// Frame Stack: Can handle millions of frames (heap allocated)
```

### 3. Serializable State

```typescript
// Can snapshot and resume execution
const snapshot = JSON.stringify({
  valueStack: ctx.valueStack,
  frameStack: ctx.frameStack,
  envStack: ctx.envStack,
  currentNode: serializeAST(ctx.currentNode)
});

// Resume later or on different machine
const restored = JSON.parse(snapshot);
const result = await trampoline.resume(restored);
```

### 4. Debugger Integration

```typescript
// Insert debug frames at any point
ctx.frameStack.push({ kind: 'DebugPause', location: node.loc });

// Trampoline handles the pause
if (call.type === 'debug_pause') {
  await debugger.pause(call.loc);
}
```

---

## Comparison with Alternative Models

| Feature | Generator | Syscall (Closure) | **Frame Stack** | Bytecode VM |
|---------|-----------|-------------------|-----------------|-------------|
| Code clarity | Excellent | Fair | Good | Good |
| Stack safety | Poor | Excellent | **Excellent** | Excellent |
| Performance | Good | Fair | **Good** | Excellent |
| GC pressure | Medium | High | **Low** | Low |
| Serialization | Poor | Poor | **Good** | Excellent |
| Debug stepping | Excellent | Good | **Excellent** | Excellent |
| QuickJS compatible | Needs testing | Yes | **Yes** | Yes |
| Migration path | Dead end | VM | **VM** | - |

---

## Migration Path from Current Code

### Phase 1: Frame Stack Evaluation (Current Priority)

1. Introduce `Frame` type and `frameStack` to `ExecutionContext`
2. Refactor `evalBinaryExpression`, `evalCallExpression` to push frames instead of async recursion
3. Remove `evaluateSync` / `evaluateAsync` split - single evaluation path
4. Trampoline drives the loop

### Phase 2: Syscall Consolidation

1. Identify all async operations (IO, host calls, sleep, debug)
2. Convert to syscall interface
3. Remove `Promise` from evaluator return types

### Phase 3: Bytecode Compilation (Future)

1. Add bytecode instruction set
2. Compile AST to bytecode
3. Replace frame-based evaluation with instruction dispatch
4. Add optimization passes

---

## Code Example: Complete Implementation

See `poc-frame-stack/` directory for working prototype:
- `test-frame-stack.ts` - Full implementation
- `test-stateless.ts` - Evolution from earlier prototypes

---

## Conclusion

The **Frame Stack + Syscall Runtime** model provides:

1. **Clean separation** between pure evaluation and side effects
2. **Zero async overhead** on hot paths
3. **Stack safety** for arbitrarily deep expressions
4. **Serializable state** for debugging and persistence
5. **Clear evolution path** towards bytecode VM

This is the recommended architecture for CPC's long-term interpreter design.
