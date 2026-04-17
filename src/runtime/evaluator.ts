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
    PointerDereferenceNode,
    AddressOfNode,
    DisposeStatementNode,
} from "../parser/ast-nodes";

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
    | SetLiteralNode
    | PointerDereferenceNode
    | AddressOfNode
    | DisposeStatementNode;

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
        case "PointerDereference":
        case "AddressOf":
        case "DisposeStatement":
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

function isPointerDereferenceNode(node: ExpressionNode): node is PointerDereferenceNode {
    return node.type === "PointerDereference";
}

function isProcedureDeclarationNode(node: ASTNode): node is ProcedureDeclarationNode {
    return node.type === "ProcedureDeclaration";
}

function isFunctionDeclarationNode(node: ASTNode): node is FunctionDeclarationNode {
    return node.type === "FunctionDeclaration";
}

function ensureNumber(value: unknown, line?: number, column?: number): number {
    if (typeof value !== "number") {
        throw new RuntimeError("Expected numeric value", line, column);
    }
    return value;
}

function ensureIndices(values: unknown[], line?: number, column?: number): number[] {
    return values.map((value) => {
        const num = ensureNumber(value, line, column);
        if (!Number.isInteger(num)) {
            throw new IndexError("Array index must be INTEGER", line, column);
        }
        return num;
    });
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
    PointerTypeInfo,
    TypeInfo,
    ParameterMode,
    TypeValidator,
} from "../types";

import { RuntimeError, DivisionByZeroError, IndexError } from "../errors";

import builtInFunctions from "./builtin-functions";
import { RuntimeFileManager } from "./file-manager";
import { FileOperationEvaluator } from "./file-operations-evaluator";
import { ResultAsync, okAsync, errAsync } from "neverthrow";
import { RuntimeAsyncResult, toRuntimeError } from "../result";

import { Environment, ExecutionContext, RoutineInfo } from "./environment";
import { IOInterface } from "../io/io-interface";
import { VariableAtomFactory, VariableAtom } from "./variable-atoms";
import { DebuggerController, DebugSnapshot, type DebugPauseReason } from "./debugger";
import { Heap, NULL_POINTER } from "./heap";

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
    private pointerTypes: Map<string, PointerTypeInfo> = new Map();
    private debuggerController?: DebuggerController;
    private heap: Heap;

    constructor(io: IOInterface) {
        this.io = io;
        this.heap = new Heap();
        this.environment = new Environment(this.heap);
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

    evaluateR(node: ASTNode): RuntimeAsyncResult<unknown> {
        if (!isEvaluatableNode(node)) {
            return errAsync(
                new RuntimeError(`Unknown node type: ${node.type}`, node.line, node.column),
            );
        }

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
                return ResultAsync.fromPromise(this.evaluateDebugger(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
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

            case "PointerDereference":
                return ResultAsync.fromPromise(
                    this.evaluatePointerDereference(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
                );

            case "AddressOf":
                return ResultAsync.fromPromise(this.evaluateAddressOf(node), (error: unknown) =>
                    toRuntimeError(error, node.line, node.column),
                );

            case "DisposeStatement":
                return ResultAsync.fromPromise(
                    this.evaluateDisposeStatement(node),
                    (error: unknown) => toRuntimeError(error, node.line, node.column),
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
        return this.pauseForStepBeforeStatementR(statement).andThen(() =>
            this.evaluateR(statement).orElse((error: RuntimeError) => {
                if (this.debuggerController && error instanceof RuntimeError) {
                    const snapshot = this.buildDebugSnapshot(
                        "error",
                        error.line ?? statement.line,
                        error.column ?? statement.column,
                    );
                    snapshot.error = {
                        message: error.message,
                        line: error.line,
                        column: error.column,
                    };
                    return ResultAsync.fromPromise(
                        this.debuggerController.maybePause(snapshot),
                        () => error,
                    ).andThen(() => errAsync(error));
                }
                return errAsync(error);
            }),
        );
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
        reason: DebugPauseReason,
        line?: number,
        column?: number,
    ): DebugSnapshot {
        const heapSnapshot = new Map<
            number,
            { value: unknown; type: TypeInfo; refCount: number }
        >();
        for (const [addr, obj] of this.heap.getSnapshot().entries()) {
            heapSnapshot.set(addr, { value: obj.value, type: obj.type, refCount: obj.refCount });
        }

        const scopes = this.debuggerController
            ? this.environment.getDebugScopes().map((scope, index) => ({
                  scopeName: index === 0 ? "local" : "global",
                  variables: this.debuggerController!.variablesToDebugWithHeap(
                      scope.variables,
                      heapSnapshot,
                  ),
              }))
            : [];

        return {
            reason,
            location: {
                line,
                column,
            },
            scopes,
            callStack: this.context.callStack.map((frame) => ({
                routineName: frame.routineName,
                line: frame.returnAddress?.line,
                column: frame.returnAddress?.column,
            })),
            heapSnapshot,
        };
    }

    private async evaluateDeclareStatement(node: DeclareStatementNode): Promise<void> {
        const initialValue = node.initialValue ? await this.evaluate(node.initialValue) : undefined;

        let resolvedType: TypeInfo;
        if (
            typeof node.dataType === "object" &&
            "kind" in node.dataType &&
            node.dataType.kind === "INFERRED"
        ) {
            if (initialValue === undefined) {
                throw new RuntimeError(
                    "Cannot infer type for constant without initial value",
                    node.line,
                    node.column,
                );
            }
            resolvedType = this.inferTypeFromValue(initialValue);
        } else {
            resolvedType = this.resolveType(node.dataType, node.line, node.column);
        }

        const finalValue = initialValue ?? this.getDefaultValue(resolvedType);

        this.environment.define(node.name, resolvedType, finalValue, node.isConstant);
    }

    private inferTypeFromValue(value: unknown): TypeInfo {
        if (typeof value === "number") {
            return Number.isInteger(value) ? PseudocodeType.INTEGER : PseudocodeType.REAL;
        }
        if (typeof value === "string") {
            return value.length === 1 ? PseudocodeType.CHAR : PseudocodeType.STRING;
        }
        if (typeof value === "boolean") {
            return PseudocodeType.BOOLEAN;
        }
        if (value instanceof Date) {
            return PseudocodeType.DATE;
        }
        return PseudocodeType.STRING;
    }

    private async evaluateTypeof(node: CallExpressionNode): Promise<string> {
        const argNode = node.arguments[0];

        if (isIdentifierNode(argNode)) {
            try {
                const declaredType = this.environment.getType(argNode.name);
                return TypeValidator.typeInfoToName(declaredType);
            } catch {
                const value = await this.evaluate(argNode);
                return TypeValidator.typeInfoToName(this.inferTypeFromValue(value));
            }
        }

        if (isArrayAccessNode(argNode)) {
            try {
                const rootAtom = this.resolveArrayRootAtom(argNode);
                const elementType = this.resolveArrayElementType(
                    rootAtom.type,
                    this.countArrayAccessDepth(argNode),
                );
                return TypeValidator.typeInfoToName(elementType);
            } catch {
                const value = await this.evaluate(argNode);
                return TypeValidator.typeInfoToName(this.inferTypeFromValue(value));
            }
        }

        if (isMemberAccessNode(argNode)) {
            try {
                const memberType = this.resolveMemberAccessType(argNode);
                return TypeValidator.typeInfoToName(memberType);
            } catch {
                const value = await this.evaluate(argNode);
                return TypeValidator.typeInfoToName(this.inferTypeFromValue(value));
            }
        }

        const value = await this.evaluate(argNode);
        return TypeValidator.typeInfoToName(this.inferTypeFromValue(value));
    }

    private countArrayAccessDepth(node: ArrayAccessNode): number {
        let depth = 1;
        if (isArrayAccessNode(node.array)) {
            depth += this.countArrayAccessDepth(node.array);
        }
        return depth;
    }

    private resolveMemberAccessType(node: MemberAccessNode): TypeInfo {
        if (isIdentifierNode(node.object)) {
            const objType = this.environment.getType(node.object.name);
            if (typeof objType === "object" && objType !== null && "fields" in objType) {
                const fieldType = getRecordField(objType.fields, node.field);
                if (fieldType !== undefined) {
                    return fieldType;
                }
            }
        }
        throw new RuntimeError("Cannot resolve member type", node.line, node.column);
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

    private async evaluateVariableDeclaration(node: VariableDeclarationNode): Promise<void> {
        const resolvedType = this.resolveType(node.dataType, node.line, node.column);
        const initialValue = node.initialValue
            ? await this.evaluate(node.initialValue)
            : this.getDefaultValue(resolvedType);

        this.environment.define(node.name, resolvedType, initialValue, node.isConstant);
    }

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
            const address = await this.resolveTargetAddress(node.target);

            let elementType: TypeInfo = PseudocodeType.INTEGER;
            if (isIdentifierNode(node.target.array)) {
                const typeInfo = this.environment.getType(node.target.array.name);
                if (
                    typeof typeInfo === "object" &&
                    typeInfo !== null &&
                    "elementType" in typeInfo
                ) {
                    elementType = this.resolveArrayElementType(
                        typeInfo,
                        node.target.indices.length,
                    );
                }
            }

            VariableAtomFactory.validateValue(elementType, value);

            const writeResult = this.heap.write(address, value, elementType);
            if (writeResult.isErr()) {
                throw writeResult.error;
            }
        } else if (isMemberAccessNode(node.target)) {
            const memberAccess = node.target;
            const declaredParentType = this.resolveMemberPathType(memberAccess.object);

            let fieldType: TypeInfo = PseudocodeType.STRING;
            if (declaredParentType) {
                const resolved = getRecordField(declaredParentType.fields, memberAccess.field);
                if (resolved === undefined) {
                    throw new RuntimeError(
                        `Unknown field '${memberAccess.field}' on type '${declaredParentType.name}'`,
                        node.line,
                        node.column,
                    );
                }
                fieldType = resolved;
            }

            VariableAtomFactory.validateValue(fieldType, value);

            const address = await this.resolveTargetAddress(node.target);
            const writeResult = this.heap.write(address, value, fieldType);
            if (writeResult.isErr()) {
                throw writeResult.error;
            }
        } else if (isPointerDereferenceNode(node.target)) {
            const ptrValue = await this.evaluate(node.target.pointer);
            if (ptrValue === null || ptrValue === undefined) {
                throw new RuntimeError("Null pointer dereference", node.line, node.column);
            }
            if (typeof ptrValue !== "number") {
                throw new RuntimeError(
                    "Cannot dereference non-pointer value",
                    node.line,
                    node.column,
                );
            }

            let targetType: TypeInfo = PseudocodeType.INTEGER;
            if (isIdentifierNode(node.target.pointer)) {
                const ptrType = this.environment.getType(node.target.pointer.name);
                if (
                    typeof ptrType === "object" &&
                    ptrType !== null &&
                    "kind" in ptrType &&
                    ptrType.kind === "POINTER"
                ) {
                    targetType = ptrType.pointedType;
                }
            }

            VariableAtomFactory.validateValue(targetType, value);

            const writeResult = this.heap.write(ptrValue, value, targetType);
            if (writeResult.isErr()) {
                throw writeResult.error;
            }
        } else {
            throw new RuntimeError("Invalid assignment target", node.line, node.column);
        }
    }

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

        if (!executed && node.otherwise) {
            for (const statement of node.otherwise) {
                await this.executeStatement(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        }
    }

    private async evaluateFor(node: ForNode): Promise<void> {
        const start = ensureNumber(await this.evaluate(node.start), node.line, node.column);
        const end = ensureNumber(await this.evaluate(node.end), node.line, node.column);
        const step = node.step
            ? ensureNumber(await this.evaluate(node.step), node.line, node.column)
            : 1;

        if (!this.environment.has(node.variable))
            this.environment.define(node.variable, PseudocodeType.INTEGER, start);

        const increment = step > 0;

        for (
            let currentValue = start;
            increment ? currentValue <= end : currentValue >= end;
            currentValue += step
        ) {
            this.environment.assign(node.variable, currentValue);

            for (const statement of node.body) {
                await this.executeStatement(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }

            currentValue = ensureNumber(
                this.environment.get(node.variable),
                node.line,
                node.column,
            );
        }
    }

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

    private async evaluateCallStatement(node: CallStatementNode): Promise<void> {
        await this.evaluateCallExpression({
            type: "CallExpression",
            name: node.name,
            arguments: node.arguments,
            line: node.line,
            column: node.column,
        });
    }

    private async evaluateInput(node: InputNode): Promise<void> {
        let promptText = "";

        if (node.prompt) {
            const promptValue = await this.evaluate(node.prompt);
            promptText = String(promptValue);
        }

        const input = await this.io.input(promptText);
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

    private async evaluateOutput(node: OutputNode): Promise<void> {
        const outputValues: string[] = [];

        for (const expression of node.expressions) {
            const value = await this.evaluate(expression);
            outputValues.push(String(value));
        }

        this.io.output(outputValues.join("") + "\n");
    }

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
            return ResultAsync.fromPromise(this.resolveTargetAddress(target), (error: unknown) =>
                toRuntimeError(error, line, column),
            ).andThen((address) => {
                try {
                    let elementType: TypeInfo = PseudocodeType.INTEGER;
                    if (isIdentifierNode(target.array)) {
                        const typeInfo = this.environment.getType(target.array.name);
                        if (
                            typeof typeInfo === "object" &&
                            typeInfo !== null &&
                            "elementType" in typeInfo
                        ) {
                            elementType = this.resolveArrayElementType(
                                typeInfo,
                                target.indices.length,
                            );
                        }
                    }

                    VariableAtomFactory.validateValue(elementType, value);

                    const writeResult = this.heap.write(address, value, elementType);
                    if (writeResult.isErr()) {
                        throw writeResult.error;
                    }
                    return okAsync(undefined);
                } catch (error) {
                    return errAsync(toRuntimeError(error, line, column));
                }
            });
        }

        return ResultAsync.fromPromise(
            Promise.reject(new RuntimeError("Invalid assignment target", line, column)),
            (error: unknown) => toRuntimeError(error, line, column),
        );
    }

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

        if (node.pointerType) {
            const resolvedPointerType = this.resolveType(node.pointerType);
            if (
                typeof resolvedPointerType === "object" &&
                "kind" in resolvedPointerType &&
                resolvedPointerType.kind === "POINTER"
            ) {
                const pointerType: PointerTypeInfo = {
                    kind: "POINTER",
                    name: node.name,
                    pointedType: resolvedPointerType.pointedType,
                };
                this.pointerTypes.set(node.name.toUpperCase(), pointerType);
                return;
            }
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
            VariableAtomFactory.validateValue(setType.elementType, value);
            values.add(value);
        }

        this.environment.define(node.name, setType, values, false);
    }

    private evaluateClassDeclaration(node: ClassDeclarationNode): void {
        const classDef = {
            name: node.name,
            inherits: node.inherits,
            fields: node.fields,
            methods: node.methods,
        };

        this.environment.define(node.name, PseudocodeType.STRING, JSON.stringify(classDef), true);
    }

    private async evaluateBinaryExpression(node: BinaryExpressionNode): Promise<unknown> {
        const left = await this.evaluate(node.left);
        const right = await this.evaluate(node.right);

        switch (node.operator) {
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

    private evaluateLiteral(node: LiteralNode) {
        return node.value;
    }

    private async evaluateArrayAccess(node: ArrayAccessNode): Promise<unknown> {
        const address = await this.resolveTargetAddress(node);
        const result = this.heap.read(address);
        if (result.isErr()) {
            throw result.error;
        }
        return result.value.value;
    }

    private async evaluateCallExpression(node: CallExpressionNode): Promise<unknown> {
        const routineName = node.name;

        if (routineName === "EOF") {
            return this.fileOperations.evaluateEOFCall(node.arguments, node.line, node.column);
        }

        if (routineName === "TYPEOF") {
            return this.evaluateTypeof(node);
        }

        if (this.globalRoutines.has(routineName)) {
            const routineInfo = this.globalRoutines.get(routineName)!;

            if (routineInfo.isBuiltIn && routineInfo.implementation) {
                const args = await Promise.all(
                    node.arguments.map(async (arg) => this.evaluate(arg)),
                );
                return routineInfo.implementation(...args);
            }
        }

        const signature = this.environment.getRoutine(routineName);

        const routineEnvironment = this.environment.createChild();

        for (let i = 0; i < signature.parameters.length; i++) {
            const param = signature.parameters[i];
            const argNode = node.arguments[i];

            if (param.mode === ParameterMode.BY_REFERENCE) {
                if (!argNode) {
                    throw new RuntimeError(
                        `BYREF parameter '${param.name}' requires an argument`,
                        node.line,
                        node.column,
                    );
                }

                if (isIdentifierNode(argNode)) {
                    const callerAtom = this.environment.getAtom(argNode.name);
                    routineEnvironment.defineByRef(param.name, param.type, callerAtom.getAddress());
                } else if (isArrayAccessNode(argNode) || isMemberAccessNode(argNode)) {
                    const address = await this.resolveTargetAddress(argNode);
                    routineEnvironment.defineByRef(param.name, param.type, address);
                } else {
                    throw new RuntimeError(
                        `BYREF parameter '${param.name}' requires a variable, array element, or record field argument`,
                        node.line,
                        node.column,
                    );
                }
            } else {
                const arg = await this.evaluate(argNode);
                const fromHeap =
                    typeof param.type === "object" &&
                    param.type !== null &&
                    ("elementType" in param.type || "fields" in param.type);
                routineEnvironment.define(param.name, param.type, arg, false, fromHeap);
            }
        }

        const routineContext = new ExecutionContext(routineEnvironment);
        const returnAddress =
            this.context.currentLine !== undefined && this.context.currentColumn !== undefined
                ? { line: this.context.currentLine, column: this.context.currentColumn }
                : undefined;

        routineContext.callStack = [...this.context.callStack];
        routineContext.pushCallFrame({
            routineName,
            environment: this.environment,
            returnAddress,
        });

        const previousContext = this.context;
        const previousEnvironment = this.environment;
        this.context = routineContext;
        this.environment = routineEnvironment;

        let result: unknown;

        if (this.globalRoutines.has(routineName)) {
            const routineInfo = this.globalRoutines.get(routineName)!;

            if (routineInfo.node) {
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

        this.context = previousContext;
        this.environment = previousEnvironment;

        routineEnvironment.disposeScope();

        return result;
    }

    private async evaluateMemberAccess(node: MemberAccessNode): Promise<unknown> {
        const address = await this.resolveTargetAddress(node);
        const result = this.heap.read(address);
        if (result.isErr()) {
            throw result.error;
        }
        return result.value.value;
    }

    private resolveMemberPathType(expression: ExpressionNode): UserDefinedTypeInfo | undefined {
        if (isIdentifierNode(expression)) {
            const typeInfo = this.environment.getType(expression.name);
            if (typeof typeInfo === "object" && typeInfo !== null && "fields" in typeInfo) {
                return typeInfo;
            }
            return undefined;
        }

        if (isArrayAccessNode(expression)) {
            const arrayType = this.resolveMemberPathType(expression.array);
            if (arrayType) {
                return arrayType;
            }
            if (isIdentifierNode(expression.array)) {
                const typeInfo = this.environment.getType(expression.array.name);
                if (
                    typeof typeInfo === "object" &&
                    typeInfo !== null &&
                    "elementType" in typeInfo
                ) {
                    const elementType = this.resolveArrayElementType(
                        typeInfo,
                        expression.indices.length,
                    );
                    if (
                        typeof elementType === "object" &&
                        elementType !== null &&
                        "fields" in elementType
                    ) {
                        return elementType;
                    }
                }
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

        if (isPointerDereferenceNode(expression)) {
            const pointedType = this.resolvePointedType(expression.pointer);
            if (
                pointedType &&
                typeof pointedType === "object" &&
                pointedType !== null &&
                "fields" in pointedType
            ) {
                return pointedType;
            }
            return undefined;
        }

        return undefined;
    }

    private resolvePointedType(pointerExpr: ExpressionNode): TypeInfo | undefined {
        if (isIdentifierNode(pointerExpr)) {
            const ptrType = this.environment.getType(pointerExpr.name);
            if (
                typeof ptrType === "object" &&
                ptrType !== null &&
                "kind" in ptrType &&
                ptrType.kind === "POINTER"
            ) {
                return ptrType.pointedType;
            }
            return undefined;
        }

        if (isArrayAccessNode(pointerExpr)) {
            const arrayElementType = this.resolveArrayAccessType(pointerExpr);
            if (
                arrayElementType &&
                typeof arrayElementType === "object" &&
                "kind" in arrayElementType &&
                arrayElementType.kind === "POINTER"
            ) {
                return arrayElementType.pointedType;
            }
            return undefined;
        }

        if (isMemberAccessNode(pointerExpr)) {
            const parentType = this.resolveMemberPathType(pointerExpr.object);
            if (parentType) {
                const fieldType = parentType.fields[pointerExpr.field];
                if (
                    fieldType &&
                    typeof fieldType === "object" &&
                    "kind" in fieldType &&
                    fieldType.kind === "POINTER"
                ) {
                    return fieldType.pointedType;
                }
            }
            return undefined;
        }

        return undefined;
    }

    private resolveArrayAccessType(node: ArrayAccessNode): TypeInfo | undefined {
        if (isIdentifierNode(node.array)) {
            const typeInfo = this.environment.getType(node.array.name);
            if (typeof typeInfo === "object" && typeInfo !== null && "elementType" in typeInfo) {
                return this.resolveArrayElementType(typeInfo, node.indices.length);
            }
        }
        return undefined;
    }

    private evaluateNewExpression(node: NewExpressionNode): unknown {
        const resolvedType = this.resolveType(
            { name: node.className, fields: {} },
            node.line,
            node.column,
        );

        if (typeof resolvedType === "object" && "fields" in resolvedType) {
            const defaultValue = this.buildDefaultUserDefinedValue(resolvedType.fields);
            const address = this.heap.allocate(defaultValue, resolvedType);
            return address;
        }

        const address = this.heap.allocate({}, { name: node.className, fields: {} });
        return address;
    }

    private async evaluateTypeCast(node: TypeCastNode): Promise<unknown> {
        const value = await this.evaluate(node.expression);
        return value;
    }

    private async evaluateSetLiteral(node: SetLiteralNode): Promise<Set<unknown>> {
        const values = new Set<unknown>();
        for (const element of node.elements) {
            values.add(await this.evaluate(element));
        }
        return values;
    }

    private async evaluatePointerDereference(node: PointerDereferenceNode): Promise<unknown> {
        const ptrValue = await this.evaluate(node.pointer);

        if (ptrValue === null || ptrValue === undefined) {
            throw new RuntimeError("Null pointer dereference", node.line, node.column);
        }

        if (typeof ptrValue !== "number") {
            throw new RuntimeError("Cannot dereference non-pointer value", node.line, node.column);
        }

        const heapResult = this.heap.read(ptrValue);
        if (heapResult.isErr()) {
            throw heapResult.error;
        }

        return heapResult.value.value;
    }

    private async evaluateAddressOf(node: AddressOfNode): Promise<number> {
        return this.resolveTargetAddress(node.target);
    }

    private async resolveTargetAddress(target: ExpressionNode): Promise<number> {
        if (isIdentifierNode(target)) {
            const atom = this.environment.getAtom(target.name);
            return atom.getAddress();
        }

        if (isArrayAccessNode(target)) {
            const arrayAtom = this.resolveArrayRootAtom(target);
            const indices = ensureIndices(
                await Promise.all(target.indices.map(async (index) => this.evaluate(index))),
                target.line,
                target.column,
            );

            const arrayAddress = arrayAtom.getAddress();
            const elemAddrResult = this.heap.readElementAddress(arrayAddress, indices[0]);
            if (elemAddrResult.isErr()) {
                throw elemAddrResult.error;
            }

            if (indices.length === 1) {
                return elemAddrResult.value;
            }

            let currentAddress = elemAddrResult.value;
            for (let i = 1; i < indices.length; i++) {
                const subArrayResult = this.heap.read(currentAddress);
                if (subArrayResult.isErr()) {
                    throw subArrayResult.error;
                }
                const subArray = subArrayResult.value.value;
                if (!Array.isArray(subArray)) {
                    throw new RuntimeError(
                        "Multi-dimensional array access on non-array",
                        target.line,
                        target.column,
                    );
                }
                if (indices[i] < 1 || indices[i] > subArray.length) {
                    throw new RuntimeError(
                        `Array index out of bounds: ${indices[i]}`,
                        target.line,
                        target.column,
                    );
                }
                const element: unknown = subArray[indices[i] - 1];
                if (typeof element !== "number") {
                    throw new RuntimeError(
                        "Invalid array element address",
                        target.line,
                        target.column,
                    );
                }
                currentAddress = element;
            }

            return currentAddress;
        }

        if (isMemberAccessNode(target)) {
            const parentAddress = await this.resolveTargetAddress(target.object);
            const fieldAddrResult = this.heap.readFieldAddress(parentAddress, target.field);
            if (fieldAddrResult.isErr()) {
                throw fieldAddrResult.error;
            }
            return fieldAddrResult.value;
        }

        if (isPointerDereferenceNode(target)) {
            const ptrValue = await this.evaluate(target.pointer);
            if (typeof ptrValue !== "number") {
                throw new RuntimeError(
                    "Cannot dereference non-pointer value",
                    target.line,
                    target.column,
                );
            }
            return ptrValue;
        }

        throw new RuntimeError(
            "Cannot take address of this expression",
            target.line,
            target.column,
        );
    }

    private resolveArrayRootAtom(node: ArrayAccessNode): VariableAtom {
        if (isIdentifierNode(node.array)) {
            return this.environment.getAtom(node.array.name);
        }
        if (isArrayAccessNode(node.array)) {
            return this.resolveArrayRootAtom(node.array);
        }
        throw new RuntimeError("Invalid array access target", node.line, node.column);
    }

    private resolveArrayElementType(arrayType: TypeInfo, indexCount: number): TypeInfo {
        let currentType: TypeInfo = arrayType;
        for (let i = 0; i < indexCount; i++) {
            if (
                typeof currentType === "object" &&
                currentType !== null &&
                "elementType" in currentType
            ) {
                currentType = currentType.elementType;
            } else {
                break;
            }
        }
        return currentType;
    }

    private async evaluateDisposeStatement(node: DisposeStatementNode): Promise<void> {
        const addr = await this.evaluate(node.pointer);

        if (addr === null || addr === undefined) {
            return;
        }

        if (typeof addr !== "number") {
            throw new RuntimeError("Cannot dispose non-pointer value", node.line, node.column);
        }

        const result = this.heap.deallocate(addr);
        if (result.isErr()) {
            throw result.error;
        }
    }

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

    private isEqual(a: unknown, b: unknown): boolean {
        if (a === b) {
            return true;
        }

        if (typeof a === "number" && typeof b === "number") {
            return Math.abs(a - b) < 1e-10;
        }

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
            case PseudocodeType.ANY:
                return input;
        }
    }

    private createEmptyArray(arrayType: ArrayTypeInfo): unknown[] {
        if (arrayType.bounds.length === 1) {
            const bound = this.numericArrayBound(this.resolveArrayBound(arrayType.bounds[0]));
            const size = bound.upper - bound.lower + 1;
            return Array.from({ length: size }, () =>
                this.getDefaultValueForFieldType(arrayType.elementType),
            );
        }

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
            case PseudocodeType.ANY:
                return null;
        }
    }

    private getDefaultValueForFieldType(type: TypeInfo): unknown {
        if (typeof type === "string") {
            return this.getDefaultValueForPrimitiveType(type);
        }
        if (typeof type === "object" && "kind" in type && type.kind === "ENUM") {
            return type.values[0] ?? "";
        }
        if (typeof type === "object" && "kind" in type && type.kind === "SET") {
            return new Set();
        }
        if (typeof type === "object" && "kind" in type && type.kind === "POINTER") {
            return NULL_POINTER;
        }
        if (typeof type === "object" && "kind" in type && type.kind === "INFERRED") {
            return 0;
        }
        if (typeof type === "object" && "fields" in type) {
            const result: Record<string, unknown> = {};
            for (const [fieldName, fieldType] of Object.entries(type.fields)) {
                result[fieldName] = this.getDefaultValueForFieldType(fieldType);
            }
            return result;
        }
        return this.createEmptyArray(type);
    }

    private getDefaultValue(type: TypeInfo): unknown {
        return this.getDefaultValueForFieldType(type);
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

        if (typeof type === "object" && "kind" in type) {
            if (type.kind === "POINTER") {
                return {
                    kind: "POINTER",
                    name: type.name,
                    pointedType: this.resolveType(type.pointedType, line, column, resolving),
                };
            }
            return type;
        }

        if (typeof type === "object" && "elementType" in type) {
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
        const resolvedPointer = this.pointerTypes.get(type.name.toUpperCase());
        if (resolvedPointer) {
            resolving.delete(lookupName);
            return resolvedPointer;
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

    private getArrayElement(array: unknown, indices: number[]): unknown {
        if (!Array.isArray(array)) {
            throw new RuntimeError("Array access on non-array value");
        }

        return this.getArrayElementFromValue(array, indices);
    }

    private getArrayElementFromValue(array: unknown[], indices: number[]): unknown {
        if (indices.length === 1) {
            const index = indices[0];
            if (!Number.isInteger(index)) {
                throw new IndexError("Array index must be INTEGER");
            }
            if (index < 1 || index > array.length) {
                throw new IndexError(`Array index out of bounds: ${index}`);
            }

            return array[index - 1];
        }

        const subArray = array[indices[0] - 1];
        if (!Array.isArray(subArray)) {
            throw new RuntimeError("Array access on non-array value");
        }
        return this.getArrayElementFromValue(subArray, indices.slice(1));
    }

    private setArrayElement(array: unknown, indices: number[], value: unknown): void {
        if (!Array.isArray(array)) {
            throw new RuntimeError("Array access on non-array value");
        }

        this.setArrayElementInValue(array, indices, value);
    }

    private setArrayElementInValue(array: unknown[], indices: number[], value: unknown): void {
        if (indices.length === 1) {
            const index = indices[0];
            if (!Number.isInteger(index)) {
                throw new IndexError("Array index must be INTEGER");
            }
            if (index < 1 || index > array.length) {
                throw new IndexError(`Array index out of bounds: ${index}`);
            }

            array[index - 1] = value;
            return;
        }

        const subArray = array[indices[0] - 1];
        if (!Array.isArray(subArray)) {
            throw new RuntimeError("Array access on non-array value");
        }
        this.setArrayElementInValue(subArray, indices.slice(1), value);
    }

    private initializeBuiltInRoutines(): void {
        Object.keys(builtInFunctions).forEach((name) => {
            this.globalRoutines.set(name, { ...builtInFunctions[name], name });
        });
    }

    async dispose(): Promise<string[]> {
        return this.fileManager.closeAll();
    }
}
