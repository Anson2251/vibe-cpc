/**
 * CAIE Pseudocode Interpreter - Main Interpreter Class
 *
 * This module implements the main interpreter class that coordinates
 * the lexer, parser, and evaluator to execute pseudocode programs.
 */

import { Lexer } from "./lexer/lexer";
import { Parser } from "./parser/parser";
import { Evaluator } from "./runtime/evaluator";
import { Linker } from "./runtime/linker";
import { FrameTrampoline, FrameTrampolineDeps } from "./runtime/frame-trampoline";
import type { IOInterface } from "./io/io-interface";
import type { ProgramNode } from "./parser/ast-nodes";
import type { Token } from "./lexer/tokens";
import { PseudocodeError, ErrorHandler } from "./errors";
import { InterpreterResult, toPseudocodeError } from "./result";
import { err } from "neverthrow";
import { DebuggerController } from "./runtime/debugger";
import { Environment } from "./runtime/environment";
import { Heap } from "./runtime/heap";
import { builtInFunctions } from "./runtime/builtin-functions";
import type { RoutineInfo } from "./runtime/environment";
import type { UserDefinedTypeInfo, EnumTypeInfo, SetTypeInfo, PointerTypeInfo, ClassTypeInfo } from "./types";
import type { RuntimeMethodInfo } from "./parser/ast-nodes";
import type { ImportInfo } from "./runtime/linker";

function unescapeString(str: string) {
    const escapes: Record<string, string> = {
        n: "\n",
        t: "\t",
        r: "\r",
        b: "\b",
        f: "\f",
        '"': '"',
        "'": "'",
        "\\": "\\",
    };
    return str.replace(/\\([nrtbf'"\\])/g, (_, char: string) =>
        Object.prototype.hasOwnProperty.call(escapes, char) ? escapes[char] : char,
    );
}

function detectStrictMode(sourceCode: string): boolean {
    const firstLine = sourceCode.trim().split("\n")[0].trim();
    return firstLine.includes("CAIE_ONLY");
}

/**
 * Interpreter options
 */
export interface InterpreterOptions {
    strictTypeChecking?: boolean;
}

/**
 * Execution result
 */
export interface ExecutionResult {
    success: boolean;
    error?: PseudocodeError;
    executionTime?: number;
    steps?: number;
}

export interface AnalyzeResult {
    success: boolean;
    tokens?: Array<{ type: string; value: unknown; line: number; column: number }>;
    ast?: ProgramNode;
    error?: PseudocodeError;
}

/**
 * Main interpreter class for CAIE pseudocode
 */
export class Interpreter {
    private io: IOInterface;
    private options: InterpreterOptions;
    private errorHandler: ErrorHandler;
    private executionSteps: number = 0;
    private debuggerController?: DebuggerController;
    private currentEvaluator: Evaluator | null = null;
    private useFrameEvaluator: boolean = true;

    constructor(io: IOInterface, options: InterpreterOptions = {}) {
        this.io = io;
        this.options = {
            strictTypeChecking: true,
            ...options,
        };
        this.errorHandler = new ErrorHandler(io);
    }

    async execute(sourceCode: string): Promise<ExecutionResult> {
        sourceCode = unescapeString(sourceCode);
        const startTime = Date.now();
        this.executionSteps = 0;

        const strictMode = detectStrictMode(sourceCode);

        const parseResult = this.parseResult(sourceCode);
        if (parseResult.isErr()) {
            return this.buildErrorResult(parseResult.error, startTime);
        }

        const ast = parseResult.value;

        let linkedAst = ast;
        let namespaceImports: ImportInfo[] = [];

        if (!strictMode) {
            const linker = new Linker(this.io);
            linkedAst = await linker.link(ast);
            namespaceImports = linker.getImports();
        }

        try {
            if (this.useFrameEvaluator) {
                await this.executeWithFrameEvaluator(linkedAst, strictMode, namespaceImports);
            } else {
                await this.executeWithLegacyEvaluator(linkedAst, strictMode, namespaceImports);
            }
        } catch (error) {
            return this.buildErrorResult(toPseudocodeError(error), startTime);
        }

        return this.buildSuccessResult(undefined, startTime);
    }

    private async executeWithFrameEvaluator(
        ast: ProgramNode,
        strictMode: boolean,
        namespaceImports: ImportInfo[],
    ): Promise<void> {
        const heap = new Heap();
        const environment = new Environment(heap);

        const globalRoutines = new Map<string, RoutineInfo>();
        const userDefinedTypes = new Map<string, UserDefinedTypeInfo>();
        const enumTypes = new Map<string, EnumTypeInfo>();
        const setTypes = new Map<string, SetTypeInfo>();
        const pointerTypes = new Map<string, PointerTypeInfo>();
        const classDefinitions = new Map<string, ClassTypeInfo>();
        const classMethodBodies = new Map<string, Map<string, RuntimeMethodInfo>>();
        const namespaceImportsMap = new Map<string, ImportInfo>();

        for (const imp of namespaceImports) {
            if (imp.namespace) {
                namespaceImportsMap.set(imp.namespace, imp);
            }
        }

        for (const [name, fnInfo] of Object.entries(builtInFunctions)) {
            globalRoutines.set(name, {
                name,
                ...fnInfo,
            });
        }

        const deps: FrameTrampolineDeps = {
            io: this.io,
            strictMode,
            globalRoutines,
            userDefinedTypes,
            enumTypes,
            setTypes,
            pointerTypes,
            classDefinitions,
            classMethodBodies,
            namespaceImports: namespaceImportsMap,
            debuggerController: this.debuggerController,
            onStep: () => {
                this.incrementExecutionSteps();
            },
        };

        const trampoline = new FrameTrampoline(deps);
        await trampoline.run(ast);
    }

    private async executeWithLegacyEvaluator(
        ast: ProgramNode,
        strictMode: boolean,
        namespaceImports: ImportInfo[],
    ): Promise<void> {
        const evaluator = new Evaluator(this.io, strictMode);
        this.currentEvaluator = evaluator;
        evaluator.setDebuggerController(this.debuggerController);
        evaluator.setOnStep(() => {
            this.incrementExecutionSteps();
        });
        evaluator.setNamespaceImports(namespaceImports);

        let autoClosedFiles: string[] = [];
        try {
            await evaluator.evaluateProgramR(ast);
        } finally {
            autoClosedFiles = await evaluator.dispose();
            this.currentEvaluator = null;
        }

        if (autoClosedFiles.length > 0) {
            const quoted = autoClosedFiles.map((file) => `'${file}'`).join(", ");
            this.io.output(`Warning: Auto-closed file(s) not closed in program: ${quoted}\n`);
        }
    }

    /**
     * Execute a pseudocode program from a file
     */
    async executeFile(filePath: string): Promise<ExecutionResult> {
        const startTime = Date.now();
        try {
            const sourceCode = await this.io.readFile(filePath);
            return await this.execute(sourceCode);
        } catch (error) {
            return this.buildErrorResult(toPseudocodeError(error), startTime);
        }
    }

    /**
     * Parse source code into an AST without executing it
     */
    parse(sourceCode: string): ProgramNode {
        const result = this.parseResult(sourceCode);
        if (result.isErr()) {
            throw result.error;
        }
        return result.value;
    }

    /**
     * Analyze source code: lex and parse, returning tokens and AST
     */
    analyze(sourceCode: string): AnalyzeResult {
        sourceCode = unescapeString(sourceCode);

        try {
            const lexer = new Lexer(sourceCode);
            const tokens = lexer.tokenize();

            const parser = new Parser(tokens);
            const parseResult = parser.parse();

            if (parseResult.isErr()) {
                return {
                    success: false,
                    tokens: tokens.map((t: Token) => ({
                        type: t.type,
                        value: t.value,
                        line: t.line,
                        column: t.column,
                    })),
                    error: parseResult.error,
                };
            }

            return {
                success: true,
                tokens: tokens.map((t: Token) => ({
                    type: t.type,
                    value: t.value,
                    line: t.line,
                    column: t.column,
                })),
                ast: parseResult.value,
            };
        } catch (error) {
            return {
                success: false,
                error: toPseudocodeError(error),
            };
        }
    }

    private parseResult(sourceCode: string): InterpreterResult<ProgramNode> {
        try {
            const lexer = new Lexer(sourceCode);
            const tokens = lexer.tokenize();

            const parser = new Parser(tokens);
            return parser.parse().mapErr((error): PseudocodeError => error);
        } catch (error) {
            return err(toPseudocodeError(error));
        }
    }

    private buildSuccessResult(result: unknown, startTime: number): ExecutionResult {
        return {
            success: true,
            executionTime: Date.now() - startTime,
            steps: this.executionSteps,
        };
    }

    private buildErrorResult(error: PseudocodeError, startTime: number): ExecutionResult {
        return {
            success: false,
            error,
            executionTime: Date.now() - startTime,
            steps: this.executionSteps,
        };
    }

    /**
     * Get the current execution step count
     */
    getExecutionSteps(): number {
        return this.executionSteps;
    }

    /**
     * Reset the execution step counter
     */
    resetExecutionSteps(): void {
        this.executionSteps = 0;
    }

    /**
     * Increment the execution step counter and check if we've exceeded the maximum
     */
    incrementExecutionSteps(): void {
        this.executionSteps++;
    }

    /**
     * Set interpreter options
     */
    setOptions(options: Partial<InterpreterOptions>): void {
        this.options = { ...this.options, ...options };
    }

    attachDebugger(controller: DebuggerController): void {
        this.debuggerController = controller;
    }

    detachDebugger(): void {
        this.debuggerController = undefined;
    }

    getDebuggerController(): DebuggerController | undefined {
        return this.debuggerController;
    }

    /**
     * Get current interpreter options
     */
    getOptions(): InterpreterOptions {
        return { ...this.options };
    }

    /**
     * Dispose of resources used by the interpreter
     */
    async dispose() {
        if (this.currentEvaluator) {
            await this.currentEvaluator.dispose();
            this.currentEvaluator = null;
        }
        await this.io.dispose();
    }
}
