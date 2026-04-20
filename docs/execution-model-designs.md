# Execution Model Design Alternatives

This document outlines alternative execution model designs for the CPC interpreter, exploring different approaches to handle async operations, debugging, and execution flow control.

## Overview

The current interpreter uses an async/await based evaluator with trampoline for handling potentially long-running operations. However, this approach has code redundancy issues where both sync and async paths need to be maintained. This document explores three alternative designs that could reduce this redundancy.

---

## Design 1: Generator-Based Execution Model

### Concept

Use JavaScript Generator functions (`function*`) to create an iterator-based execution model. Each evaluation step yields control, allowing the caller (Trampoline) to handle async operations and debugging breakpoints.

### Key Characteristics

- **Execution Step Type**: `Generator<YieldCommand, T, unknown>`
- **Yield Commands**: `Eval`, `Call`, `IO`, `DebugPause`, `Complete`
- **State Management**: Implicit in generator closure (local variables)
- **Hot Path**: Generator iteration (potentially faster than async/await)

### Architecture

```typescript
type ExecutionStep<T> = Generator<YieldCommand, T, unknown>;

class GeneratorEvaluator {
    *evaluate(node: ExpressionNode): ExecutionStep<unknown> {
        switch (node.type) {
            case 'BinaryExpression':
                return yield* this.evaluateBinaryExpression(node);
            case 'CallExpression':
                return yield* this.evaluateCallExpression(node);
            // ...
        }
    }

    *evaluateBinaryExpression(node: BinaryExpressionNode): ExecutionStep<unknown> {
        const left = yield* this.evaluate(node.left);   // Recursive generator delegation
        const right = yield* this.evaluate(node.right);
        
        // Check for debugger breakpoint
        if (this.shouldPause(node)) {
            yield { type: 'debug_pause', location: node.loc };
        }
        
        return this.applyOperator(left, right, node.operator);
    }

    *evaluateCallExpression(node: CallExpressionNode): ExecutionStep<unknown> {
        // Evaluate arguments
        const args: unknown[] = [];
        for (const arg of node.args) {
            args.push(yield* this.evaluate(arg));
        }
        
        // Yield syscall for external handling
        const result = yield { type: 'call', callee: node.callee, args };
        return result;
    }
}
```

### Trampoline Integration

```typescript
class TrampolineRunner {
    async run<T>(generator: ExecutionStep<T>): Promise<T> {
        let iter = generator;
        let result = iter.next();
        
        while (!result.done) {
            const command = result.value;
            
            switch (command.type) {
                case 'call':
                    const callResult = await this.handleFunctionCall(command);
                    result = iter.next(callResult);
                    break;
                case 'io_input':
                    const input = await this.io.read();
                    result = iter.next(input);
                    break;
                case 'debug_pause':
                    await this.debugger.pause(command.location);
                    result = iter.next();
                    break;
                // ...
            }
        }
        
        return result.value;
    }
}
```

### Pros

- **Cleaner code**: No separate sync/async paths; recursion handled via `yield*`
- **Natural debugging**: Can yield at any point for debugger integration
- **Potential performance**: Generators may have less overhead than async/await
- **Compatibility**: Works in environments with limited async support (e.g., QuickJS)

### Cons

- **Deep recursion still problematic**: Deeply nested expressions can overflow the generator stack
- **State inspection harder**: Local variables are in closure, harder to inspect than explicit context
- **QuickJS compatibility concerns**: Some JS engines have incomplete generator support
- **Learning curve**: Generator syntax can be confusing for developers unfamiliar with it

### Best For

- Projects prioritizing code clarity over extreme depth handling
- Environments where async/await overhead is a concern
- Cases where debugging integration is complex with async code

---

## Design 2: Syscall-Style Execution Model

### Concept

Treat the interpreter as a pure computation that may need to request services from the "kernel" (Trampoline). The interpreter never performs async operations directly; instead, it returns a "syscall" request and a continuation function to resume computation.

### Key Characteristics

- **Execution Result**: Either a value or a syscall request
- **Continuations**: Explicit functions that accept syscall result and continue execution
- **State Management**: Explicit in ExecutionContext (stack, environment, etc.)
- **Hot Path**: Synchronous evaluation (no microtask queue involvement)

### Architecture

```typescript
type ExecutionResult<T> =
    | { kind: 'value'; value: T }
    | { kind: 'syscall'; call: Syscall; resume: (result: unknown) => ExecutionResult<T> };

interface Syscall {
    type: 'io_input' | 'io_output' | 'call_function' | 'debug_pause';
    data: unknown;
    loc: SourceLocation;
}

class SyscallEvaluator {
    evaluate(node: AstNode, ctx: ExecutionContext): ExecutionResult<unknown> {
        switch (node.type) {
            case 'BinaryExpression':
                return this.evalBinaryExpression(node, ctx);
            case 'CallExpression':
                return this.evalCallExpression(node, ctx);
            // ...
        }
    }

    private evalBinaryExpression(node: BinaryExpressionNode, ctx: ExecutionContext): ExecutionResult<unknown> {
        // Evaluate left operand
        const leftResult = this.evaluate(node.left, ctx);
        if (leftResult.kind === 'syscall') {
            // Propagate syscall, chain continuation
            return {
                kind: 'syscall',
                call: leftResult.call,
                resume: (result) => {
                    const leftValue = leftResult.resume(result);
                    if (leftValue.kind === 'syscall') return leftValue;
                    
                    // Now evaluate right with left value in context
                    return this.evalRightOperand(node, ctx, leftValue.value);
                }
            };
        }
        
        return this.evalRightOperand(node, ctx, leftResult.value);
    }

    private evalCallExpression(node: CallExpressionNode, ctx: ExecutionContext): ExecutionResult<unknown> {
        // Evaluate all arguments
        const args: unknown[] = [];
        let current = 0;
        
        const evalNextArg = (): ExecutionResult<unknown> => {
            if (current >= node.args.length) {
                // All args ready, make syscall
                return {
                    kind: 'syscall',
                    call: {
                        type: 'call_function',
                        data: { name: node.callee, args }
                    },
                    resume: (result) => ({ kind: 'value', value: result })
                };
            }
            
            const argResult = this.evaluate(node.args[current], ctx);
            if (argResult.kind === 'syscall') {
                return {
                    kind: 'syscall',
                    call: argResult.call,
                    resume: (result) => {
                        const value = argResult.resume(result);
                        if (value.kind === 'syscall') return value;
                        args.push(value.value);
                        current++;
                        return evalNextArg();
                    }
                };
            }
            
            args.push(argResult.value);
            current++;
            return evalNextArg();
        };
        
        return evalNextArg();
    }
}
```

### Trampoline Integration

```typescript
class SyscallTrampoline {
    async run<T>(initialResult: ExecutionResult<T>): Promise<T> {
        let result = initialResult;
        
        while (result.kind === 'syscall') {
            const syscallResult = await this.handleSyscall(result.call);
            result = result.resume(syscallResult);
        }
        
        return result.value;
    }

    private async handleSyscall(call: Syscall): Promise<unknown> {
        switch (call.type) {
            case 'io_input':
                return await this.io.read();
            case 'call_function':
                return await this.callExternalFunction(call.data);
            case 'debug_pause':
                await this.debugger.pause(call.loc);
                return undefined;
            // ...
        }
    }
}
```

### Pros

- **Explicit control flow**: Continuations make execution flow very clear
- **No implicit async**: Hot path is purely synchronous
- **Stackless**: Can handle arbitrary depth without stack overflow
- **Easy to serialize**: Execution state (context + continuation) can be serialized

### Cons

- **Callback hell**: Deep nesting of continuations can be hard to read
- **Manual state management**: Need to explicitly pass state through continuations
- **Performance overhead**: Creating closure chains for continuations has cost
- **Complex debugging**: Harder to step through than direct code

### Best For

- Systems requiring serialization of execution state
- Extreme depth scenarios (very deep expression trees)
- Cases where async overhead must be minimized

---

## Design 3: Stateless Interpreter + Stateful Trampoline

### Concept

Separate concerns strictly: the Interpreter is completely stateless and only evaluates one step at a time. The Trampoline maintains all state (context) and drives the execution loop. When the Interpreter encounters an async operation, it returns a request and a "resume handler"; the Trampoline performs the operation and calls the handler to get the next step.

### Key Characteristics

- **Interpreter**: Pure function `step(context) -> StepResult`, no async, no recursion
- **Trampoline**: Maintains `ExecutionContext`, handles loop and async operations
- **Step Result**: Indicates what to do next (evaluate node, syscall, complete, error)
- **Resume Handler**: Function stored in context to handle syscall results

### Architecture

```typescript
interface ExecutionContext {
    valueStack: unknown[];
    env: Map<string, unknown>;
    currentNode: AstNode | null;
    resumeHandler: ((ctx: ExecutionContext, result: unknown) => ExecutionContext) | null;
}

interface StepResult {
    type: 'eval' | 'syscall' | 'complete' | 'error';
    ctx: ExecutionContext;
    node?: AstNode;           // For 'eval': which node to evaluate
    syscall?: Syscall;        // For 'syscall': what syscall to make
    error?: string;           // For 'error': error message
}

class StatelessInterpreter {
    // Pure function: evaluates one step, returns what to do next
    step(ctx: ExecutionContext): StepResult {
        // If we have a node to evaluate, do so
        if (ctx.currentNode) {
            return this.evalNode(ctx, ctx.currentNode);
        }
        
        // No node to evaluate - check for completion
        return {
            type: 'complete',
            ctx,
            result: ctx.valueStack[ctx.valueStack.length - 1]
        };
    }

    // Resume after syscall completes
    resume(ctx: ExecutionContext, result: unknown): StepResult {
        if (ctx.resumeHandler) {
            const nextCtx = ctx.resumeHandler(ctx, result);
            return { type: 'eval', ctx: nextCtx, node: nextCtx.currentNode };
        }
        
        // No handler, just push result and continue
        return {
            type: 'eval',
            ctx: {
                ...ctx,
                valueStack: [...ctx.valueStack, result],
                resumeHandler: null
            },
            node: null
        };
    }

    private evalNode(ctx: ExecutionContext, node: AstNode): StepResult {
        switch (node.type) {
            case 'Literal':
                return {
                    type: 'eval',
                    ctx: {
                        ...ctx,
                        valueStack: [...ctx.valueStack, node.value],
                        currentNode: null
                    },
                    node: null
                };

            case 'BinaryExpression':
                return this.setupBinaryExpression(ctx, node);

            case 'CallExpression':
                return this.setupCallExpression(ctx, node);
        }
    }

    private setupBinaryExpression(ctx: ExecutionContext, node: BinaryExpressionNode): StepResult {
        // State machine: Phase 1 - evaluate left
        return {
            type: 'eval',
            ctx: {
                ...ctx,
                currentNode: node.left,
                resumeHandler: (ctx2, leftValue) => {
                    // Phase 2: Left done, evaluate right
                    return {
                        ...ctx2,
                        valueStack: [...ctx2.valueStack, leftValue],
                        currentNode: node.right,
                        resumeHandler: (ctx3, rightValue) => {
                            // Phase 3: Apply operator
                            const stack = ctx3.valueStack;
                            const left = stack[stack.length - 1];
                            const result = this.applyOp(left, rightValue, node.operator);
                            return {
                                ...ctx3,
                                valueStack: [...stack.slice(0, -1), result],
                                currentNode: null,
                                resumeHandler: null
                            };
                        }
                    };
                }
            },
            node: node.left
        };
    }

    private setupCallExpression(ctx: ExecutionContext, node: CallExpressionNode): StepResult {
        // Similar state machine for evaluating arguments and making call
        // ...
    }
}
```

### Trampoline Integration

```typescript
class StatefulTrampoline {
    async run(interpreter: StatelessInterpreter, node: AstNode): Promise<unknown> {
        let ctx = this.createInitialContext(node);
        let step = interpreter.step(ctx);

        while (step.type !== 'complete' && step.type !== 'error') {
            if (step.type === 'syscall') {
                const result = await this.handleSyscall(step.syscall!);
                step = interpreter.resume(step.ctx, result);
            } else if (step.type === 'eval') {
                if (step.node) {
                    step = interpreter.step(step.ctx);
                } else {
                    // No node to evaluate, let interpreter decide next step
                    step = interpreter.step(step.ctx);
                }
            }
        }

        if (step.type === 'error') {
            throw new Error(step.error);
        }

        return step.result;
    }

    private async handleSyscall(call: Syscall): Promise<unknown> {
        // Same as other designs
    }
}
```

### Pros

- **Strict separation of concerns**: Interpreter is pure, Trampoline handles all state
- **No recursion at all**: Interpreter never calls itself
- **Maximally testable**: Interpreter steps can be unit tested in isolation
- **Easy to add features**: New node types just return different StepResults
- **Serialization friendly**: Context can be serialized (if resumeHandler is serializable)

### Cons

- **Complex state machine**: Managing execution flow via handlers can be confusing
- **Closure overhead**: Resume handlers are closures that capture state
- **Performance**: Creating new context objects each step may have GC overhead
- **Not intuitive**: Different mental model from typical interpreters

### Best For

- Systems requiring execution state persistence/serialization
- Highly testable interpreter requirements
- Scenarios where strict separation of pure/impure code is desired

---

## Comparison Summary

| Aspect | Generator | Syscall | Stateless+Trampoline |
|--------|-----------|---------|---------------------|
| **Code Clarity** | Good | Fair | Fair |
| **Stack Safety** | Poor | Excellent | Excellent |
| **Performance** | Good | Good | Fair |
| **Testability** | Good | Good | Excellent |
| **Debug Integration** | Excellent | Good | Good |
| **Serialization** | Poor | Good | Excellent |
| **Learning Curve** | Medium | Medium | High |
| **QuickJS Compatible** | Needs testing | Yes | Yes |

---

## Recommendation

For the CPC interpreter:

1. **If QuickJS generator support is confirmed good**: Use **Generator-Based Model** for cleaner code and easier debugging.

2. **If generator support is problematic**: Use **Syscall-Style Model** as a fallback - it provides similar benefits without generator dependencies.

3. **If execution state serialization is required**: Use **Stateless+Trampoline Model** for maximum flexibility.

The current async/await approach could be refactored to any of these three models to reduce the code redundancy between sync and async evaluation paths.
