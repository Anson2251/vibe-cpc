/**
 * Runtime Evaluator for CAIE Pseudocode Interpreter
 *
 * This module implements the evaluator for executing AST nodes in the CAIE pseudocode language.
 * It interprets the abstract syntax tree and performs the operations specified by the pseudocode.
 */

import {
    ASTNode,
    ProgramNode,
    StatementNode,
    ExpressionNode,
    VariableDeclarationNode,
    DeclareStatementNode,
    AssignmentNode,
    IfNode,
    ForNode,
    WhileNode,
    RepeatNode,
    ProcedureDeclarationNode,
    FunctionDeclarationNode,
    CallStatementNode,
    InputNode,
    OutputNode,
    ReturnNode,
    OpenFileNode,
    CloseFileNode,
    ReadFileNode,
    WriteFileNode,
    SeekNode,
    GetRecordNode,
    PutRecordNode,
    TypeDeclarationNode,
    SetDeclarationNode,
    ClassDeclarationNode,
    DebuggerNode,
    BinaryExpressionNode,
    UnaryExpressionNode,
    IdentifierNode,
    LiteralNode,
    ArrayAccessNode,
    CallExpressionNode,
    MemberAccessNode,
    NewExpressionNode,
    TypeCastNode,
    SetLiteralNode,
} from "../parser/ast-nodes";

// Define CaseNode interface locally since it's not exported
interface CaseNode extends StatementNode {
    type: "Case";
    expression: ExpressionNode;
    cases: { values: ExpressionNode[]; body: StatementNode[] }[];
    otherwise?: StatementNode[];
}

type EvaluatableNode =
    | VariableDeclarationNode
    | DeclareStatementNode
    | AssignmentNode
    | IfNode
    | CaseNode
    | ForNode
    | WhileNode
    | RepeatNode
    | ProcedureDeclarationNode
    | FunctionDeclarationNode
    | CallStatementNode
    | InputNode
    | OutputNode
    | ReturnNode
    | OpenFileNode
    | CloseFileNode
    | ReadFileNode
    | WriteFileNode
    | SeekNode
    | GetRecordNode
    | PutRecordNode
    | TypeDeclarationNode
    | SetDeclarationNode
    | ClassDeclarationNode
    | DebuggerNode
    | BinaryExpressionNode
    | UnaryExpressionNode
    | IdentifierNode
    | LiteralNode
    | ArrayAccessNode
    | CallExpressionNode
    | MemberAccessNode
    | NewExpressionNode
    | TypeCastNode
    | SetLiteralNode;

function isEvaluatableNode(node: ASTNode): node is EvaluatableNode {
    switch (node.type) {
        case "VariableDeclaration":
        case "DeclareStatement":
        case "Assignment":
        case "If":
        case "Case":
        case "For":
        case "While":
        case "Repeat":
        case "ProcedureDeclaration":
        case "FunctionDeclaration":
        case "CallStatement":
        case "Input":
        case "Output":
        case "Return":
        case "OpenFile":
        case "CloseFile":
        case "ReadFile":
        case "WriteFile":
        case "Seek":
        case "GetRecord":
        case "PutRecord":
        case "TypeDeclaration":
        case "SetDeclaration":
        case "ClassDeclaration":
        case "Debugger":
        case "BinaryExpression":
        case "UnaryExpression":
        case "Identifier":
        case "Literal":
        case "ArrayAccess":
        case "CallExpression":
        case "MemberAccess":
        case "NewExpression":
        case "TypeCast":
        case "SetLiteral":
            return true;
        default:
            return false;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifierNode(node: ExpressionNode): node is IdentifierNode {
    return node.type === "Identifier";
}

function isArrayAccessNode(node: ExpressionNode): node is ArrayAccessNode {
    return node.type === "ArrayAccess";
}

function isMemberAccessNode(node: ExpressionNode): node is MemberAccessNode {
    return node.type === "MemberAccess";
}

function isProcedureDeclarationNode(node: ASTNode): node is ProcedureDeclarationNode {
    return node.type === "ProcedureDeclaration";
}

function isFunctionDeclarationNode(node: ASTNode): node is FunctionDeclarationNode {
    return node.type === "FunctionDeclaration";
}

function isUserDefinedAtom(value: unknown): value is UserDefinedAtom {
    return (
        value instanceof VariableAtom &&
        typeof value.type === "object" &&
        value.type !== null &&
        "fields" in value.type
    );
}

function isArrayAtom(value: unknown): value is ArrayAtom {
    return (
        value instanceof VariableAtom &&
        typeof value.type === "object" &&
        value.type !== null &&
        "elementType" in value.type
    );
}

function ensureNumber(value: unknown, line?: number, column?: number): number {
    if (typeof value !== "number") {
        throw new RuntimeError("Expected numeric value", line, column);
    }
    return value;
}

function ensureIndices(values: unknown[], line?: number, column?: number): number[] {
    return values.map((value) => ensureNumber(value, line, column));
}

function ensureStringOrNumber(value: unknown, line?: number, column?: number): string | number {
    if (typeof value !== "string" && typeof value !== "number") {
        throw new RuntimeError("Expected STRING or NUMBER value", line, column);
    }
    return value;
}

function ensurePseudocodeType(type: TypeInfo, line?: number, column?: number): PseudocodeType {
    if (typeof type !== "string") {
        throw new RuntimeError("Expected scalar pseudocode type", line, column);
    }
    return type;
}

function getRecordField<T>(record: Record<string, T>, fieldName: string): T | undefined {
    for (const [key, value] of Object.entries(record)) {
        if (key === fieldName) {
            return value;
        }
    }
    return undefined;
}

import {
    PseudocodeType,
    ArrayTypeInfo,
    ArrayBound,
    UserDefinedTypeInfo,
    EnumTypeInfo,
    SetTypeInfo,
    TypeInfo,
    ParameterMode,
} from "../types";

import { RuntimeError, DivisionByZeroError, IndexError } from "../errors";

import builtInFunctions from "./builtin-functions";
import { RuntimeFileManager } from "./file-manager";
import { FileOperationEvaluator } from "./file-operations-evaluator";
import { ResultAsync, okAsync, errAsync } from "neverthrow";
import { RuntimeAsyncResult, toRuntimeError } from "../result";

import { Environment, ExecutionContext, RoutineInfo } from "./environment";
import { IOInterface } from "../io/io-interface";
import { VariableAtom, ArrayAtom, UserDefinedAtom, VariableAtomFactory } from "./variable-atoms";
import { DebuggerController, DebugSnapshot } from "./debugger";

/**
 * Evaluator class for executing AST nodes
 */
export class Evaluator {
    private environment: Environment;
    context: ExecutionContext;
    private io: IOInterface;
    private fileManager: RuntimeFileManager;
    private fileOperations: FileOperationEvaluator;
    private globalRoutines: Map<string, RoutineInfo> = new Map();
    private userDefinedTypes: Map<string, UserDefinedTypeInfo> = new Map();
    private enumTypes: Map<string, EnumTypeInfo> = new Map();
    private setTypes: Map<string, SetTypeInfo> = new Map();
    private debuggerController?: DebuggerController;

    constructor(io: IOInterface) {
        this.io = io;
        this.environment = new Environment();
        this.context = new ExecutionContext(this.environment);
        this.fileManager = new RuntimeFileManager(io);
        this.fileOperations = new FileOperationEvaluator(this.fileManager, {
            evaluateExpression: (expression) => this.evaluateR(expression),
            assignToTarget: (target, value, line, column) =>
                this.assignToTargetR(target, value, line, column),
        });
        this.initializeBuiltInRoutines();
    }

    setDebuggerController(controller?: DebuggerController): void {
        this.debuggerController = controller;
    }

    /**
     * Evaluate a program node
     */
    evaluateProgramR(node: ProgramNode): RuntimeAsyncResult<unknown> {
        let result: unknown = undefined;
        let chain: RuntimeAsyncResult<void> = ResultAsync.fromPromise(
            Promise.resolve(undefined),
            () =>
                new RuntimeError(
                    "Unexpected evaluator initialization failure",
                    node.line,
                    node.column,
                ),
        );

        for (const statement of node.body) {
            chain = chain.andThen(() =>
                this.executeStatementR(statement).map((value) => {
                    result = value;
                }),
            );
        }

        return chain.map(() => result);
    }

    async evaluateProgram(node: ProgramNode): Promise<unknown> {
        const result = await this.evaluateProgramR(node);
        if (result.isErr()) {
            throw result.error;
        }
        return result.value;
    }

    /**
     * Evaluate a statement node
     */
    evaluateR(node: ASTNode): RuntimeAsyncResult<unknown> {
        if (!isEvaluatableNode(node)) {
            return errAsync(
                new RuntimeError(`Unknown node type: ${node.type}`, node.line, node.column),
            );
        }

        // Update current line and column for error reporting
        if (node.line !== undefined) {
            this.context.currentLine = node.line;
        }
        if (node.column !== undefined) {
            this.context.currentColumn = node.column;
        }

        switch (node.type) {
            case "VariableDeclaration":
                return ResultAsync.fromPromise(
                    this.evaluateVariableDeclaration(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "DeclareStatement":
                return ResultAsync.fromPromise(
                    this.evaluateDeclareStatement(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "Assignment":
                return ResultAsync.fromPromise(this.evaluateAssignment(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "If":
                return ResultAsync.fromPromise(this.evaluateIf(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "Case":
                return ResultAsync.fromPromise(this.evaluateCase(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "For":
                return ResultAsync.fromPromise(this.evaluateFor(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "While":
                return ResultAsync.fromPromise(this.evaluateWhile(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "Repeat":
                return ResultAsync.fromPromise(this.evaluateRepeat(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "ProcedureDeclaration":
                return this.trySync(
                    () => {
                        this.evaluateProcedureDeclaration(node);
                        return undefined;
                    },
                    node.line,
                    node.column,
                );

            case "FunctionDeclaration":
                return this.trySync(
                    () => {
                        this.evaluateFunctionDeclaration(node);
                        return undefined;
                    },
                    node.line,
                    node.column,
                );

            case "CallStatement":
                return ResultAsync.fromPromise(this.evaluateCallStatement(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "Input":
                return ResultAsync.fromPromise(this.evaluateInput(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "Output":
                return ResultAsync.fromPromise(this.evaluateOutput(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "Return":
                return ResultAsync.fromPromise(this.evaluateReturn(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "OpenFile":
                return this.fileOperations.openFileR(node).map(() => undefined);

            case "CloseFile":
                return this.fileOperations.closeFileR(node).map(() => undefined);

            case "ReadFile":
                return this.fileOperations.readFileR(node).map(() => undefined);

            case "WriteFile":
                return this.fileOperations.writeFileR(node).map(() => undefined);

            case "Seek":
                return this.fileOperations.seekR(node).map(() => undefined);

            case "GetRecord":
                return this.fileOperations.getRecordR(node).map(() => undefined);

            case "PutRecord":
                return this.fileOperations.putRecordR(node).map(() => undefined);

            case "TypeDeclaration":
                return this.trySync(
                    () => {
                        this.evaluateTypeDeclaration(node);
                        return undefined;
                    },
                    node.line,
                    node.column,
                );

            case "SetDeclaration":
                return ResultAsync.fromPromise(
                    this.evaluateSetDeclaration(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "ClassDeclaration":
                return this.trySync(
                    () => {
                        this.evaluateClassDeclaration(node);
                        return undefined;
                    },
                    node.line,
                    node.column,
                );

            case "Debugger":
                return ResultAsync.fromPromise(
                    this.evaluateDebugger(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
                ).map(() => undefined);

            case "BinaryExpression":
                return ResultAsync.fromPromise(
                    this.evaluateBinaryExpression(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
                );

            case "UnaryExpression":
                return ResultAsync.fromPromise(
                    this.evaluateUnaryExpression(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
                );

            case "Identifier":
                return this.trySync(() => this.evaluateIdentifier(node), node.line, node.column);

            case "Literal":
                return this.trySync(() => this.evaluateLiteral(node), node.line, node.column);

            case "ArrayAccess":
                return ResultAsync.fromPromise(this.evaluateArrayAccess(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                );

            case "CallExpression":
                return ResultAsync.fromPromise(
                    this.evaluateCallExpression(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
                );

            case "MemberAccess":
                return ResultAsync.fromPromise(this.evaluateMemberAccess(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                );

            case "NewExpression":
                return this.trySync(() => this.evaluateNewExpression(node), node.line, node.column);

            case "TypeCast":
                return ResultAsync.fromPromise(this.evaluateTypeCast(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                );

            case "SetLiteral":
                return ResultAsync.fromPromise(this.evaluateSetLiteral(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                );
        }
    }

    async evaluate(node: ASTNode): Promise<unknown> {
        const result = await this.evaluateR(node);
        if (result.isErr()) {
            throw result.error;
        }
        return result.value;
    }

    private trySync<T>(fn: () => T, line?: number, column?: number): RuntimeAsyncResult<T> {
        try {
            return okAsync(fn());
        } catch (error) {
            return errAsync(toRuntimeError(error, line, column));
        }
    }

    private executeStatementR(statement: StatementNode): RuntimeAsyncResult<unknown> {
        return this.pauseForStepBeforeStatementR(statement).andThen(() => this.evaluateR(statement));
    }

    private async executeStatement(statement: StatementNode): Promise<unknown> {
        const result = await this.executeStatementR(statement);
        if (result.isErr()) {
            throw result.error;
        }
        return result.value;
    }

    private pauseForStepBeforeStatementR(statement: StatementNode): RuntimeAsyncResult<void> {
        if (!this.debuggerController) {
            return okAsync(undefined);
        }

        const snapshot = this.buildDebugSnapshot("step", statement.line, statement.column);
        return ResultAsync.fromPromise(
            this.debuggerController.maybePause(snapshot),
            (error: unknown) => toRuntimeError(error, statement.line, statement.column),
        );
    }

    private buildDebugSnapshot(
        reason: "debugger-statement" | "step",
        line?: number,
        column?: number,
    ): DebugSnapshot {
        return {
            reason,
            location: {
                line,
                column,
            },
            scopes: [
                {
                    scopeName: "local",
                    variables: this.debuggerController
                        ? this.debuggerController.variablesToDebug(this.environment.getVariables())
                        : [],
                },
            ],
            callStack: this.context.callStack.map((frame) => ({
                routineName: frame.routineName,
                line: frame.returnAddress?.line,
                column: frame.returnAddress?.column,
            })),
        };
    }

    /**
     * Evaluate a DECLARE statement
     */
    private async evaluateDeclareStatement(node: DeclareStatementNode): Promise<void> {
        const resolvedType = this.resolveType(node.dataType, node.line, node.column);
        let initialValue: unknown;

        if (node.initialValue) {
            initialValue = await this.evaluate(node.initialValue);
        } else {
            // Set default value based on type
            if (typeof resolvedType === "string") {
                switch (resolvedType) {
                    case PseudocodeType.INTEGER:
                    case PseudocodeType.REAL:
                        initialValue = 0;
                        break;
                    case PseudocodeType.CHAR:
                        initialValue = " ";
                        break;
                    case PseudocodeType.STRING:
                        initialValue = "";
                        break;
                    case PseudocodeType.BOOLEAN:
                        initialValue = false;
                        break;
                    case PseudocodeType.DATE:
                        initialValue = new Date();
                        break;
                }
            } else if ("elementType" in resolvedType && !("kind" in resolvedType)) {
                // Array type - initialize with empty array
                initialValue = this.createEmptyArray(resolvedType);
            } else if ("kind" in resolvedType && resolvedType.kind === "ENUM") {
                initialValue = resolvedType.values[0] ?? "";
            } else if ("kind" in resolvedType && resolvedType.kind === "SET") {
                initialValue = new Set();
            } else if ("fields" in resolvedType) {
                initialValue = this.buildDefaultUserDefinedValue(resolvedType.fields);
            }
        }

        this.environment.define(node.name, resolvedType, initialValue, node.isConstant);
    }

    private buildDefaultUserDefinedValue(
        fields: Record<string, TypeInfo>,
    ): Record<string, unknown> {
        const value: Record<string, unknown> = {};
        for (const [fieldName, fieldType] of Object.entries(fields)) {
            value[fieldName] = this.getDefaultValueForFieldType(fieldType);
        }
        return value;
    }

    /**
     * Evaluate a variable declaration
     */
    private async evaluateVariableDeclaration(node: VariableDeclarationNode): Promise<void> {
        const resolvedType = this.resolveType(node.dataType, node.line, node.column);
        let initialValue: unknown;

        if (node.initialValue) {
            initialValue = await this.evaluate(node.initialValue);
        } else {
            // Set default value based on type
            if (typeof resolvedType === "string") {
                switch (resolvedType) {
                    case PseudocodeType.INTEGER:
                    case PseudocodeType.REAL:
                        initialValue = 0;
                        break;
                    case PseudocodeType.CHAR:
                        initialValue = " ";
                        break;
                    case PseudocodeType.STRING:
                        initialValue = "";
                        break;
                    case PseudocodeType.BOOLEAN:
                        initialValue = false;
                        break;
                    case PseudocodeType.DATE:
                        initialValue = new Date();
                        break;
                }
            } else if ("elementType" in resolvedType && !("kind" in resolvedType)) {
                // Array type - initialize with empty array
                initialValue = this.createEmptyArray(resolvedType);
            } else if ("kind" in resolvedType && resolvedType.kind === "ENUM") {
                initialValue = resolvedType.values[0] ?? "";
            } else if ("kind" in resolvedType && resolvedType.kind === "SET") {
                initialValue = new Set();
            } else if ("fields" in resolvedType) {
                initialValue = this.buildDefaultUserDefinedValue(resolvedType.fields);
            }
        }

        this.environment.define(node.name, resolvedType, initialValue, node.isConstant);
    }

    /**
     * Evaluate an assignment statement
     */
    private async evaluateAssignment(node: AssignmentNode): Promise<void> {
        let value: unknown;

        if (isIdentifierNode(node.target)) {
            const targetType = this.environment.getType(node.target.name);
            if (
                typeof targetType === "object" &&
                targetType !== null &&
                "kind" in targetType &&
                targetType.kind === "ENUM" &&
                isIdentifierNode(node.value)
            ) {
                value = node.value.name;
            } else {
                value = await this.evaluate(node.value);
            }
        } else {
            value = await this.evaluate(node.value);
        }

        if (isIdentifierNode(node.target)) {
            this.environment.assign(node.target.name, value);
        } else if (isArrayAccessNode(node.target)) {
            const array = await this.evaluate(node.target.array);
            const indexValues = await Promise.all(
                node.target.indices.map(async (index) => this.evaluate(index)),
            );
            const indices = ensureIndices(indexValues, node.line, node.column);

            if (isIdentifierNode(node.target.array)) {
                const typeInfo = this.environment.getType(node.target.array.name);
                if (
                    typeof typeInfo === "object" &&
                    typeInfo !== null &&
                    "elementType" in typeInfo
                ) {
                    VariableAtomFactory.createAtom(typeInfo.elementType, value);
                }
            }

            this.setArrayElement(array, indices, value);
        } else if (isMemberAccessNode(node.target)) {
            const memberAccess = node.target;
            const declaredParentType = this.resolveMemberPathType(memberAccess.object);
            if (declaredParentType) {
                const fieldType = getRecordField(declaredParentType.fields, memberAccess.field);
                if (fieldType === undefined) {
                    throw new RuntimeError(
                        `Unknown field '${memberAccess.field}' on type '${declaredParentType.name}'`,
                        node.line,
                        node.column,
                    );
                }
                VariableAtomFactory.createAtom(fieldType, value);
            }
            const object = await this.evaluate(memberAccess.object);

            if (isUserDefinedAtom(object)) {
                const userDefinedAtom = object;
                if (!isRecord(userDefinedAtom.value)) {
                    throw new RuntimeError(
                        "Cannot access property of non-object",
                        node.line,
                        node.column,
                    );
                }
                const objectValue = userDefinedAtom.value;
                const fieldType = getRecordField(userDefinedAtom.fields, memberAccess.field);
                if (fieldType === undefined) {
                    throw new RuntimeError(
                        `Unknown field '${memberAccess.field}' on type '${userDefinedAtom.typeName}'`,
                        node.line,
                        node.column,
                    );
                }
                VariableAtomFactory.createAtom(fieldType, value);
                objectValue[memberAccess.field] = value;
            } else if (object === null || typeof object !== "object") {
                throw new RuntimeError(
                    "Cannot access property of non-object",
                    node.line,
                    node.column,
                );
            } else {
                if (!isRecord(object)) {
                    throw new RuntimeError(
                        "Cannot access property of non-object",
                        node.line,
                        node.column,
                    );
                }
                if (declaredParentType && !(memberAccess.field in object)) {
                    throw new RuntimeError(
                        `Unknown field '${memberAccess.field}' on type '${declaredParentType.name}'`,
                        node.line,
                        node.column,
                    );
                }
                object[memberAccess.field] = value;
            }
        } else {
            throw new RuntimeError("Invalid assignment target", node.line, node.column);
        }
    }

    /**
     * Evaluate an IF statement
     */
    private async evaluateIf(node: IfNode): Promise<void> {
        const condition = await this.evaluate(node.condition);

        if (this.isTruthy(condition)) {
            for (const statement of node.thenBranch) {
                await this.executeStatement(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        } else if (node.elseBranch) {
            for (const statement of node.elseBranch) {
                await this.executeStatement(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        }
    }

    /**
     * Evaluate a CASE statement
     */
    private async evaluateCase(node: CaseNode): Promise<void> {
        const expressionValue = ensureStringOrNumber(
            await this.evaluate(node.expression),
            node.line,
            node.column,
        );
        let executed = false;

        for (const caseItem of node.cases) {
            if (caseItem.values.length === 2) {
                const value1 = ensureStringOrNumber(
                    await this.evaluate(caseItem.values[0]),
                    node.line,
                    node.column,
                );
                const value2 = ensureStringOrNumber(
                    await this.evaluate(caseItem.values[1]),
                    node.line,
                    node.column,
                );

                if (value1 <= expressionValue && expressionValue <= value2) {
                    executed = true;

                    for (const statement of caseItem.body) {
                        await this.executeStatement(statement);

                        if (this.context.shouldReturnFromRoutine()) {
                            return;
                        }
                    }

                    break;
                }
            } else if (caseItem.values.length === 1) {
                const value = await this.evaluate(caseItem.values[0]);

                if (this.isEqual(expressionValue, value)) {
                    executed = true;

                    for (const statement of caseItem.body) {
                        await this.executeStatement(statement);

                        if (this.context.shouldReturnFromRoutine()) {
                            return;
                        }
                    }

                    break;
                }
            } else {
                throw new RuntimeError("Invalid case item", node.line, node.column);
            }

            if (executed) {
                break;
            }
        }

        // Execute OTHERWISE case if no other case matched
        if (!executed && node.otherwise) {
            for (const statement of node.otherwise) {
                await this.executeStatement(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        }
    }

    /**
     * Evaluate a FOR loop
     */
    private async evaluateFor(node: ForNode): Promise<void> {
        const start = ensureNumber(await this.evaluate(node.start), node.line, node.column);
        const end = ensureNumber(await this.evaluate(node.end), node.line, node.column);
        const step = node.step
            ? ensureNumber(await this.evaluate(node.step), node.line, node.column)
            : 1;

        // Initialize the loop variable
        if (!this.environment.has(node.variable))
            this.environment.define(node.variable, PseudocodeType.INTEGER, start);

        // Determine the direction of the loop
        const increment = step > 0;

        for (
            let currentValue = start;
            increment ? currentValue <= end : currentValue >= end;
            currentValue += step
        ) {
            // Update the loop variable
            this.environment.assign(node.variable, currentValue);

            // Execute the loop body
            for (const statement of node.body) {
                await this.executeStatement(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }

            // Get the current value of the loop variable (it might have been changed in the loop)
            currentValue = ensureNumber(
                this.environment.get(node.variable),
                node.line,
                node.column,
            );
        }
    }

    /**
     * Evaluate a WHILE loop
     */
    private async evaluateWhile(node: WhileNode): Promise<void> {
        while (true) {
            const condition = await this.evaluate(node.condition);

            if (!this.isTruthy(condition)) {
                break;
            }

            for (const statement of node.body) {
                await this.executeStatement(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        }
    }

    /**
     * Evaluate a REPEAT loop
     */
    private async evaluateRepeat(node: RepeatNode): Promise<void> {
        do {
            for (const statement of node.body) {
                await this.executeStatement(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        } while (!this.isTruthy(await this.evaluate(node.condition)));
    }

    /**
     * Evaluate a procedure declaration
     */
    private evaluateProcedureDeclaration(node: ProcedureDeclarationNode): void {
        const signature = {
            name: node.name,
            parameters: node.parameters.map((param) => ({
                name: param.name,
                type: this.resolveType(param.dataType, param.line, param.column),
                mode: param.mode,
            })),
        };

        const routineInfo: RoutineInfo = {
            ...signature,
            node,
        };

        this.environment.defineRoutine(signature);
        this.globalRoutines.set(node.name, routineInfo);
    }

    /**
     * Evaluate a function declaration
     */
    private evaluateFunctionDeclaration(node: FunctionDeclarationNode): void {
        const signature = {
            name: node.name,
            parameters: node.parameters.map((param) => ({
                name: param.name,
                type: this.resolveType(param.dataType, param.line, param.column),
                mode: param.mode,
            })),
            returnType: this.resolveType(node.returnType, node.line, node.column),
        };

        const routineInfo: RoutineInfo = {
            ...signature,
            node,
        };

        this.environment.defineRoutine(signature);
        this.globalRoutines.set(node.name, routineInfo);
    }

    /**
     * Evaluate a CALL statement
     */
    private async evaluateCallStatement(node: CallStatementNode): Promise<void> {
        await this.evaluateCallExpression({
            type: "CallExpression",
            name: node.name,
            arguments: node.arguments,
            line: node.line,
            column: node.column,
        });
    }

    /**
     * Evaluate an INPUT statement
     */
    private async evaluateInput(node: InputNode): Promise<void> {
        let promptText = "";

        if (node.prompt) {
            const promptValue = await this.evaluate(node.prompt);
            promptText = String(promptValue);
        }

        const input = await this.io.input(promptText);
        // Get the target variable name safely
        let targetName = "";
        if (node.target.type === "Identifier") {
            targetName = node.target.name;
        } else {
            throw new RuntimeError("Invalid input target", node.line, node.column);
        }

        const targetType = this.environment.getType(targetName);
        const value = this.convertInput(
            input,
            ensurePseudocodeType(targetType, node.line, node.column),
        );

        if (node.target.type === "Identifier") {
            this.environment.assign(targetName, value);
        }
    }

    /**
     * Evaluate an OUTPUT statement
     */
    private async evaluateOutput(node: OutputNode): Promise<void> {
        const outputValues: string[] = [];

        for (const expression of node.expressions) {
            const value = await this.evaluate(expression);

            // Handle VariableAtom values
            if (value instanceof VariableAtom) {
                outputValues.push(String(value.value));
            } else {
                outputValues.push(String(value));
            }
        }

        this.io.output(outputValues.join("") + "\n");
    }

    /**
     * Evaluate a RETURN statement
     */
    private async evaluateReturn(node: ReturnNode): Promise<void> {
        let value: unknown;

        if (node.value) {
            value = await this.evaluate(node.value);
        }

        this.context.setReturnValue(value);
        this.context.shouldReturn = true;
    }

    private async evaluateDebugger(node: DebuggerNode): Promise<void> {
        if (!this.debuggerController) {
            return;
        }

        const snapshot = this.buildDebugSnapshot("debugger-statement", node.line, node.column);

        await this.debuggerController.pause(snapshot);
    }

    private async assignValueToTarget(
        target: ExpressionNode,
        value: unknown,
        line?: number,
        column?: number,
    ): Promise<void> {
        const result = await this.assignToTargetR(target, value, line, column);
        if (result.isErr()) {
            throw result.error;
        }
    }

    private assignToTargetR(
        target: ExpressionNode,
        value: unknown,
        line?: number,
        column?: number,
    ): RuntimeAsyncResult<void> {
        if (isIdentifierNode(target)) {
            try {
                this.environment.assign(target.name, value);
                return okAsync(undefined);
            } catch (error) {
                return errAsync(toRuntimeError(error, line, column));
            }
        }

        if (isArrayAccessNode(target)) {
            return this.evaluateR(target.array).andThen((array) =>
                ResultAsync.fromPromise(
                    Promise.all(target.indices.map(async (index) => this.evaluate(index))),
                    (error: unknown) => toRuntimeError(error, line, column),
                ).andThen((indices) => {
                    try {
                        this.setArrayElement(array, ensureIndices(indices, line, column), value);
                        return okAsync(undefined);
                    } catch (error) {
                        return errAsync(toRuntimeError(error, line, column));
                    }
                }),
            );
        }

        return ResultAsync.fromPromise(
            Promise.reject(new RuntimeError("Invalid assignment target", line, column)),
            (error: unknown) => toRuntimeError(error, line, column),
        );
    }

    /**
     * Evaluate a TYPE declaration
     */
    private evaluateTypeDeclaration(node: TypeDeclarationNode): void {
        if (node.setElementType) {
            const setType: SetTypeInfo = {
                kind: "SET",
                name: node.name,
                elementType: node.setElementType,
            };
            this.setTypes.set(node.name.toUpperCase(), setType);
            return;
        }

        if (node.enumValues && node.enumValues.length > 0) {
            const enumType: EnumTypeInfo = {
                kind: "ENUM",
                name: node.name,
                values: node.enumValues,
            };
            this.enumTypes.set(node.name.toUpperCase(), enumType);
            return;
        }

        // Create a user-defined type
        const userType: UserDefinedTypeInfo = {
            name: node.name,
            fields: {},
        };

        for (const field of node.fields) {
            userType.fields[field.name] = field.dataType;
        }

        this.userDefinedTypes.set(node.name.toUpperCase(), userType);
    }

    private async evaluateSetDeclaration(node: SetDeclarationNode): Promise<void> {
        const setType = this.setTypes.get(node.setTypeName.toUpperCase());
        if (!setType) {
            throw new RuntimeError(
                `Unknown set type '${node.setTypeName}'`,
                node.line,
                node.column,
            );
        }

        const values = new Set<unknown>();
        for (const expr of node.values) {
            const value = await this.evaluate(expr);
            values.add(value);
        }

        this.environment.define(node.name, setType, values, false);
    }

    /**
     * Evaluate a CLASS declaration
     */
    private evaluateClassDeclaration(node: ClassDeclarationNode): void {
        // Create a class definition
        const classDef = {
            name: node.name,
            inherits: node.inherits,
            fields: node.fields,
            methods: node.methods,
        };

        // Store the class definition in the environment
        this.environment.define(node.name, PseudocodeType.STRING, JSON.stringify(classDef), true);
    }

    /**
     * Evaluate a binary expression
     */
    private async evaluateBinaryExpression(node: BinaryExpressionNode): Promise<unknown> {
        const left = await this.evaluate(node.left);
        const right = await this.evaluate(node.right);

        switch (node.operator) {
            // Arithmetic operators
            case "+":
                if (typeof left === "string" || typeof right === "string") {
                    return String(left) + String(right);
                }
                return Number(left) + Number(right);

            case "&":
                return String(left) + String(right);

            case "-":
                return Number(left) - Number(right);

            case "*":
                return Number(left) * Number(right);

            case "/":
                if (Number(right) === 0) {
                    throw new DivisionByZeroError(node.line, node.column);
                }
                return Number(left) / Number(right);

            case "DIV":
                if (Number(right) === 0) {
                    throw new DivisionByZeroError(node.line, node.column);
                }
                return Math.floor(Number(left) / Number(right));

            case "MOD":
                if (Number(right) === 0) {
                    throw new DivisionByZeroError(node.line, node.column);
                }
                return Number(left) % Number(right);

            // Comparison operators
            case "=":
                return this.isEqual(left, right);

            case "<>":
                return !this.isEqual(left, right);

            case "<":
                return Number(left) < Number(right);

            case ">":
                return Number(left) > Number(right);

            case "<=":
                return Number(left) <= Number(right);

            case ">=":
                return Number(left) >= Number(right);

            // Logical operators
            case "AND":
                return this.isTruthy(left) && this.isTruthy(right);

            case "OR":
                return this.isTruthy(left) || this.isTruthy(right);

            case "IN":
                if (!(right instanceof Set)) {
                    throw new RuntimeError(
                        "Right operand of IN must be a SET",
                        node.line,
                        node.column,
                    );
                }
                return right.has(left);

            default:
                throw new RuntimeError(
                    `Unknown binary operator: ${node.operator}`,
                    node.line,
                    node.column,
                );
        }
    }

    /**
     * Evaluate a unary expression
     */
    private async evaluateUnaryExpression(node: UnaryExpressionNode): Promise<unknown> {
        const operand = await this.evaluate(node.operand);

        switch (node.operator) {
            case "-":
                return -Number(operand);

            case "NOT":
                return !this.isTruthy(operand);

            default:
                throw new RuntimeError(
                    `Unknown unary operator: ${node.operator}`,
                    node.line,
                    node.column,
                );
        }
    }

    /**
     * Evaluate an identifier
     */
    private evaluateIdentifier(node: IdentifierNode) {
        if (this.environment.has(node.name)) {
            return this.environment.get(node.name);
        }

        for (const enumType of this.enumTypes.values()) {
            if (enumType.values.includes(node.name)) {
                return node.name;
            }
        }

        return this.environment.get(node.name);
    }

    /**
     * Evaluate a literal
     */
    private evaluateLiteral(node: LiteralNode) {
        return node.value;
    }

    /**
     * Evaluate an array access
     */
    private async evaluateArrayAccess(node: ArrayAccessNode): Promise<unknown> {
        const array = await this.evaluate(node.array);
        const indices = ensureIndices(
            await Promise.all(node.indices.map(async (index) => this.evaluate(index))),
            node.line,
            node.column,
        );

        return this.getArrayElement(array, indices);
    }

    /**
     * Evaluate a call expression
     */
    private async evaluateCallExpression(node: CallExpressionNode): Promise<unknown> {
        const routineName = node.name;

        if (routineName === "EOF") {
            return this.fileOperations.evaluateEOFCall(node.arguments, node.line, node.column);
        }

        // Check if it's a built-in routine
        if (this.globalRoutines.has(routineName)) {
            const routineInfo = this.globalRoutines.get(routineName)!;

            if (routineInfo.isBuiltIn && routineInfo.implementation) {
                const args = await Promise.all(
                    node.arguments.map(async (arg) => this.evaluate(arg)),
                );
                return routineInfo.implementation(...args);
            }
        }

        // Get the routine signature
        const signature = this.environment.getRoutine(routineName);

        // Evaluate arguments
        const args = await Promise.all(node.arguments.map(async (arg) => this.evaluate(arg)));

        // Create a new environment for the routine
        const routineEnvironment = this.environment.createChild();

        // Set up parameters
        const byRefBindings: Array<{ parameterName: string; callerVariable: string }> = [];
        for (let i = 0; i < signature.parameters.length; i++) {
            const param = signature.parameters[i];
            const arg = args[i];

            if (param.mode === ParameterMode.BY_REFERENCE) {
                const argNode = node.arguments[i];
                if (!argNode || !isIdentifierNode(argNode)) {
                    throw new RuntimeError(
                        `BYREF parameter '${param.name}' requires a variable identifier argument`,
                        node.line,
                        node.column,
                    );
                }

                byRefBindings.push({ parameterName: param.name, callerVariable: argNode.name });
            }

            // Initialize parameter binding in routine scope
            routineEnvironment.define(param.name, param.type, arg);
        }

        // Create a new execution context for the routine
        const routineContext = new ExecutionContext(routineEnvironment);

        // Push call frame
        const returnAddress =
            this.context.currentLine !== undefined && this.context.currentColumn !== undefined
                ? { line: this.context.currentLine, column: this.context.currentColumn }
                : undefined;

        this.context.pushCallFrame({
            routineName,
            environment: this.environment,
            returnAddress,
        });

        // Swap contexts and environments
        const previousContext = this.context;
        const previousEnvironment = this.environment;
        this.context = routineContext;
        this.environment = routineEnvironment;

        // Execute the routine
        let result: unknown;

        if (this.globalRoutines.has(routineName)) {
            const routineInfo = this.globalRoutines.get(routineName)!;

            if (routineInfo.node) {
                // Execute user-defined routine
                if (isProcedureDeclarationNode(routineInfo.node)) {
                    const procedureNode = routineInfo.node;
                    for (const statement of procedureNode.body) {
                        await this.executeStatement(statement);

                        if (this.context.shouldReturnFromRoutine()) {
                            break;
                        }
                    }
                } else if (isFunctionDeclarationNode(routineInfo.node)) {
                    const functionNode = routineInfo.node;
                    for (const statement of functionNode.body) {
                        await this.executeStatement(statement);

                        if (this.context.shouldReturnFromRoutine()) {
                            break;
                        }
                    }

                    result = this.context.getReturnValue();
                }
            }
        }

        // Restore context and environment
        this.context = previousContext;
        this.environment = previousEnvironment;

        // Propagate BYREF updates back to caller scope
        for (const binding of byRefBindings) {
            const updatedValue = routineEnvironment.get(binding.parameterName);
            this.environment.assign(binding.callerVariable, updatedValue);
        }

        // Pop call frame
        this.context.popCallFrame();

        return result;
    }

    /**
     * Evaluate a member access
     */
    private async evaluateMemberAccess(node: MemberAccessNode): Promise<unknown> {
        const object = await this.evaluate(node.object);

        // Handle UserDefinedAtom
        if (isUserDefinedAtom(object)) {
            if (!isRecord(object.value)) {
                throw new RuntimeError(
                    "Cannot access property of non-object",
                    node.line,
                    node.column,
                );
            }
            const objectValue = object.value;
            return objectValue[node.field];
        }

        // Handle regular object
        if (object === null || typeof object !== "object") {
            throw new RuntimeError("Cannot access property of non-object", node.line, node.column);
        }

        const parentType = this.resolveMemberPathType(node.object);
        if (parentType && !(node.field in parentType.fields)) {
            throw new RuntimeError(
                `Unknown field '${node.field}' on type '${parentType.name}'`,
                node.line,
                node.column,
            );
        }

        if (!isRecord(object)) {
            throw new RuntimeError("Cannot access property of non-object", node.line, node.column);
        }

        return object[node.field];
    }

    private resolveMemberPathType(expression: ExpressionNode): UserDefinedTypeInfo | undefined {
        if (isIdentifierNode(expression)) {
            const typeInfo = this.environment.getType(expression.name);
            if (typeof typeInfo === "object" && typeInfo !== null && "fields" in typeInfo) {
                return typeInfo;
            }
            return undefined;
        }

        if (isMemberAccessNode(expression)) {
            const parentType = this.resolveMemberPathType(expression.object);
            if (!parentType) {
                return undefined;
            }
            const fieldType = parentType.fields[expression.field];
            if (!fieldType) {
                return undefined;
            }
            if (typeof fieldType === "object" && fieldType !== null && "fields" in fieldType) {
                return fieldType;
            }
            return undefined;
        }

        return undefined;
    }

    /**
     * Evaluate a NEW expression
     */
    private evaluateNewExpression(_node: NewExpressionNode): unknown {
        // Create a new instance of the class
        const instance = {};

        // In a real implementation, we would:
        // 1. Look up the class definition
        // 2. Create a new instance with the class's fields
        // 3. Call the constructor with the provided arguments

        return instance;
    }

    /**
     * Evaluate a type cast
     */
    private async evaluateTypeCast(node: TypeCastNode): Promise<unknown> {
        const value = await this.evaluate(node.expression);

        // Type conversion is now handled by the VariableAtom itself
        return value;
    }

    private async evaluateSetLiteral(node: SetLiteralNode): Promise<Set<unknown>> {
        const values = new Set<unknown>();
        for (const element of node.elements) {
            values.add(await this.evaluate(element));
        }
        return values;
    }

    /**
     * Check if a value is truthy
     */
    private isTruthy(value: unknown): boolean {
        if (value === null || value === undefined) {
            return false;
        }

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value === "number") {
            return value !== 0;
        }

        if (typeof value === "string") {
            return value.length > 0;
        }

        return true;
    }

    /**
     * Check if two values are equal
     */
    private isEqual(a: unknown, b: unknown): boolean {
        if (a === b) {
            return true;
        }

        // Handle number comparison with tolerance
        if (typeof a === "number" && typeof b === "number") {
            return Math.abs(a - b) < 1e-10;
        }

        // Handle array comparison
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) {
                return false;
            }

            for (let i = 0; i < a.length; i++) {
                if (!this.isEqual(a[i], b[i])) {
                    return false;
                }
            }

            return true;
        }

        // Handle object comparison
        if (isRecord(a) && isRecord(b)) {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);

            if (aKeys.length !== bKeys.length) {
                return false;
            }

            for (const key of aKeys) {
                if (!bKeys.includes(key) || !this.isEqual(a[key], b[key])) {
                    return false;
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Convert input to the appropriate type
     * Note: Type conversion is now primarily handled by VariableAtom instances,
     * but this method is kept for input operations where we don't yet have an atom.
     */
    private convertInput(input: string, targetType: PseudocodeType): unknown {
        switch (targetType) {
            case PseudocodeType.INTEGER:
                return parseInt(input, 10);
            case PseudocodeType.REAL:
                return parseFloat(input);
            case PseudocodeType.CHAR:
                return input.charAt(0);
            case PseudocodeType.STRING:
                return input;
            case PseudocodeType.BOOLEAN:
                return input.toLowerCase() === "true";
            case PseudocodeType.DATE:
                return new Date(input);
        }
    }

    /**
     * Create an empty array with the specified bounds
     */
    private createEmptyArray(arrayType: ArrayTypeInfo): unknown[] {
        if (arrayType.bounds.length === 1) {
            const bound = this.numericArrayBound(this.resolveArrayBound(arrayType.bounds[0]));
            const size = bound.upper - bound.lower + 1;
            return Array.from({ length: size }, () =>
                this.getDefaultValueForFieldType(arrayType.elementType),
            );
        }

        // Create multi-dimensional array recursively
        const result: unknown[] = [];
        const bound = this.numericArrayBound(this.resolveArrayBound(arrayType.bounds[0]));
        const size = bound.upper - bound.lower + 1;

        const subArrayType: ArrayTypeInfo = {
            elementType: arrayType.elementType,
            bounds: arrayType.bounds.slice(1),
        };

        for (let i = 0; i < size; i++) {
            result.push(this.createEmptyArray(subArrayType));
        }

        return result;
    }

    private getDefaultValueForPrimitiveType(type: PseudocodeType): unknown {
        switch (type) {
            case PseudocodeType.INTEGER:
            case PseudocodeType.REAL:
                return 0;
            case PseudocodeType.CHAR:
                return " ";
            case PseudocodeType.STRING:
                return "";
            case PseudocodeType.BOOLEAN:
                return false;
            case PseudocodeType.DATE:
                return new Date(0);
        }
    }

    private getDefaultValueForFieldType(type: TypeInfo): unknown {
        if (typeof type === "string") {
            return this.getDefaultValueForPrimitiveType(type);
        }
        if ("kind" in type && type.kind === "ENUM") {
            return type.values[0] ?? "";
        }
        if ("kind" in type && type.kind === "SET") {
            return new Set();
        }
        if ("fields" in type) {
            const result: Record<string, unknown> = {};
            for (const [fieldName, fieldType] of Object.entries(type.fields)) {
                result[fieldName] = this.getDefaultValueForFieldType(fieldType);
            }
            return result;
        }
        return this.createEmptyArray(type);
    }

    private resolveType(
        type: TypeInfo,
        line?: number,
        column?: number,
        resolving: Set<string> = new Set(),
    ): TypeInfo {
        if (typeof type === "string") {
            return type;
        }

        if ("kind" in type) {
            return type;
        }

        if ("elementType" in type) {
            return {
                elementType: this.resolveType(type.elementType, line, column, resolving),
                bounds: type.bounds.map((bound) => this.resolveArrayBound(bound, line, column)),
            };
        }

        if (Object.keys(type.fields).length > 0) {
            const resolvedFields: Record<string, TypeInfo> = {};
            for (const [fieldName, fieldType] of Object.entries(type.fields)) {
                resolvedFields[fieldName] = this.resolveType(fieldType, line, column, resolving);
            }
            return {
                name: type.name,
                fields: resolvedFields,
            };
        }

        const lookupName = type.name.toUpperCase();
        if (resolving.has(lookupName)) {
            throw new RuntimeError(`Recursive type '${type.name}' is not supported`, line, column);
        }

        resolving.add(lookupName);
        const resolved = this.userDefinedTypes.get(type.name.toUpperCase());
        const resolvedEnum = this.enumTypes.get(type.name.toUpperCase());
        if (resolvedEnum) {
            resolving.delete(lookupName);
            return resolvedEnum;
        }
        const resolvedSet = this.setTypes.get(type.name.toUpperCase());
        if (resolvedSet) {
            resolving.delete(lookupName);
            return resolvedSet;
        }
        if (!resolved) {
            resolving.delete(lookupName);
            throw new RuntimeError(`Unknown type '${type.name}'`, line, column);
        }

        const resolvedFields: Record<string, TypeInfo> = {};
        for (const [fieldName, fieldType] of Object.entries(resolved.fields)) {
            resolvedFields[fieldName] = this.resolveType(fieldType, line, column, resolving);
        }
        resolving.delete(lookupName);

        return {
            name: resolved.name,
            fields: resolvedFields,
        };
    }

    private resolveArrayBound(bound: ArrayBound, line?: number, column?: number): ArrayBound {
        return {
            lower: this.resolveArrayBoundValue(bound.lower, line, column),
            upper: this.resolveArrayBoundValue(bound.upper, line, column),
        };
    }

    private numericArrayBound(bound: ArrayBound): { lower: number; upper: number } {
        if (!Number.isInteger(bound.lower) || !Number.isInteger(bound.upper)) {
            throw new RuntimeError("Array bounds must resolve to INTEGER values");
        }

        return { lower: Number(bound.lower), upper: Number(bound.upper) };
    }

    private resolveArrayBoundValue(value: number | string, line?: number, column?: number): number {
        if (typeof value === "number") {
            return value;
        }

        const resolved = this.environment.get(value);
        if (typeof resolved !== "number" || !Number.isInteger(resolved)) {
            throw new RuntimeError(
                `Array bound variable '${value}' must contain an INTEGER value`,
                line,
                column,
            );
        }

        return resolved;
    }

    /**
     * Get an element from an array at the specified indices
     */
    private getArrayElement(array: unknown, indices: number[]): unknown {
        // Handle ArrayAtom
        if (isArrayAtom(array)) {
            if (!Array.isArray(array.value)) {
                throw new RuntimeError("Array access on non-array value");
            }
            const arrayValue = array.value;
            return this.getArrayElementFromValue(arrayValue, indices);
        }

        // Handle regular array
        if (!Array.isArray(array)) {
            throw new RuntimeError("Array access on non-array value");
        }

        return this.getArrayElementFromValue(array, indices);
    }

    /**
     * Get an element from an array value at the specified indices
     */
    private getArrayElementFromValue(array: unknown[], indices: number[]): unknown {
        if (indices.length === 1) {
            const index = indices[0];
            if (!Number.isInteger(index)) {
                throw new IndexError("Array index must be INTEGER");
            }
            if (index < 1 || index > array.length) {
                throw new IndexError(`Array index out of bounds: ${index}`);
            }

            // Convert from 1-based to 0-based indexing
            return array[index - 1];
        }

        const subArray = array[indices[0] - 1];
        if (!Array.isArray(subArray)) {
            throw new RuntimeError("Array access on non-array value");
        }
        return this.getArrayElementFromValue(subArray, indices.slice(1));
    }

    /**
     * Set an element in an array at the specified indices
     */
    private setArrayElement(array: unknown, indices: number[], value: unknown): void {
        // Handle ArrayAtom
        if (isArrayAtom(array)) {
            if (!Array.isArray(array.value)) {
                throw new RuntimeError("Array access on non-array value");
            }
            const cloned = structuredClone(array.value);
            this.setArrayElementInValue(cloned, indices, value);
            array.value = cloned;
            return;
        }

        // Handle regular array
        if (!Array.isArray(array)) {
            throw new RuntimeError("Array access on non-array value");
        }

        this.setArrayElementInValue(array, indices, value);
    }

    /**
     * Set an element in an array value at the specified indices
     */
    private setArrayElementInValue(array: unknown[], indices: number[], value: unknown): void {
        if (indices.length === 1) {
            const index = indices[0];
            if (!Number.isInteger(index)) {
                throw new IndexError("Array index must be INTEGER");
            }
            if (index < 1 || index > array.length) {
                throw new IndexError(`Array index out of bounds: ${index}`);
            }

            // Convert from 1-based to 0-based indexing
            array[index - 1] = value;
            return;
        }

        const subArray = array[indices[0] - 1];
        if (!Array.isArray(subArray)) {
            throw new RuntimeError("Array access on non-array value");
        }
        this.setArrayElementInValue(subArray, indices.slice(1), value);
    }

    /**
     * Initialize built-in routines
     */
    private initializeBuiltInRoutines(): void {
        Object.keys(builtInFunctions).forEach((name) => {
            this.globalRoutines.set(name, { ...builtInFunctions[name], name });
        });
    }

    async dispose(): Promise<string[]> {
        return this.fileManager.closeAll();
    }
}
