import { type TypeInfo, VariableInfo } from "../types";
import { z } from "zod";

export type DebugPauseReason = "debugger-statement" | "step" | "breakpoint" | "error";

export interface DebugLocation {
    line?: number;
    column?: number;
}

export interface DebugVariable {
    name: string;
    type: string;
    typeInfo: TypeInfo;
    value: unknown;
    isConstant: boolean;
}

export interface DebugScope {
    scopeName: string;
    variables: DebugVariable[];
}

export interface DebugFrame {
    routineName: string;
    line?: number;
    column?: number;
}

export type DebugContext = Record<string, DebugVariable>;

export interface DebugSnapshot {
    reason: DebugPauseReason;
    location: DebugLocation;
    scopes: DebugScope[];
    callStack: DebugFrame[];
    heapSnapshot?: Map<number, { value: unknown; type: TypeInfo; refCount: number }>;
    error?: { message: string; line?: number; column?: number };
}

export type DebugBreakpointCondition = (snapshot: DebugSnapshot) => boolean;

export interface LineBreakpoint {
    line: number;
    condition?: DebugBreakpointCondition;
}

export interface BreakpointConditionValidationResult {
    valid: boolean;
    error?: string;
}

export type BreakpointConditionErrorCode =
    | "EMPTY_EXPRESSION"
    | "UNTERMINATED_STRING"
    | "UNEXPECTED_CHARACTER"
    | "UNEXPECTED_END"
    | "MISSING_RIGHT_PAREN"
    | "EXPECTED_IDENTIFIER_AFTER_DOT"
    | "EXPECTED_VALUE"
    | "UNEXPECTED_TRAILING_TOKEN"
    | "UNKNOWN";

export interface BreakpointConditionErrorDetails {
    code: BreakpointConditionErrorCode;
    message: string;
}

class ConditionSyntaxError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConditionSyntaxError";
    }
}

type ConditionTokenType =
    | "NUMBER"
    | "STRING"
    | "BOOLEAN"
    | "IDENTIFIER"
    | "LEFT_PAREN"
    | "RIGHT_PAREN"
    | "DOT"
    | "OPERATOR";

interface ConditionToken {
    type: ConditionTokenType;
    value: string | number | boolean;
}

function snapshotToContext(snapshot: DebugSnapshot): Record<string, unknown> {
    const context: Record<string, unknown> = {};
    for (const scope of snapshot.scopes) {
        for (const variable of scope.variables) {
            context[variable.name] = variable.value;
        }
    }
    return context;
}

const TypeNameSchema = z.object({ name: z.string() });
const TypeKindSchema = z.object({ kind: z.string() });
const ComparableValueSchema = z.union([z.string(), z.number()]);

function tokenizeConditionExpression(expression: string): ConditionToken[] {
    const tokens: ConditionToken[] = [];
    let i = 0;

    const isWhitespace = (char: string) => /\s/.test(char);
    const isDigit = (char: string) => /[0-9]/.test(char);
    const isIdentifierStart = (char: string) => /[A-Za-z_]/.test(char);
    const isIdentifierPart = (char: string) => /[A-Za-z0-9_]/.test(char);

    while (i < expression.length) {
        const char = expression[i];

        if (isWhitespace(char)) {
            i += 1;
            continue;
        }

        if (char === "(") {
            tokens.push({ type: "LEFT_PAREN", value: char });
            i += 1;
            continue;
        }

        if (char === ")") {
            tokens.push({ type: "RIGHT_PAREN", value: char });
            i += 1;
            continue;
        }

        if (char === ".") {
            tokens.push({ type: "DOT", value: char });
            i += 1;
            continue;
        }

        const twoChar = expression.slice(i, i + 2);
        if ([">=", "<=", "==", "!=", "<>", "&&", "||"].includes(twoChar)) {
            tokens.push({ type: "OPERATOR", value: twoChar });
            i += 2;
            continue;
        }

        if (["+", "-", "*", "/", "=", "<", ">", "!"].includes(char)) {
            tokens.push({ type: "OPERATOR", value: char });
            i += 1;
            continue;
        }

        if (char === '"' || char === "'") {
            const quote = char;
            i += 1;
            let value = "";
            while (i < expression.length && expression[i] !== quote) {
                value += expression[i];
                i += 1;
            }
            if (i >= expression.length) {
                throw new ConditionSyntaxError("Unterminated string in breakpoint condition");
            }
            i += 1;
            tokens.push({ type: "STRING", value });
            continue;
        }

        if (isDigit(char)) {
            let numberText = char;
            i += 1;
            while (i < expression.length && /[0-9.]/.test(expression[i])) {
                numberText += expression[i];
                i += 1;
            }
            tokens.push({ type: "NUMBER", value: Number(numberText) });
            continue;
        }

        if (isIdentifierStart(char)) {
            let text = char;
            i += 1;
            while (i < expression.length && isIdentifierPart(expression[i])) {
                text += expression[i];
                i += 1;
            }
            const upper = text.toUpperCase();
            if (upper === "TRUE" || upper === "FALSE") {
                tokens.push({ type: "BOOLEAN", value: upper === "TRUE" });
            } else if (["AND", "OR", "NOT", "DIV", "MOD"].includes(upper)) {
                tokens.push({ type: "OPERATOR", value: upper });
            } else {
                tokens.push({ type: "IDENTIFIER", value: text });
            }
            continue;
        }

        throw new ConditionSyntaxError(`Unexpected character '${char}' in breakpoint condition`);
    }

    return tokens;
}

function compileConditionExpression(expression: string): DebugBreakpointCondition {
    const trimmedExpression = expression.trim();
    if (trimmedExpression.length === 0) {
        throw new ConditionSyntaxError("Breakpoint condition cannot be empty");
    }

    const tokens = tokenizeConditionExpression(trimmedExpression);
    let current = 0;

    const peek = (): ConditionToken | undefined => tokens[current];
    const advance = (): ConditionToken => {
        const token = tokens[current];
        if (!token) {
            throw new ConditionSyntaxError("Unexpected end of condition expression");
        }
        current += 1;
        return token;
    };
    const matchOperator = (...operators: string[]): boolean => {
        const token = peek();
        if (!token || token.type !== "OPERATOR") {
            return false;
        }
        if (!operators.includes(String(token.value).toUpperCase())) {
            return false;
        }
        current += 1;
        return true;
    };

    const parseExpression = (): ((context: Record<string, unknown>) => unknown) => parseOr();

    const parseOr = (): ((context: Record<string, unknown>) => unknown) => {
        let left = parseAnd();
        while (matchOperator("OR", "||")) {
            const right = parseAnd();
            const prev = left;
            left = (context) => Boolean(prev(context)) || Boolean(right(context));
        }
        return left;
    };

    const parseAnd = (): ((context: Record<string, unknown>) => unknown) => {
        let left = parseEquality();
        while (matchOperator("AND", "&&")) {
            const right = parseEquality();
            const prev = left;
            left = (context) => Boolean(prev(context)) && Boolean(right(context));
        }
        return left;
    };

    const parseEquality = (): ((context: Record<string, unknown>) => unknown) => {
        let left = parseComparison();
        while (matchOperator("=", "==", "!=", "<>")) {
            const operator = String(tokens[current - 1].value).toUpperCase();
            const right = parseComparison();
            const prev = left;
            left = (context) => {
                const l = prev(context);
                const r = right(context);
                if (operator === "=" || operator === "==") {
                    return l === r;
                }
                return l !== r;
            };
        }
        return left;
    };

    const parseComparison = (): ((context: Record<string, unknown>) => unknown) => {
        let left = parseTerm();
        while (matchOperator(">", ">=", "<", "<=")) {
            const operator = String(tokens[current - 1].value);
            const right = parseTerm();
            const prev = left;
            left = (context) => {
                const l = ComparableValueSchema.parse(prev(context));
                const r = ComparableValueSchema.parse(right(context));
                switch (operator) {
                    case ">":
                        return l > r;
                    case ">=":
                        return l >= r;
                    case "<":
                        return l < r;
                    case "<=":
                        return l <= r;
                    default:
                        return false;
                }
            };
        }
        return left;
    };

    const parseTerm = (): ((context: Record<string, unknown>) => unknown) => {
        let left = parseFactor();
        while (matchOperator("+", "-")) {
            const operator = String(tokens[current - 1].value);
            const right = parseFactor();
            const prev = left;
            left = (context) => {
                const l = Number(prev(context));
                const r = Number(right(context));
                return operator === "+" ? l + r : l - r;
            };
        }
        return left;
    };

    const parseFactor = (): ((context: Record<string, unknown>) => unknown) => {
        let left = parseUnary();
        while (matchOperator("*", "/", "DIV", "MOD")) {
            const operator = String(tokens[current - 1].value).toUpperCase();
            const right = parseUnary();
            const prev = left;
            left = (context) => {
                const l = Number(prev(context));
                const r = Number(right(context));
                switch (operator) {
                    case "*":
                        return l * r;
                    case "/":
                        return l / r;
                    case "DIV":
                        return Math.floor(l / r);
                    case "MOD":
                        return l % r;
                    default:
                        return 0;
                }
            };
        }
        return left;
    };

    const parseUnary = (): ((context: Record<string, unknown>) => unknown) => {
        if (matchOperator("NOT", "!")) {
            const operand = parseUnary();
            return (context) => !operand(context);
        }
        if (matchOperator("-")) {
            const operand = parseUnary();
            return (context) => -Number(operand(context));
        }
        return parsePrimary();
    };

    const parsePrimary = (): ((context: Record<string, unknown>) => unknown) => {
        const token = peek();
        if (!token) {
            throw new Error("Unexpected end of condition expression");
        }

        if (token.type === "LEFT_PAREN") {
            advance();
            const expressionFn = parseExpression();
            const right = advance();
            if (right.type !== "RIGHT_PAREN") {
                throw new ConditionSyntaxError("Expected ')' in breakpoint condition");
            }
            return expressionFn;
        }

        if (token.type === "NUMBER" || token.type === "STRING" || token.type === "BOOLEAN") {
            advance();
            const value = token.value;
            return () => value;
        }

        if (token.type === "IDENTIFIER") {
            advance();
            const rootName = String(token.value);
            const accessors: string[] = [];
            while (peek()?.type === "DOT") {
                advance();
                const part = advance();
                if (part.type !== "IDENTIFIER") {
                    throw new ConditionSyntaxError(
                        "Expected identifier after '.' in breakpoint condition",
                    );
                }
                accessors.push(String(part.value));
            }

            return (context) => {
                let value: unknown = context[rootName];
                for (const accessor of accessors) {
                    const objResult = z.record(z.string(), z.unknown()).safeParse(value);
                    if (!objResult.success) {
                        return undefined;
                    }
                    value = objResult.data[accessor];
                }
                return value;
            };
        }

        throw new ConditionSyntaxError("Expected value in breakpoint condition");
    };

    const evaluator = parseExpression();
    if (current < tokens.length) {
        throw new ConditionSyntaxError("Unexpected trailing token in breakpoint condition");
    }

    return (snapshot) => {
        const context = snapshotToContext(snapshot);
        return Boolean(evaluator(context));
    };
}

function explainConditionError(error: unknown): BreakpointConditionErrorDetails {
    const rawMessage = error instanceof Error ? error.message : "Invalid condition expression";
    const message = `Invalid breakpoint condition: ${rawMessage}`;
    const lower = rawMessage.toLowerCase();

    if (lower.includes("cannot be empty")) {
        return { code: "EMPTY_EXPRESSION", message };
    }
    if (lower.includes("unterminated string")) {
        return { code: "UNTERMINATED_STRING", message };
    }
    if (lower.includes("unexpected character")) {
        return { code: "UNEXPECTED_CHARACTER", message };
    }
    if (lower.includes("unexpected end")) {
        return { code: "UNEXPECTED_END", message };
    }
    if (lower.includes("expected ')'")) {
        return { code: "MISSING_RIGHT_PAREN", message };
    }
    if (lower.includes("expected identifier after '.'")) {
        return { code: "EXPECTED_IDENTIFIER_AFTER_DOT", message };
    }
    if (lower.includes("expected value")) {
        return { code: "EXPECTED_VALUE", message };
    }
    if (lower.includes("unexpected trailing token")) {
        return { code: "UNEXPECTED_TRAILING_TOKEN", message };
    }

    return { code: "UNKNOWN", message };
}

export type DebugEvent =
    | { type: "paused"; snapshot: DebugSnapshot }
    | { type: "resumed"; snapshot: DebugSnapshot };

type DebugListener = (event: DebugEvent) => void;
type DebugRunMode = "continue" | "step-into" | "step-over";

export class DebuggerController {
    private listeners: Set<DebugListener> = new Set();
    private paused = false;
    private resumeResolver?: () => void;
    private mode: DebugRunMode = "continue";
    private stepOverDepth?: number;
    private lastPausedSnapshot?: DebugSnapshot;
    private breakpoints: Map<number, LineBreakpoint> = new Map();

    onEvent(listener: DebugListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    isPaused(): boolean {
        return this.paused;
    }

    continue(): void {
        this.mode = "continue";
        this.stepOverDepth = undefined;
        if (this.resumeResolver) {
            const resolve = this.resumeResolver;
            this.resumeResolver = undefined;
            resolve();
        }
    }

    stepInto(): void {
        this.mode = "step-into";
        this.stepOverDepth = undefined;
        if (this.resumeResolver) {
            const resolve = this.resumeResolver;
            this.resumeResolver = undefined;
            resolve();
        }
    }

    stepOver(): void {
        this.mode = "step-over";
        this.stepOverDepth = this.lastPausedSnapshot?.callStack.length ?? 0;
        if (this.resumeResolver) {
            const resolve = this.resumeResolver;
            this.resumeResolver = undefined;
            resolve();
        }
    }

    async maybePause(snapshot: DebugSnapshot): Promise<void> {
        if (snapshot.reason === "error") {
            await this.pause(snapshot);
            return;
        }

        if (snapshot.reason === "debugger-statement") {
            await this.pause(snapshot);
            return;
        }

        if (this.shouldPauseForBreakpoint(snapshot)) {
            const breakpointSnapshot: DebugSnapshot = {
                ...snapshot,
                reason: "breakpoint",
            };
            await this.pause(breakpointSnapshot);
            return;
        }

        if (!this.shouldPauseForStep(snapshot)) {
            return;
        }
        await this.pause(snapshot);
    }

    setBreakpoints(lines: number[]): void {
        this.breakpoints.clear();
        for (const line of lines) {
            if (Number.isInteger(line) && line > 0) {
                this.breakpoints.set(line, { line });
            }
        }
    }

    addBreakpoint(line: number): void {
        if (Number.isInteger(line) && line > 0) {
            this.breakpoints.set(line, { line });
        }
    }

    setConditionalBreakpoint(line: number, condition: DebugBreakpointCondition): void {
        if (Number.isInteger(line) && line > 0) {
            this.breakpoints.set(line, { line, condition });
        }
    }

    setConditionalBreakpointExpression(line: number, expression: string): void {
        const compiled = compileConditionExpression(expression);
        this.setConditionalBreakpoint(line, compiled);
    }

    validateBreakpointConditionExpression(expression: string): BreakpointConditionValidationResult {
        try {
            compileConditionExpression(expression);
            return { valid: true };
        } catch (error) {
            const details = explainConditionError(error);
            return { valid: false, error: details.message };
        }
    }

    explainBreakpointConditionError(expression: string): BreakpointConditionErrorDetails | null {
        try {
            compileConditionExpression(expression);
            return null;
        } catch (error) {
            return explainConditionError(error);
        }
    }

    removeBreakpoint(line: number): void {
        this.breakpoints.delete(line);
    }

    clearBreakpoints(): void {
        this.breakpoints.clear();
    }

    getBreakpoints(): number[] {
        return Array.from(this.breakpoints.keys()).sort((a, b) => a - b);
    }

    async pause(snapshot: DebugSnapshot): Promise<void> {
        this.paused = true;
        this.lastPausedSnapshot = snapshot;
        await new Promise<void>((resolve) => {
            this.resumeResolver = resolve;
            this.emit({ type: "paused", snapshot });
        });

        this.paused = false;
        this.emit({ type: "resumed", snapshot });
    }

    variablesToDebug(variables: VariableInfo[]): DebugVariable[] {
        return variables.map((variable) => ({
            name: variable.name,
            type: this.typeToString(variable.type),
            typeInfo: variable.type,
            value: variable.value,
            isConstant: variable.isConstant,
        }));
    }

    variablesToDebugWithHeap(
        variables: VariableInfo[],
        heapSnapshot: Map<number, { value: unknown; type: TypeInfo; refCount: number }>,
    ): DebugVariable[] {
        return variables.map((variable) => {
            const displayValue = this.resolveHeapValue(
                variable.value,
                variable.type,
                heapSnapshot,
                new Set(),
            );

            return {
                name: variable.name,
                type: this.typeToString(variable.type),
                typeInfo: variable.type,
                value: displayValue,
                isConstant: variable.isConstant,
            };
        });
    }

    private resolveHeapValue(
        value: unknown,
        type: TypeInfo,
        heapSnapshot: Map<number, { value: unknown; type: TypeInfo; refCount: number }>,
        visited: Set<number>,
    ): unknown {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof type === "string") {
            return value;
        }

        if (typeof type === "object" && "kind" in type && type.kind === "POINTER") {
            if (typeof value === "number" && value === 0) {
                return 0;
            }
            if (typeof value === "number" && value !== 0) {
                const heapObj = heapSnapshot.get(value);
                if (heapObj) {
                    const derefValue = visited.has(value)
                        ? "[Circular]"
                        : (visited.add(value),
                            this.resolveHeapValue(
                                heapObj.value,
                                heapObj.type,
                                heapSnapshot,
                                visited,
                            ));
                    return { address: value, dereferenced: derefValue };
                }
            }
            return value;
        }

        if (typeof type === "object" && "kind" in type && type.kind === "ENUM") {
            return value;
        }

        if (typeof type === "object" && "kind" in type && type.kind === "SET") {
            if (value instanceof Set) {
                return Array.from(value);
            }
            return value;
        }

        if (typeof type === "object" && "elementType" in type && Array.isArray(value)) {
            return value.map((element) => {
                if (typeof element === "number" && heapSnapshot.has(element)) {
                    if (visited.has(element)) return "[Circular]";
                    visited.add(element);
                    const heapObj = heapSnapshot.get(element)!;
                    return this.resolveHeapValue(
                        heapObj.value,
                        heapObj.type,
                        heapSnapshot,
                        visited,
                    );
                }
                // oxlint-disable-next-line typescript-eslint/no-unsafe-return
                return element;
            });
        }

        if (
            typeof type === "object" &&
            "fields" in type &&
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
        ) {
            // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
            const record = value as Record<string, unknown>;
            const resolved: Record<string, unknown> = {};
            for (const [fieldName, _fieldType] of Object.entries(type.fields)) {
                const fieldValue = record[fieldName];
                if (typeof fieldValue === "number" && heapSnapshot.has(fieldValue)) {
                    if (visited.has(fieldValue)) {
                        resolved[fieldName] = "[Circular]";
                        continue;
                    }
                    visited.add(fieldValue);
                    const heapObj = heapSnapshot.get(fieldValue)!;
                    resolved[fieldName] = this.resolveHeapValue(
                        heapObj.value,
                        heapObj.type,
                        heapSnapshot,
                        visited,
                    );
                } else {
                    resolved[fieldName] = fieldValue;
                }
            }
            return resolved;
        }

        return value;
    }

    private emit(event: DebugEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    private shouldPauseForStep(snapshot: DebugSnapshot): boolean {
        if (this.mode === "step-into") {
            return true;
        }

        if (this.mode === "step-over") {
            const targetDepth = this.stepOverDepth ?? 0;
            return snapshot.callStack.length <= targetDepth;
        }

        return false;
    }

    private shouldPauseForBreakpoint(snapshot: DebugSnapshot): boolean {
        const line = snapshot.location.line;
        if (line === undefined) {
            return false;
        }
        const breakpoint = this.breakpoints.get(line);
        if (!breakpoint) {
            return false;
        }
        if (!breakpoint.condition) {
            return true;
        }
        try {
            return breakpoint.condition(snapshot);
        } catch {
            return false;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private typeToString(type: unknown): string {
        if (typeof type === "string") {
            return type;
        }
        if (type === null || type === undefined) {
            return "UNKNOWN";
        }
        const nameResult = TypeNameSchema.safeParse(type);
        if (nameResult.success) {
            return nameResult.data.name;
        }
        const kindResult = TypeKindSchema.safeParse(type);
        if (kindResult.success) {
            return kindResult.data.kind;
        }
        return "COMPLEX";
    }
}
