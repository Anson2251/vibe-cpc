// PoC: Stateless Interpreter + Stateful Trampoline (No Recursion)
// All state in Trampoline, Interpreter is pure and stateless

// ============ Types ============
interface SourceLocation {
    line: number;
    column: number;
}

// The ONLY state - stored in Trampoline
interface ExecutionContext {
    valueStack: unknown[];
    env: Map<string, unknown>;
    currentNode: AstNode | null;
    // For resuming after syscall
    resumeWith: ((ctx: ExecutionContext, result: unknown) => ExecutionContext) | null;
}

interface Syscall {
    type: 'io_input' | 'io_output' | 'call_function';
    data: unknown;
    loc: SourceLocation;
}

interface ExecutionStep {
    type: 'step' | 'syscall' | 'complete' | 'error';
    ctx: ExecutionContext;
    syscall?: Syscall;
    result?: unknown;
    error?: string;
}

// ============ AST ============
interface BinaryExpressionNode {
    type: 'BinaryExpression';
    operator: string;
    left: AstNode;
    right: AstNode;
    line: number;
    column: number;
}

interface CallExpressionNode {
    type: 'CallExpression';
    callee: string;
    args: AstNode[];
    line: number;
    column: number;
}

interface LiteralNode {
    type: 'Literal';
    value: unknown;
}

interface IdentifierNode {
    type: 'Identifier';
    name: string;
}

type AstNode = BinaryExpressionNode | CallExpressionNode | LiteralNode | IdentifierNode;

// ============ Stateless Interpreter ============
// PURE FUNCTION: takes context, returns next step
// No async, no recursion, no state mutation

class StatelessInterpreter {
    // Entry: evaluate a node completely
    eval(ctx: ExecutionContext, node: AstNode): ExecutionStep {
        switch (node.type) {
            case 'Literal':
                return {
                    type: 'step',
                    ctx: {
                        ...ctx,
                        valueStack: [...ctx.valueStack, node.value],
                        currentNode: node
                    }
                };

            case 'Identifier':
                return {
                    type: 'step',
                    ctx: {
                        ...ctx,
                        valueStack: [...ctx.valueStack, ctx.env.get(node.name)],
                        currentNode: node
                    }
                };

            case 'BinaryExpression':
                return this.evalBinaryExpression(ctx, node);

            case 'CallExpression':
                return this.evalCallExpression(ctx, node);
        }
    }

    // Resume after syscall completes
    resume(ctx: ExecutionContext, result: unknown): ExecutionStep {
        if (ctx.resumeWith) {
            const nextCtx = ctx.resumeWith(ctx, result);
            return { type: 'step', ctx: nextCtx };
        }
        // No resume handler - push result and complete
        return {
            type: 'step',
            ctx: {
                ...ctx,
                valueStack: [...ctx.valueStack, result],
                resumeWith: null
            }
        };
    }

    private evalBinaryExpression(ctx: ExecutionContext, node: BinaryExpressionNode): ExecutionStep {
        // State machine for binary expression evaluation
        // Phase 1: Evaluate left
        // Phase 2: Evaluate right
        // Phase 3: Apply operator

        return {
            type: 'step',
            ctx: {
                ...ctx,
                currentNode: node,
                resumeWith: (ctx2, leftValue) => {
                    // Phase 2: Left done, now evaluate right
                    return {
                        ...ctx2,
                        valueStack: [...ctx2.valueStack, leftValue],
                        resumeWith: (ctx3, rightValue) => {
                            // Phase 3: Both done, apply operator
                            const stack = [...ctx3.valueStack, rightValue];
                            const right = stack[stack.length - 1];
                            const left = stack[stack.length - 2];
                            const result = this.applyOp(left, right, node.operator);
                            return {
                                ...ctx3,
                                valueStack: [...stack.slice(0, -2), result],
                                resumeWith: null
                            };
                        }
                    };
                }
            }
        };
    }

    private evalCallExpression(ctx: ExecutionContext, node: CallExpressionNode): ExecutionStep {
        if (node.args.length === 0) {
            return {
                type: 'syscall',
                ctx: { ...ctx, resumeWith: null },
                syscall: {
                    type: 'call_function',
                    data: { name: node.callee, args: [] },
                    loc: { line: node.line, column: node.column }
                }
            };
        }

        // Evaluate arguments one by one using state machine
        const args: unknown[] = [];

        const createArgEvaluator = (index: number): ((ctx: ExecutionContext, val: unknown) => ExecutionContext) => {
            if (index >= node.args.length) {
                // All args evaluated, make the call
                return (ctx2, val) => ({
                    ...ctx2,
                    valueStack: ctx2.valueStack,
                    resumeWith: (ctx3, result) => ({
                        ...ctx3,
                        valueStack: [...ctx3.valueStack, result],
                        resumeWith: null
                    })
                });
            }

            return (ctx2, val) => {
                args.push(val);
                return {
                    ...ctx2,
                    resumeWith: createArgEvaluator(index + 1)
                };
            };
        };

        return {
            type: 'step',
            ctx: {
                ...ctx,
                currentNode: node,
                resumeWith: createArgEvaluator(0)
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

    createContext(node: AstNode): ExecutionContext {
        const env = new Map<string, unknown>();
        env.set('x', 10);
        env.set('y', 20);

        return {
            valueStack: [],
            env,
            currentNode: node,
            resumeWith: null
        };
    }
}

// ============ Trampoline ============
class TrampolineRunner {
    private callCount = 0;

    async run(interpreter: StatelessInterpreter, initialNode: AstNode): Promise<unknown> {
        let ctx = interpreter.createContext(initialNode);
        let step = interpreter.eval(ctx, initialNode);

        while (step.type !== 'complete' && step.type !== 'error') {
            if (step.type === 'syscall') {
                const result = await this.handleSyscall(step.syscall!);
                step = interpreter.resume(step.ctx, result);
            } else if (step.type === 'step') {
                // Continue evaluation
                if (step.ctx.resumeWith && step.ctx.currentNode) {
                    // Need to evaluate child node
                    const childNode = step.ctx.currentNode;
                    // Check if we have a child to evaluate (for binary/call expressions)
                    // This is where we'd determine which child to evaluate next
                    // For simplicity, let's just complete for now
                    step = { type: 'complete', ctx: step.ctx, result: step.ctx.valueStack[step.ctx.valueStack.length - 1] };
                } else {
                    step = { type: 'complete', ctx: step.ctx, result: step.ctx.valueStack[step.ctx.valueStack.length - 1] };
                }
            }
        }

        if (step.type === 'error') {
            throw new Error(step.error);
        }

        return step.result;
    }

    private async handleSyscall(call: Syscall): Promise<unknown> {
        switch (call.type) {
            case 'io_input':
                console.log(`[IO INPUT] ${call.data}`);
                return "42";

            case 'io_output':
                console.log(`[IO OUTPUT] ${call.data}`);
                return undefined;

            case 'call_function':
                const callData = call.data as { name: string; args: unknown[] };
                this.callCount++;
                console.log(`[CALL] ${callData.name}(${callData.args.join(', ')})`);

                if (callData.name === 'Add') {
                    return (callData.args[0] as number) + (callData.args[1] as number);
                } else if (callData.name === 'Multiply') {
                    return (callData.args[0] as number) * (callData.args[1] as number);
                }
                return undefined;
        }
    }

    getCallCount(): number {
        return this.callCount;
    }
}

// ============ Tests ============
function createSimpleBinary(): BinaryExpressionNode {
    return {
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Identifier', name: 'y' },
        line: 1,
        column: 0
    };
}

async function runTests(): Promise<void> {
    console.log('=== Stateless Interpreter + Trampoline ===\n');

    const interpreter = new StatelessInterpreter();
    const runner = new TrampolineRunner();

    console.log('Test 1: Binary Expression');
    const result1 = await runner.run(interpreter, createSimpleBinary());
    console.log(`Result: ${result1} (expected: 30)`);
    console.log(`Pass: ${result1 === 30}\n`);

    console.log('=== Tests Complete ===');
}

runTests().catch(console.error);
