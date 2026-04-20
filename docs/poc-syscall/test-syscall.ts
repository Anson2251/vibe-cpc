// PoC: Syscall-style Execution Model
// Evaluator is pure sync, Trampoline handles async via "system calls"

// ============ Types ============
interface SourceLocation {
    line: number;
    column: number;
}

// System call types - Evaluator requests these, Trampoline handles them
type Syscall =
    | { type: 'io_input'; prompt: string; loc: SourceLocation }
    | { type: 'io_output'; data: string; loc: SourceLocation }
    | { type: 'debug_pause'; loc: SourceLocation; snapshot: unknown }
    | { type: 'call_function'; name: string; args: unknown[]; loc: SourceLocation }
    | { type: 'file_operation'; op: string; data: unknown };

// Execution result: either a value or a syscall request
type ExecutionResult<T> =
    | { kind: 'value'; value: T }
    | { kind: 'syscall'; call: Syscall; resume: (result: unknown) => ExecutionResult<T> };

// ============ Evaluator (Pure Sync) ============
// The Evaluator NEVER uses async/await or Promises
// It only returns ExecutionResult that may contain a syscall

class SyscallEvaluator {
    private env: Map<string, unknown>;

    constructor() {
        this.env = new Map();
        this.env.set('x', 10);
        this.env.set('y', 20);
    }

    // Main evaluation - returns ExecutionResult, not Promise
    evaluate(node: AstNode): ExecutionResult<unknown> {
        switch (node.type) {
            case 'BinaryExpression':
                return this.evalBinaryExpression(node);
            case 'CallExpression':
                return this.evalCallExpression(node);
            case 'InputStatement':
                return this.evalInput(node);
            case 'OutputStatement':
                return this.evalOutput(node);
            case 'Literal':
                return { kind: 'value', value: node.value };
            case 'Identifier':
                return { kind: 'value', value: this.env.get(node.name) };
            default:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                throw new Error(`Unknown node: ${(node as any).type}`);
        }
    }

    // Binary expression: if either operand needs syscall, we chain them
    private evalBinaryExpression(node: BinaryExpressionNode): ExecutionResult<unknown> {
        const leftResult = this.evaluate(node.left);

        if (leftResult.kind === 'syscall') {
            // Left operand needs async - chain the continuation
            return {
                kind: 'syscall',
                call: leftResult.call,
                resume: (value) => {
                    // After left completes, evaluate right
                    const rightResult = this.evaluate(node.right);
                    if (rightResult.kind === 'syscall') {
                        return this.chainSyscall(rightResult, (rightValue) => ({
                            kind: 'value' as const,
                            value: this.applyOp(value, rightValue, node.operator)
                        }));
                    }
                    return {
                        kind: 'value',
                        value: this.applyOp(value, rightResult.value, node.operator)
                    };
                }
            };
        }

        // Left is synchronous value
        const rightResult = this.evaluate(node.right);
        if (rightResult.kind === 'syscall') {
            return this.chainSyscall(rightResult, (rightValue) => ({
                kind: 'value' as const,
                value: this.applyOp(leftResult.value, rightValue, node.operator)
            }));
        }

        // Both synchronous
        return {
            kind: 'value',
            value: this.applyOp(leftResult.value, rightResult.value, node.operator)
        };
    }

    // Function call: always generates syscall (for debugger/IO tracking)
    private evalCallExpression(node: CallExpressionNode): ExecutionResult<unknown> {
        // Evaluate arguments first
        const argResults: ExecutionResult<unknown>[] = [];
        for (const arg of node.args) {
            argResults.push(this.evaluate(arg));
        }

        // Check if any argument needs syscall
        const pendingIndex = argResults.findIndex(r => r.kind === 'syscall');
        if (pendingIndex >= 0) {
            // Chain argument evaluation
            return this.chainArgEvaluation(argResults, pendingIndex, (args) =>
                this.makeCallSyscall(node, args)
            );
        }

        // All arguments ready
        const args = argResults.map(r => (r as { kind: 'value'; value: unknown }).value);
        return this.makeCallSyscall(node, args);
    }

    private makeCallSyscall(node: CallExpressionNode, args: unknown[]): ExecutionResult<unknown> {
        return {
            kind: 'syscall',
            call: {
                type: 'call_function',
                name: node.callee,
                args,
                loc: { line: node.line, column: node.column }
            },
            resume: (result) => ({ kind: 'value', value: result })
        };
    }

    // Input statement: generates io_input syscall
    private evalInput(node: InputNode): ExecutionResult<unknown> {
        return {
            kind: 'syscall',
            call: {
                type: 'io_input',
                prompt: node.prompt,
                loc: { line: node.line, column: node.column }
            },
            resume: (value) => {
                this.env.set(node.varName, value);
                return { kind: 'value', value: undefined };
            }
        };
    }

    // Output statement: generates io_output syscall
    private evalOutput(node: OutputNode): ExecutionResult<unknown> {
        const exprResult = this.evaluate(node.expression);

        if (exprResult.kind === 'syscall') {
            return this.chainSyscall(exprResult, (value) => ({
                kind: 'syscall',
                call: {
                    type: 'io_output',
                    data: String(value),
                    loc: { line: node.line, column: node.column }
                },
                resume: () => ({ kind: 'value', value: undefined })
            }));
        }

        return {
            kind: 'syscall',
            call: {
                type: 'io_output',
                data: String(exprResult.value),
                loc: { line: node.line, column: node.column }
            },
            resume: () => ({ kind: 'value', value: undefined })
        };
    }

    // Helper: chain a syscall with a continuation
    private chainSyscall<T, U>(
        result: Extract<ExecutionResult<T>, { kind: 'syscall' }>,
        continuation: (value: T) => ExecutionResult<U>
    ): ExecutionResult<U> {
        const originalResume = result.resume;
        return {
            kind: 'syscall',
            call: result.call,
            resume: (value) => continuation(originalResume(value) as T)
        };
    }

    // Helper: chain argument evaluation
    private chainArgEvaluation(
        results: ExecutionResult<unknown>[],
        startIndex: number,
        finalAction: (args: unknown[]) => ExecutionResult<unknown>
    ): ExecutionResult<unknown> {
        const pendingResult = results[startIndex] as Extract<ExecutionResult<unknown>, { kind: 'syscall' }>;
        const originalResume = pendingResult.resume;

        return {
            kind: 'syscall',
            call: pendingResult.call,
            resume: (value) => {
                // Update the completed argument
                results[startIndex] = originalResume(value);

                // Check for more pending arguments
                const nextPending = results.findIndex((r, i) => i > startIndex && r.kind === 'syscall');
                if (nextPending >= 0) {
                    return this.chainArgEvaluation(results, nextPending, finalAction);
                }

                // All arguments complete
                const args = results.map(r => (r as { kind: 'value'; value: unknown }).value);
                return finalAction(args);
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
}

// ============ Trampoline (Handles Async) ============
class TrampolineRunner {
    private paused = false;
    private resumeResolver?: () => void;
    private breakpoints: Set<number> = new Set();
    private callCount = 0;

    setBreakpoints(lines: number[]): void {
        this.breakpoints = new Set(lines);
    }

    // Main entry: runs the execution result until completion
    async run<T>(initialResult: ExecutionResult<T>): Promise<T> {
        let current: ExecutionResult<T> = initialResult;

        while (current.kind === 'syscall') {
            const result = await this.handleSyscall(current.call);
            current = current.resume(result) as ExecutionResult<T>;
        }

        return current.value;
    }

    private async handleSyscall(call: Syscall): Promise<unknown> {
        switch (call.type) {
            case 'io_input':
                console.log(`[IO INPUT] ${call.prompt}`);
                // Simulate user input
                return "42";

            case 'io_output':
                console.log(`[IO OUTPUT] ${call.data}`);
                return undefined;

            case 'debug_pause':
                if (this.breakpoints.has(call.loc.line)) {
                    console.log(`[DEBUG] Paused at line ${call.loc.line}`);
                    await this.waitForResume();
                }
                return undefined;

            case 'call_function':
                this.callCount++;
                console.log(`[CALL] ${call.name}(${call.args.join(', ')})`);
                // Mock function execution
                if (call.name === 'Add') {
                    return (call.args[0] as number) + (call.args[1] as number);
                } else if (call.name === 'Multiply') {
                    return (call.args[0] as number) * (call.args[1] as number);
                }
                return undefined;

            default:
                throw new Error(`Unknown syscall: ${(call as { type: string }).type}`);
        }
    }

    private async waitForResume(): Promise<void> {
        return new Promise(resolve => {
            this.resumeResolver = resolve;
            // In real implementation, would wait for debugger UI
            setTimeout(() => {
                this.resumeResolver = undefined;
                resolve();
            }, 10);
        });
    }

    getCallCount(): number {
        return this.callCount;
    }
}

// ============ AST Types ============
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

interface InputNode {
    type: 'InputStatement';
    prompt: string;
    varName: string;
    line: number;
    column: number;
}

interface OutputNode {
    type: 'OutputStatement';
    expression: AstNode;
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

type AstNode = BinaryExpressionNode | CallExpressionNode | InputNode | OutputNode | LiteralNode | IdentifierNode;

// ============ Test Cases ============
function createTestAST(): BinaryExpressionNode {
    // Expression: Add(x, y) * (x + y)
    return {
        type: 'BinaryExpression',
        operator: '*',
        left: {
            type: 'CallExpression',
            callee: 'Add',
            args: [
                { type: 'Identifier', name: 'x' },
                { type: 'Identifier', name: 'y' }
            ],
            line: 1,
            column: 0
        },
        right: {
            type: 'BinaryExpression',
            operator: '+',
            left: { type: 'Identifier', name: 'x' },
            right: { type: 'Identifier', name: 'y' },
            line: 1,
            column: 10
        },
        line: 1,
        column: 5
    };
}

function createNestedCallAST(): CallExpressionNode {
    // Expression: Multiply(Add(x, y), Add(y, x))
    return {
        type: 'CallExpression',
        callee: 'Multiply',
        args: [
            {
                type: 'CallExpression',
                callee: 'Add',
                args: [
                    { type: 'Identifier', name: 'x' },
                    { type: 'Identifier', name: 'y' }
                ],
                line: 2,
                column: 10
            },
            {
                type: 'CallExpression',
                callee: 'Add',
                args: [
                    { type: 'Identifier', name: 'y' },
                    { type: 'Identifier', name: 'x' }
                ],
                line: 2,
                column: 25
            }
        ],
        line: 2,
        column: 0
    };
}

function createIOAST(): OutputNode {
    // OUTPUT Add(x, y)
    return {
        type: 'OutputStatement',
        expression: {
            type: 'CallExpression',
            callee: 'Add',
            args: [
                { type: 'Identifier', name: 'x' },
                { type: 'Identifier', name: 'y' }
            ],
            line: 3,
            column: 7
        },
        line: 3,
        column: 0
    };
}

async function runTests(): Promise<void> {
    console.log('=== Syscall-style PoC Test ===\n');

    const evaluator = new SyscallEvaluator();
    const runner = new TrampolineRunner();

    // Test 1: Simple binary expression
    console.log('Test 1: Binary Expression (x + y)');
    const simpleExpr: BinaryExpressionNode = {
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Identifier', name: 'y' },
        line: 1,
        column: 0
    };

    const result1 = await runner.run(evaluator.evaluate(simpleExpr));
    console.log(`Result: ${result1} (expected: 30)`);
    console.log(`Pass: ${result1 === 30}\n`);

    // Test 2: Function call in binary expression
    console.log('Test 2: Function Call in Binary Expression');
    const complexExpr = createTestAST();
    const result2 = await runner.run(evaluator.evaluate(complexExpr));
    console.log(`Result: ${result2} (expected: 900)`);
    console.log(`Pass: ${result2 === 900}\n`);

    // Test 3: Nested function calls
    console.log('Test 3: Nested Function Calls');
    const nestedExpr = createNestedCallAST();
    const result3 = await runner.run(evaluator.evaluate(nestedExpr));
    console.log(`Result: ${result3} (expected: 900)`);
    console.log(`Call count: ${runner.getCallCount()}`);
    console.log(`Pass: ${result3 === 900}\n`);

    // Test 4: IO operation
    console.log('Test 4: IO Operation');
    const ioExpr = createIOAST();
    const result4 = await runner.run(evaluator.evaluate(ioExpr));
    console.log(`Result: ${result4} (expected: undefined)`);
    console.log(`Pass: ${result4 === undefined}\n`);

    // Test 5: Deep nesting
    console.log('Test 5: Deep Nesting');
    let deepExpr: AstNode = { type: 'Literal', value: 1 };
    for (let i = 0; i < 100; i++) {
        deepExpr = {
            type: 'BinaryExpression',
            operator: '+',
            left: deepExpr,
            right: { type: 'Literal', value: 1 },
            line: i + 1,
            column: 0
        };
    }

    const runner5 = new TrampolineRunner();
    const result5 = await runner5.run(evaluator.evaluate(deepExpr));
    console.log(`Result: ${result5} (expected: 101)`);
    console.log(`Pass: ${result5 === 101}\n`);

    console.log('=== All Tests Complete ===');
}

// Run tests
runTests().catch(console.error);
