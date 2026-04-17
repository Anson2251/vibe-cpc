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
import type { IOInterface } from "./io/io-interface";
import type { ProgramNode } from "./parser/ast-nodes";
import { PseudocodeError, ErrorHandler } from "./errors";
import { InterpreterResult, toPseudocodeError } from "./result";
import { err } from "neverthrow";
import { DebuggerController } from "./runtime/debugger";

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
    debug?: boolean;
    maxExecutionSteps?: number;
    strictTypeChecking?: boolean;
}

/**
 * Execution result
 */
export interface ExecutionResult {
    success: boolean;
    output?: string;
    error?: PseudocodeError;
    executionTime?: number;
    steps?: number;
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

    constructor(io: IOInterface, options: InterpreterOptions = {}) {
        this.io = io;
        this.options = {
            debug: false,
            maxExecutionSteps: 10000,
            strictTypeChecking: true,
            ...options,
        };
        this.errorHandler = new ErrorHandler(io);
    }

    /**
     * Execute a pseudocode program from source code
     */
    /**
     * Executes the provided source code and returns the execution result
     * @param sourceCode - The pseudocode to be executed
     * @returns A Promise that resolves to an ExecutionResult object
     */
    async execute(sourceCode: string): Promise<ExecutionResult> {
        // Unescape any escaped characters in the source code
        sourceCode = unescapeString(sourceCode);
        const startTime = Date.now(); // Record the start time for execution metrics
        this.executionSteps = 0; // Reset execution step counter

        const strictMode = detectStrictMode(sourceCode);

        const parseResult = this.parseResult(sourceCode);
        if (parseResult.isErr()) {
            return this.buildErrorResult(parseResult.error, startTime);
        }

        const ast = parseResult.value;

        let linkedAst = ast;
        let namespaceImports: import("./runtime/linker").ImportInfo[] = [];

        if (!strictMode) {
            const linker = new Linker(this.io);
            linkedAst = await linker.link(ast);
            namespaceImports = linker.getImports();
        }

        if (this.options.debug) {
            this.io.output(`AST: ${JSON.stringify(linkedAst, null, 2)}\n`);
            this.io.output("Evaluating...\n");
        }

        const evaluator = new Evaluator(this.io, strictMode);
        this.currentEvaluator = evaluator;
        evaluator.setDebuggerController(this.debuggerController);
        evaluator.setNamespaceImports(namespaceImports);

        let evalResult;
        let autoClosedFiles: string[] = [];
        try {
            evalResult = await evaluator.evaluateProgramR(linkedAst);
        } finally {
            autoClosedFiles = await evaluator.dispose();
            this.currentEvaluator = null;
        }

        if (autoClosedFiles.length > 0) {
            const quoted = autoClosedFiles.map((file) => `'${file}'`).join(", ");
            this.io.output(`Warning: Auto-closed file(s) not closed in program: ${quoted}\n`);
        }

        if (evalResult.isErr()) {
            return this.buildErrorResult(evalResult.error, startTime);
        }

        return this.buildSuccessResult(evalResult.value, startTime);
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

    private parseResult(sourceCode: string): InterpreterResult<ProgramNode> {
        try {
            if (this.options.debug) {
                this.io.output("Lexical analysis...\n");
            }

            const lexer = new Lexer(sourceCode);
            const tokens = lexer.tokenize();

            if (this.options.debug) {
                this.io.output(`Tokens: ${tokens.length}\n`);
                this.io.output(`Tokens: \n${tokens.map((token) => token.toString()).join("\n")}\n`);
                this.io.output("Parsing...\n");
            }

            const parser = new Parser(tokens);
            return parser.parse().mapErr((error): PseudocodeError => error);
        } catch (error) {
            return err(toPseudocodeError(error));
        }
    }

    private buildSuccessResult(result: unknown, startTime: number): ExecutionResult {
        return {
            success: true,
            output:
                result !== undefined
                    ? typeof result === "object" && result !== null
                        ? JSON.stringify(result)
                        : // eslint-disable-next-line @typescript-eslint/no-base-to-string
                          String(result)
                    : undefined,
            executionTime: Date.now() - startTime,
            steps: this.executionSteps,
        };
    }

    private buildErrorResult(error: PseudocodeError, startTime: number): ExecutionResult {
        if (this.options.debug) {
            console.error(error);
        }

        this.errorHandler.error(error.message, error.line, error.column);

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

        if (
            this.options.maxExecutionSteps !== undefined &&
            this.executionSteps > this.options.maxExecutionSteps
        ) {
            throw new PseudocodeError(
                `Maximum execution steps (${this.options.maxExecutionSteps}) exceeded`,
            );
        }
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
