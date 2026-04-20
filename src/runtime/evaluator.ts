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
    MethodDeclarationNode,
    SuperCallNode,
    RuntimeMethodInfo,
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
    ImportStatementNode,
    ImportExpressionNode,
    ExportStatementNode,
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
    | MethodDeclarationNode
    | SuperCallNode
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
    | DisposeStatementNode
    | ImportStatementNode
    | ImportExpressionNode
    | ExportStatementNode;

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
        case "MethodDeclaration":
        case "SuperCall":
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
        case "ImportStatement":
        case "ImportExpression":
        case "ExportStatement":
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
    ParameterInfo,
    TypeValidator,
    ClassTypeInfo,
    ClassMethodInfo,
} from "../types";

import { RuntimeError, DivisionByZeroError, IndexError } from "../errors";

import builtInFunctions, { EXTENDED_BUILTIN_NAMES } from "./builtin-functions";
import { RuntimeFileManager, FileMode } from "./file-manager";
import { IOQueue } from "./io-queue";
import { RuntimeAsyncResult, toRuntimeError } from "../result";
import { ResultAsync } from "neverthrow";
import { Bounce, done, io, seq, seqMany, loop, fileOp, debugPause } from "./trampoline";
import { TrampolineEngine } from "./trampoline";

import { Environment, ExecutionContext } from "./environment";
import type { RoutineInfo } from "./environment";
import type { IOInterface } from "../io/io-interface";
import { VariableAtomFactory, VariableAtom } from "./variable-atoms";
import { DebuggerController, type DebugSnapshot, type DebugPauseReason } from "./debugger";
import { Heap, NULL_POINTER } from "./heap";
import type { ImportInfo } from "./linker";
import {
    resolveFullClassDefinition as resolveFullClassDefinitionHelper,
    findMethodInHierarchy,
    getDefaultValue as getDefaultValueHelper,
    resolveArrayElementType as resolveArrayElementTypeHelper,
} from "./oop-helpers";
import {
    serializeRecord as serializeRecordHelper,
    parseRecordData as parseRecordDataHelper,
    reconstructRecord as reconstructRecordHelper,
} from "./record-serializer";
import { resolveType as resolveTypeHelper } from "./type-resolver";

function extractRoutineBody(node: ASTNode | undefined): StatementNode[] {
    if (!node || typeof node !== "object") {
        return [];
    }
    // oxlint-disable-next-line no-unsafe-type-assertion
    const maybeBody = (node as unknown as Record<string, unknown>).body;
    if (!Array.isArray(maybeBody)) {
        return [];
    }
    // oxlint-disable-next-line no-unsafe-type-assertion
    return maybeBody as StatementNode[];
}

export class Evaluator {
    private environment: Environment;
    context: ExecutionContext;
    private io: IOInterface;
    private fileManager: RuntimeFileManager;
    private ioQueue: IOQueue;
    private globalRoutines: Map<string, RoutineInfo> = new Map();
    private userDefinedTypes: Map<string, UserDefinedTypeInfo> = new Map();
    private enumTypes: Map<string, EnumTypeInfo> = new Map();
    private setTypes: Map<string, SetTypeInfo> = new Map();
    private pointerTypes: Map<string, PointerTypeInfo> = new Map();
    private debuggerController?: DebuggerController;
    private onStep?: () => void;
    private heap: Heap;
    private strictMode: boolean;
    private namespaceImports: Map<string, ImportInfo> = new Map();
    private classDefinitions: Map<string, ClassTypeInfo> = new Map();
    private classMethodBodies: Map<string, Map<string, RuntimeMethodInfo>> = new Map();
    private resolvedClassCache: Map<string, ClassTypeInfo> = new Map();

    constructor(io: IOInterface, strictMode: boolean = false) {
        this.io = io;
        this.strictMode = strictMode;
        this.heap = new Heap();
        this.environment = new Environment(this.heap);
        this.context = new ExecutionContext(this.environment);
        this.fileManager = new RuntimeFileManager(io);
        this.ioQueue = new IOQueue(this.fileManager);
        this.initializeBuiltInRoutines();
    }

    setDebuggerController(controller?: DebuggerController): void {
        this.debuggerController = controller;
    }

    setOnStep(callback?: () => void): void {
        this.onStep = callback;
    }

    setNamespaceImports(imports: ImportInfo[]): void {
        for (const info of imports) {
            if (info.namespace) {
                this.namespaceImports.set(info.namespace, info);
            }
        }
    }

    evaluateProgramR(node: ProgramNode): RuntimeAsyncResult<unknown> {
        return ResultAsync.fromPromise(this.evaluateProgramBounce(node), (error: unknown) =>
            toRuntimeError(error, node.line, node.column),
        );
    }

    async evaluateProgramBounce(node: ProgramNode): Promise<unknown> {
        const bounce = this.executeStatementSeq(node.body);
        const engine = new TrampolineEngine(this.ioQueue, {
            onInput: async (prompt) => this.io.input(prompt),
            onOutput: (data) => {
                this.io.output(data);
            },
        });
        return engine.run(bounce);
    }

    private executeStatementSeq(statements: StatementNode[]): Bounce {
        return seqMany(
            statements.map((stmt) => () => this.executeStatementBounce(stmt)),
            () => done(undefined),
        );
    }

    private evaluateFileIdentifier(node: { fileIdentifier: ExpressionNode; line?: number; column?: number }): string {
        const fileId = this.evaluate(node.fileIdentifier);
        if (typeof fileId !== "string") {
            throw new RuntimeError(
                "File identifier must be a string",
                node.line,
                node.column,
            );
        }
        return fileId;
    }

    private async evaluateProgramImpl(node: ProgramNode): Promise<unknown> {
        return this.evaluateProgramBounce(node);
    }

    async evaluateProgram(node: ProgramNode): Promise<unknown> {
        return this.evaluateProgramImpl(node);
    }

    evaluate(node: ASTNode): unknown {
        if (!isEvaluatableNode(node)) {
            throw new RuntimeError(`Unknown node type: ${node.type}`, node.line, node.column);
        }

        if (node.line !== undefined) {
            this.context.currentLine = node.line;
        }
        if (node.column !== undefined) {
            this.context.currentColumn = node.column;
        }

        switch (node.type) {
            case "VariableDeclaration":
                this.evaluateVariableDeclaration(node);
                return undefined;

            case "DeclareStatement":
                this.evaluateDeclareStatement(node);
                return undefined;

            case "Assignment":
                this.evaluateAssignment(node);
                return undefined;

            case "If":
                this.evaluateIf(node);
                return undefined;

            case "Case":
                this.evaluateCase(node);
                return undefined;

            case "For":
                this.evaluateFor(node);
                return undefined;

            case "While":
                this.evaluateWhile(node);
                return undefined;

            case "Repeat":
                this.evaluateRepeat(node);
                return undefined;

            case "ProcedureDeclaration":
                this.evaluateProcedureDeclaration(node);
                return undefined;

            case "FunctionDeclaration":
                this.evaluateFunctionDeclaration(node);
                return undefined;

            case "CallStatement":
            case "Input":
                return undefined;

            case "Output": {
                const outputValues: string[] = [];
                for (const expression of node.expressions) {
                    const value = this.evaluate(expression);
                    outputValues.push(String(value));
                }
                this.io.output(outputValues.join("") + "\n");
                return undefined;
            }

            case "Return": {
                let value: unknown;
                if (node.value) {
                    value = this.evaluate(node.value);
                }
                this.context.setReturnValue(value);
                this.context.shouldReturn = true;
                return undefined;
            }

            case "OpenFile": {
                const fileId = this.evaluateFileIdentifier(node);
                return fileOp(
                    {
                        type: "open",
                        fileIdentifier: fileId,
                        mode: node.mode as FileMode,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "CloseFile": {
                const fileId = this.evaluateFileIdentifier(node);
                return fileOp(
                    {
                        type: "close",
                        fileIdentifier: fileId,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "ReadFile": {
                const fileId = this.evaluateFileIdentifier(node);
                return fileOp(
                    {
                        type: "read",
                        fileIdentifier: fileId,
                        target: (content) => {
                            this.assignToTarget(node.target, content, node.line, node.column);
                        },
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "WriteFile": {
                const fileId = this.evaluateFileIdentifier(node);
                const values = node.expressions.map((expr) => String(this.evaluate(expr)));
                return fileOp(
                    {
                        type: "write",
                        fileIdentifier: fileId,
                        values,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "Seek": {
                const fileId = this.evaluateFileIdentifier(node);
                const position = this.evaluate(node.position);
                if (typeof position !== "number") {
                    throw new RuntimeError(
                        "Seek position must be a number",
                        node.line,
                        node.column,
                    );
                }
                return fileOp(
                    {
                        type: "seek",
                        fileIdentifier: fileId,
                        position,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "GetRecord": {
                const fileId = this.evaluateFileIdentifier(node);
                return fileOp(
                    {
                        type: "getRecord",
                        fileIdentifier: fileId,
                        target: (data) => {
                            this.deserializeRecord(data, node.target);
                        },
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "PutRecord": {
                const fileId = this.evaluateFileIdentifier(node);
                const data = this.serializeRecord(this.evaluate(node.source));
                return fileOp(
                    {
                        type: "putRecord",
                        fileIdentifier: fileId,
                        data,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "TypeDeclaration":
                this.evaluateTypeDeclaration(node);
                return undefined;

            case "SetDeclaration":
                this.evaluateSetDeclaration(node);
                return undefined;

            case "ClassDeclaration":
                this.evaluateClassDeclaration(node);
                return undefined;

            case "MethodDeclaration":
                return undefined;

            case "SuperCall":
                this.evaluateSuperCallSync(node);
                return undefined;

            case "Debugger":
                return undefined;

            case "BinaryExpression":
                return this.evaluateBinaryExpression(node);

            case "UnaryExpression":
                return this.evaluateUnaryExpression(node);

            case "Identifier":
                return this.evaluateIdentifier(node);

            case "Literal":
                return this.evaluateLiteral(node);

            case "ArrayAccess":
                return this.evaluateArrayAccess(node);

            case "CallExpression":
                return this.evaluateCallExpression(node);

            case "MemberAccess":
                return this.evaluateMemberAccess(node);

            case "NewExpression":
                return this.evaluateNewExpression(node);

            case "TypeCast":
                return this.evaluateTypeCast(node);

            case "SetLiteral":
                return this.evaluateSetLiteral(node);

            case "PointerDereference":
                return this.evaluatePointerDereference(node);

            case "AddressOf":
                return this.evaluateAddressOf(node);

            case "DisposeStatement":
                this.evaluateDisposeStatement(node);
                return undefined;

            case "ImportStatement":
                if (this.strictMode) {
                    throw new RuntimeError(
                        "IMPORT is not a CAIE standard feature (CAIE_ONLY mode is enabled)",
                        node.line,
                        node.column,
                    );
                }
                return undefined;

            case "ImportExpression":
                if (this.strictMode) {
                    throw new RuntimeError(
                        "IMPORT is not a CAIE standard feature (CAIE_ONLY mode is enabled)",
                        node.line,
                        node.column,
                    );
                }
                return undefined;

            case "ExportStatement":
                if (this.strictMode) {
                    throw new RuntimeError(
                        "EXPORT is not a CAIE standard feature (CAIE_ONLY mode is enabled)",
                        node.line,
                        node.column,
                    );
                }
                return undefined;
        }
    }

    evaluateR(node: ASTNode): unknown {
        try {
            return this.evaluate(node);
        } catch (error) {
            throw toRuntimeError(error, node.line, node.column);
        }
    }

    private evaluateBounce(node: ASTNode): Bounce {
        if (!isEvaluatableNode(node)) {
            throw new RuntimeError(`Unknown node type: ${node.type}`, node.line, node.column);
        }

        if (node.line !== undefined) {
            this.context.currentLine = node.line;
        }
        if (node.column !== undefined) {
            this.context.currentColumn = node.column;
        }

        switch (node.type) {
            case "VariableDeclaration":
                this.evaluateVariableDeclaration(node);
                return done(undefined);

            case "DeclareStatement":
                this.evaluateDeclareStatement(node);
                return done(undefined);

            case "Assignment":
                return this.evaluateAssignmentBounce(node);

            case "If":
                return this.evaluateIfBounce(node);

            case "Case":
                return this.evaluateCaseBounce(node);

            case "For":
                return this.evaluateForBounce(node);

            case "While":
                return this.evaluateWhileBounce(node);

            case "Repeat":
                return this.evaluateRepeatBounce(node);

            case "ProcedureDeclaration":
                this.evaluateProcedureDeclaration(node);
                return done(undefined);

            case "FunctionDeclaration":
                this.evaluateFunctionDeclaration(node);
                return done(undefined);

            case "CallStatement":
                return this.evaluateCallStatementBounce(node);

            case "Input":
                return this.evaluateInputBounce(node);

            case "Output":
                return this.evaluateOutputBounce(node);

            case "Return":
                return this.evaluateReturnBounce(node);

            case "OpenFile": {
                const fileId = this.evaluate(node.fileIdentifier);
                if (typeof fileId !== "string") {
                    throw new RuntimeError(
                        "File identifier must be a string",
                        node.line,
                        node.column,
                    );
                }
                return fileOp(
                    {
                        type: "open",
                        fileIdentifier: fileId,
                        mode: node.mode as FileMode,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "CloseFile": {
                const fileId = this.evaluate(node.fileIdentifier);
                if (typeof fileId !== "string") {
                    throw new RuntimeError(
                        "File identifier must be a string",
                        node.line,
                        node.column,
                    );
                }
                return fileOp(
                    {
                        type: "close",
                        fileIdentifier: fileId,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "ReadFile": {
                const fileId = this.evaluate(node.fileIdentifier);
                if (typeof fileId !== "string") {
                    throw new RuntimeError(
                        "File identifier must be a string",
                        node.line,
                        node.column,
                    );
                }
                return fileOp(
                    {
                        type: "read",
                        fileIdentifier: fileId,
                        target: (content) => {
                            this.assignToTarget(node.target, content, node.line, node.column);
                        },
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "WriteFile": {
                const fileId = this.evaluate(node.fileIdentifier);
                if (typeof fileId !== "string") {
                    throw new RuntimeError(
                        "File identifier must be a string",
                        node.line,
                        node.column,
                    );
                }
                const values = node.expressions.map((expr) => String(this.evaluate(expr)));
                return fileOp(
                    {
                        type: "write",
                        fileIdentifier: fileId,
                        values,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "Seek": {
                const fileId = this.evaluate(node.fileIdentifier);
                if (typeof fileId !== "string") {
                    throw new RuntimeError(
                        "File identifier must be a string",
                        node.line,
                        node.column,
                    );
                }
                const position = this.evaluate(node.position);
                if (typeof position !== "number") {
                    throw new RuntimeError(
                        "Seek position must be a number",
                        node.line,
                        node.column,
                    );
                }
                return fileOp(
                    {
                        type: "seek",
                        fileIdentifier: fileId,
                        position,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "GetRecord": {
                const fileId = this.evaluate(node.fileIdentifier);
                if (typeof fileId !== "string") {
                    throw new RuntimeError(
                        "File identifier must be a string",
                        node.line,
                        node.column,
                    );
                }
                return fileOp(
                    {
                        type: "getRecord",
                        fileIdentifier: fileId,
                        target: (data) => {
                            this.deserializeRecord(data, node.target);
                        },
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "PutRecord": {
                const fileId = this.evaluate(node.fileIdentifier);
                if (typeof fileId !== "string") {
                    throw new RuntimeError(
                        "File identifier must be a string",
                        node.line,
                        node.column,
                    );
                }
                const data = this.serializeRecord(this.evaluate(node.source));
                return fileOp(
                    {
                        type: "putRecord",
                        fileIdentifier: fileId,
                        data,
                        line: node.line,
                        column: node.column,
                    },
                    () => done(undefined),
                );
            }

            case "TypeDeclaration":
                this.evaluateTypeDeclaration(node);
                return done(undefined);

            case "SetDeclaration":
                this.evaluateSetDeclaration(node);
                return done(undefined);

            case "ClassDeclaration":
                this.evaluateClassDeclaration(node);
                return done(undefined);

            case "MethodDeclaration":
                return done(undefined);

            case "SuperCall":
                return this.evaluateSuperCallBounce(node);

            case "Debugger":
                if (this.strictMode) {
                    throw new RuntimeError(
                        "DEBUGGER is not a CAIE standard feature (CAIE_ONLY mode is enabled)",
                        node.line,
                        node.column,
                    );
                }
                if (this.debuggerController) {
                    const snapshot = this.buildDebugSnapshot(
                        "debugger-statement",
                        node.line,
                        node.column,
                    );
                    return debugPause(
                        async () => this.debuggerController!.maybePause(snapshot),
                        () => done(undefined),
                    );
                }
                return done(undefined);

            case "BinaryExpression": {
                if (this.expressionNeedsAsync(node)) {
                    return this.evaluateBinaryExpressionBounce(node);
                }
                return done(this.evaluateBinaryExpression(node));
            }

            case "UnaryExpression": {
                if (this.expressionNeedsAsync(node)) {
                    return this.evaluateUnaryExpressionBounce(node);
                }
                return done(this.evaluateUnaryExpression(node));
            }

            case "Identifier":
                return done(this.evaluateIdentifier(node));

            case "Literal":
                return done(this.evaluateLiteral(node));

            case "ArrayAccess": {
                if (this.expressionNeedsAsync(node)) {
                    return this.evaluateArrayAccessBounce(node);
                }
                return done(this.evaluateArrayAccess(node));
            }

            case "CallExpression":
                return this.evaluateCallExpressionBounce(node);

            case "MemberAccess":
                return done(this.evaluateMemberAccess(node));

            case "NewExpression":
                return done(this.evaluateNewExpression(node));

            case "TypeCast":
                return done(this.evaluateTypeCast(node));

            case "SetLiteral": {
                if (this.expressionNeedsAsync(node)) {
                    return this.evaluateSetLiteralBounce(node);
                }
                return done(this.evaluateSetLiteral(node));
            }

            case "PointerDereference":
                return done(this.evaluatePointerDereference(node));

            case "AddressOf":
                return done(this.evaluateAddressOf(node));

            case "DisposeStatement":
                this.evaluateDisposeStatement(node);
                return done(undefined);

            case "ImportStatement":
                if (this.strictMode) {
                    throw new RuntimeError(
                        "IMPORT is not a CAIE standard feature (CAIE_ONLY mode is enabled)",
                        node.line,
                        node.column,
                    );
                }
                return done(undefined);

            case "ImportExpression":
                if (this.strictMode) {
                    throw new RuntimeError(
                        "IMPORT is not a CAIE standard feature (CAIE_ONLY mode is enabled)",
                        node.line,
                        node.column,
                    );
                }
                return done(undefined);

            case "ExportStatement":
                if (this.strictMode) {
                    throw new RuntimeError(
                        "EXPORT is not a CAIE standard feature (CAIE_ONLY mode is enabled)",
                        node.line,
                        node.column,
                    );
                }
                return done(undefined);

            default:
                return done(this.evaluate(node));
        }
    }

    private executeStatementBounce(statement: StatementNode): Bounce {
        if (this.context.shouldReturnFromRoutine()) {
            return done(undefined);
        }
        this.onStep?.();
        if (this.debuggerController) {
            const snapshot = this.buildDebugSnapshot("step", statement.line, statement.column);
            return debugPause(
                async () => this.debuggerController!.maybePause(snapshot),
                () => this.evaluateBounce(statement),
            );
        }
        return this.evaluateBounce(statement);
    }

    private evaluateIfBounce(node: IfNode): Bounce {
        const condition = this.evaluate(node.condition);

        if (this.isTruthy(condition)) {
            return seqMany(
                node.thenBranch.map((stmt) => () => this.executeStatementBounce(stmt)),
                () => done(undefined),
            );
        } else if (node.elseBranch) {
            return seqMany(
                node.elseBranch.map((stmt) => () => this.executeStatementBounce(stmt)),
                () => done(undefined),
            );
        }
        return done(undefined);
    }

    private evaluateCaseBounce(node: CaseNode): Bounce {
        const expressionValue = ensureStringOrNumber(
            this.evaluate(node.expression),
            node.line,
            node.column,
        );

        for (const caseItem of node.cases) {
            if (caseItem.values.length === 2) {
                const value1 = ensureStringOrNumber(
                    this.evaluate(caseItem.values[0]),
                    node.line,
                    node.column,
                );
                const value2 = ensureStringOrNumber(
                    this.evaluate(caseItem.values[1]),
                    node.line,
                    node.column,
                );

                if (value1 <= expressionValue && expressionValue <= value2) {
                    return seqMany(
                        caseItem.body.map((stmt) => () => this.executeStatementBounce(stmt)),
                        () => done(undefined),
                    );
                }
            } else if (caseItem.values.length === 1) {
                const value = this.evaluate(caseItem.values[0]);

                if (this.isEqual(expressionValue, value)) {
                    return seqMany(
                        caseItem.body.map((stmt) => () => this.executeStatementBounce(stmt)),
                        () => done(undefined),
                    );
                }
            } else {
                throw new RuntimeError("Invalid case item", node.line, node.column);
            }
        }

        if (node.otherwise) {
            return seqMany(
                node.otherwise.map((stmt) => () => this.executeStatementBounce(stmt)),
                () => done(undefined),
            );
        }

        return done(undefined);
    }

    private evaluateForBounce(node: ForNode): Bounce {
        const start = ensureNumber(this.evaluate(node.start), node.line, node.column);
        const end = ensureNumber(this.evaluate(node.end), node.line, node.column);
        const step = node.step ? ensureNumber(this.evaluate(node.step), node.line, node.column) : 1;

        if (!this.environment.has(node.variable)) {
            this.environment.define(node.variable, PseudocodeType.INTEGER, start);
        } else {
            this.environment.assign(node.variable, start);
        }

        const increment = step > 0;
        // Pre-compute statement executors to avoid mapping on each iteration
        const bodyExecutors = node.body.map((stmt) => () => this.executeStatementBounce(stmt));

        return loop(
            () => {
                const currentValue = ensureNumber(
                    this.environment.get(node.variable),
                    node.line,
                    node.column,
                );
                return done(increment ? currentValue <= end : currentValue >= end);
            },
            () =>
                seqMany(
                    bodyExecutors,
                    () => {
                        const currentValue = ensureNumber(
                            this.environment.get(node.variable),
                            node.line,
                            node.column,
                        );
                        this.environment.assign(node.variable, currentValue + step);
                        return done(undefined);
                    },
                ),
            () => done(undefined),
        );
    }

    private evaluateWhileBounce(node: WhileNode): Bounce {
        // Pre-compute statement executors to avoid mapping on each iteration
        const bodyExecutors = node.body.map((stmt) => () => this.executeStatementBounce(stmt));
        return loop(
            () => done(this.isTruthy(this.evaluate(node.condition))),
            () =>
                seqMany(
                    bodyExecutors,
                    () => done(undefined),
                ),
            () => done(undefined),
        );
    }

    private evaluateRepeatBounce(node: RepeatNode): Bounce {
        let firstIteration = true;
        // Pre-compute statement executors to avoid mapping on each iteration
        const bodyExecutors = node.body.map((stmt) => () => this.executeStatementBounce(stmt));
        return loop(
            () => {
                if (firstIteration) {
                    firstIteration = false;
                    return done(true);
                }
                return done(!this.isTruthy(this.evaluate(node.condition)));
            },
            () =>
                seqMany(
                    bodyExecutors,
                    () => done(undefined),
                ),
            () => done(undefined),
        );
    }

    private evaluateCallStatementBounce(node: CallStatementNode): Bounce {
        if (!node.namespace && this.environment.hasRoutine(node.name)) {
            const signature = this.environment.getRoutine(node.name);
            if (signature.returnType) {
                throw new RuntimeError(
                    `Cannot CALL function '${node.name}', use it in an expression instead`,
                    node.line,
                    node.column,
                );
            }
        }

        return this.evaluateCallExpressionBounce({
            type: "CallExpression",
            name: node.name,
            namespace: node.namespace,
            arguments: node.arguments,
            line: node.line,
            column: node.column,
        });
    }

    private evaluateInputBounce(node: InputNode): Bounce {
        let promptText = "";

        if (node.prompt) {
            const promptValue = this.evaluate(node.prompt);
            promptText = String(promptValue);
        }

        return io("input", promptText, (input: string) => {
            let targetName = "";
            if (node.target.type === "Identifier") {
                targetName = node.target.name;
            } else {
                throw new RuntimeError("Invalid input target", node.line, node.column);
            }

            const targetType = this.environment.getType(targetName);
            const inputValue = typeof input === "string" ? input : String(input);
            const value = this.convertInput(
                inputValue,
                ensurePseudocodeType(targetType, node.line, node.column),
            );

            if (node.target.type === "Identifier") {
                this.environment.assign(targetName, value);
            }
            return done(undefined);
        });
    }

    private evaluateOutputBounce(node: OutputNode): Bounce {
        if (node.expressions.length === 0) {
            return io("output", "\n", () => done(undefined));
        }

        const values: string[] = [];

        return seqMany(
            node.expressions.map(
                (expr) => () =>
                    seq(
                        () => this.evaluateBounce(expr),
                        (value) => {
                            values.push(String(value));
                            return done(undefined);
                        },
                    ),
            ),
            () => io("output", values.join("") + "\n", () => done(undefined)),
        );
    }

    private evaluateReturnBounce(node: ReturnNode): Bounce {
        if (node.value) {
            return seq(
                () => this.evaluateBounce(node.value!),
                (value) => {
                    this.context.setReturnValue(value);
                    this.context.shouldReturn = true;
                    return done(undefined);
                },
            );
        }

        this.context.setReturnValue(undefined);
        this.context.shouldReturn = true;
        return done(undefined);
    }

    private evaluateSuperCallSync(node: SuperCallNode): void {
        const selfAddress = this.environment.get("SELF");
        if (typeof selfAddress !== "number") {
            throw new RuntimeError(
                "SUPER can only be used inside a method",
                node.line,
                node.column,
            );
        }

        const selfHeapObj = this.heap.readUnsafe(selfAddress);
        const selfType = selfHeapObj.type;
        if (typeof selfType !== "object" || !("name" in selfType)) {
            throw new RuntimeError(
                "SELF does not refer to a class instance",
                node.line,
                node.column,
            );
        }

        const className = selfType.name;
        const classDef = this.classDefinitions.get(className);
        if (!classDef || !classDef.inherits) {
            throw new RuntimeError(
                `Class '${className}' does not inherit from any class`,
                node.line,
                node.column,
            );
        }

        const parentClassName = classDef.inherits;
        const parentMethodBodies = this.classMethodBodies.get(parentClassName);
        if (!parentMethodBodies) {
            throw new RuntimeError(
                `Parent class '${parentClassName}' not found`,
                node.line,
                node.column,
            );
        }

        const method = parentMethodBodies.get(node.methodName);
        if (!method) {
            throw new RuntimeError(
                `Method '${node.methodName}' not found in parent class '${parentClassName}'`,
                node.line,
                node.column,
            );
        }

        const routineEnvironment = this.environment.createChild();
        routineEnvironment.define("SELF", PseudocodeType.INTEGER, selfAddress, true);

        const fullParentClassDef = this.resolveFullClassDefinition(parentClassName);
        if (fullParentClassDef) {
            this.bindObjectFieldsToEnvironment(selfAddress, fullParentClassDef, routineEnvironment);
        }

        for (let i = 0; i < method.parameters.length; i++) {
            const param = method.parameters[i];
            const argNode = node.arguments[i];
            const arg = this.evaluate(argNode);
            routineEnvironment.define(param.name, param.dataType, arg, false);
        }

        const previousContext = this.context;
        const previousEnvironment = this.environment;
        this.context = new ExecutionContext(routineEnvironment);
        this.environment = routineEnvironment;

        try {
            for (const statement of method.body) {
                this.executeStatementSync(statement);
                if (this.context.shouldReturnFromRoutine()) {
                    break;
                }
            }
        } finally {
            this.context = previousContext;
            this.environment = previousEnvironment;
            routineEnvironment.disposeScope();
        }
    }

    private evaluateSuperCallBounce(node: SuperCallNode): Bounce {
        this.evaluateSuperCallSync(node);
        return done(undefined);
    }

    private evaluateCallExpressionBounce(node: CallExpressionNode): Bounce {
        const routineName = node.name;

        if (node.namespace) {
            const methodResult = this.tryObjectMethodCallSync(node);
            if (methodResult.handled) {
                return done(methodResult.value);
            }

            const nsInfo = this.namespaceImports.get(node.namespace);
            if (!nsInfo) {
                throw new RuntimeError(
                    `Unknown namespace '${node.namespace}'`,
                    node.line,
                    node.column,
                );
            }
            if (!nsInfo.exportedNames.includes(routineName)) {
                throw new RuntimeError(
                    `'${routineName}' is not exported from '${node.namespace}'`,
                    node.line,
                    node.column,
                );
            }
        } else if (this.environment.has("SELF")) {
            const selfMethodResult = this.tryObjectMethodCallSync({
                ...node,
                namespace: "SELF",
            });
            if (selfMethodResult.handled) {
                return done(selfMethodResult.value);
            }
        }

        if (routineName === "EOF") {
            if (node.arguments.length !== 1) {
                throw new RuntimeError("EOF expects exactly one argument", node.line, node.column);
            }
            const fileId = this.evaluate(node.arguments[0]);
            if (typeof fileId !== "string") {
                throw new RuntimeError(
                    "EOF expects a string file identifier",
                    node.line,
                    node.column,
                );
            }
            let eofResult = false;
            this.ioQueue.enqueue({
                type: "eof",
                fileIdentifier: fileId,
                target: (isEof) => {
                    eofResult = isEof;
                },
                line: node.line,
                column: node.column,
            });
            return done(eofResult);
        }

        if (this.strictMode && EXTENDED_BUILTIN_NAMES.has(routineName)) {
            throw new RuntimeError(
                `'${routineName}' is not a CAIE standard function (CAIE_ONLY mode is enabled)`,
                node.line,
                node.column,
            );
        }

        if (routineName === "TYPEOF") {
            return done(this.evaluateTypeofSync(node));
        }

        if (this.globalRoutines.has(routineName)) {
            const routineInfo = this.globalRoutines.get(routineName)!;

            if (routineInfo.isBuiltIn && routineInfo.implementation) {
                const args = node.arguments.map((arg) => this.evaluate(arg));
                return done(routineInfo.implementation(...args));
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
                    const address = this.resolveTargetAddress(argNode);
                    routineEnvironment.defineByRef(param.name, param.type, address);
                } else {
                    throw new RuntimeError(
                        `BYREF parameter '${param.name}' requires a variable, array element, or record field argument`,
                        node.line,
                        node.column,
                    );
                }
            } else {
                // For complex types (arrays, records), use COW by sharing the heap address
                const isComplexType = typeof param.type === "object" &&
                    ("elementType" in param.type || "fields" in param.type);

                if (isComplexType && argNode && isIdentifierNode(argNode)) {
                    // Get the heap address directly from the variable for COW
                    const atom = this.environment.getAtom(argNode.name);
                    const address = atom.getAddress();
                    routineEnvironment.defineByValCOW(param.name, param.type, address);
                } else {
                    const arg = argNode
                        ? this.evaluate(argNode)
                        : this.getDefaultValue(param.type, node.line, node.column);
                    routineEnvironment.define(param.name, param.type, arg, false, false);
                }
            }
        }

        const previousContext = this.context;
        const previousEnvironment = this.environment;
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
        this.context = routineContext;
        this.environment = routineEnvironment;

        const routineInfo = this.globalRoutines.get(routineName);
        const bodyStatements = extractRoutineBody(routineInfo?.node);
        // Pre-compute statement executors to avoid mapping on each call
        const bodyExecutors = bodyStatements.map((stmt) => () => this.executeStatementBounce(stmt));

        return seqMany(
            bodyExecutors,
            () => {
                const returnValue = this.context.getReturnValue();
                this.context = previousContext;
                this.environment = previousEnvironment;
                routineEnvironment.disposeScope();
                return done(returnValue);
            },
        );
    }

    private tryObjectMethodCallSync(node: CallExpressionNode): {
        handled: boolean;
        value?: unknown;
    } {
        if (!node.namespace) return { handled: false };

        if (!this.environment.has(node.namespace)) {
            return { handled: false };
        }

        const objValue = this.environment.get(node.namespace);
        if (typeof objValue !== "number") {
            return { handled: false };
        }

        let objType: TypeInfo;
        try {
            objType = this.heap.readUnsafe(objValue).type;
        } catch {
            return { handled: false };
        }

        if (typeof objType !== "object" || objType === null || !("name" in objType)) {
            return { handled: false };
        }

        const className = "name" in objType ? objType.name : undefined;
        if (!className) return { handled: false };
        const fullClassDef = this.resolveFullClassDefinition(className);
        if (!fullClassDef) return { handled: false };

        const method = fullClassDef.methods[node.name];
        if (!method) {
            throw new RuntimeError(
                `Method '${node.name}' not found on class '${className}'`,
                node.line,
                node.column,
            );
        }

        const selfAddress = objValue;
        const routineEnvironment = this.environment.createChild();
        routineEnvironment.define("SELF", PseudocodeType.INTEGER, selfAddress, true);

        this.bindObjectFieldsToEnvironment(selfAddress, fullClassDef, routineEnvironment);

        for (let i = 0; i < method.parameters.length; i++) {
            const param = method.parameters[i];
            const argNode = node.arguments[i];
            const arg = argNode ? this.evaluate(argNode) : undefined;
            routineEnvironment.define(param.name, param.type, arg, false);
        }

        const previousContext = this.context;
        const previousEnvironment = this.environment;
        this.context = new ExecutionContext(routineEnvironment);
        this.environment = routineEnvironment;

        let result: unknown = undefined;

        try {
            const methodBody = this.findMethodBody(className, node.name);
            if (methodBody) {
                for (const statement of methodBody.body) {
                    this.executeStatementSync(statement);
                    if (this.context.shouldReturnFromRoutine()) {
                        result = this.context.getReturnValue();
                        break;
                    }
                }
            }
        } finally {
            this.context = previousContext;
            this.environment = previousEnvironment;
            routineEnvironment.disposeScope();
        }

        return { handled: true, value: result };
    }

    private evaluateTypeofSync(node: CallExpressionNode): string {
        const argNode = node.arguments[0];

        if (isIdentifierNode(argNode)) {
            try {
                const declaredType = this.environment.getType(argNode.name);
                return TypeValidator.typeInfoToName(declaredType);
            } catch {
                const value = this.evaluate(argNode);
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
                const value = this.evaluate(argNode);
                return TypeValidator.typeInfoToName(this.inferTypeFromValue(value));
            }
        }

        const value = this.evaluate(argNode);
        return TypeValidator.typeInfoToName(this.inferTypeFromValue(value));
    }

    private executeStatementSync(statement: StatementNode): unknown {
        this.onStep?.();
        return this.evaluate(statement);
    }

    buildErrorSnapshot(error: RuntimeError): DebugSnapshot {
        return this.buildDebugSnapshot("error", error.line, error.column);
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

    private evaluateDeclareStatement(node: DeclareStatementNode): void {
        const initialValue = node.initialValue ? this.evaluate(node.initialValue) : undefined;

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

        const finalValue =
            initialValue ?? this.getDefaultValue(resolvedType, node.line, node.column);

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

    private evaluateVariableDeclaration(node: VariableDeclarationNode): void {
        const resolvedType = this.resolveType(node.dataType, node.line, node.column);
        const initialValue = node.initialValue
            ? this.evaluate(node.initialValue)
            : this.getDefaultValue(resolvedType, node.line, node.column);

        this.environment.define(node.name, resolvedType, initialValue, node.isConstant);
    }

    private evaluateAssignment(node: AssignmentNode): void {
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
                value = this.evaluate(node.value);
            }
        } else {
            value = this.evaluate(node.value);
        }

        this.performAssignment(node, value);
    }

    private evaluateAssignmentBounce(node: AssignmentNode): Bounce {
        // Check if right-hand side needs async evaluation (e.g., function calls)
        const needsAsync = this.expressionNeedsAsync(node.value);

        if (!needsAsync) {
            // Can use sync version for simple assignments
            this.evaluateAssignment(node);
            return done(undefined);
        }

        // Async path: evaluate RHS with bounce, then perform assignment
        return seq(
            () => this.evaluateBounce(node.value),
            (value) => {
                this.performAssignment(node, value);
                return done(undefined);
            },
        );
    }

    private expressionNeedsAsync(node: ExpressionNode): boolean {
        // Check if expression contains function calls that need async evaluation
        // Use type assertions since TypeScript doesn't narrow types properly in switch
        switch (node.type) {
            case "CallExpression":
                return true;
            case "BinaryExpression": {
                const n = node as import("../parser/ast-nodes").BinaryExpressionNode;
                return this.expressionNeedsAsync(n.left) || this.expressionNeedsAsync(n.right);
            }
            case "UnaryExpression": {
                const n = node as import("../parser/ast-nodes").UnaryExpressionNode;
                return this.expressionNeedsAsync(n.operand);
            }
            case "ArrayAccess": {
                const n = node as import("../parser/ast-nodes").ArrayAccessNode;
                return this.expressionNeedsAsync(n.array) ||
                    n.indices.some((idx: ExpressionNode) => this.expressionNeedsAsync(idx));
            }
            case "MemberAccess": {
                const n = node as import("../parser/ast-nodes").MemberAccessNode;
                return this.expressionNeedsAsync(n.object);
            }
            case "NewExpression": {
                const n = node as import("../parser/ast-nodes").NewExpressionNode;
                return n.arguments.some((arg: ExpressionNode) => this.expressionNeedsAsync(arg));
            }
            case "TypeCast": {
                const n = node as import("../parser/ast-nodes").TypeCastNode;
                return this.expressionNeedsAsync(n.expression);
            }
            case "SetLiteral": {
                const n = node as import("../parser/ast-nodes").SetLiteralNode;
                return n.elements.some((el: ExpressionNode) => this.expressionNeedsAsync(el));
            }
            default:
                return false;
        }
    }

    private performAssignment(node: AssignmentNode, value: unknown): void {
        if (isIdentifierNode(node.target)) {
            this.environment.assign(node.target.name, value);
        } else if (isArrayAccessNode(node.target)) {
            const address = this.resolveTargetAddress(node.target);

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

            this.heap.writeUnsafe(address, value, elementType);
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

            const address = this.resolveTargetAddress(node.target);
            this.heap.writeUnsafe(address, value, fieldType);
        } else if (isPointerDereferenceNode(node.target)) {
            const ptrValue = this.evaluate(node.target.pointer);
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

            this.heap.writeUnsafe(ptrValue, value, targetType);
        } else {
            throw new RuntimeError("Invalid assignment target", node.line, node.column);
        }
    }

    private evaluateIf(node: IfNode): void {
        const condition = this.evaluate(node.condition);

        if (this.isTruthy(condition)) {
            for (const statement of node.thenBranch) {
                this.executeStatementSync(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        } else if (node.elseBranch) {
            for (const statement of node.elseBranch) {
                this.executeStatementSync(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        }
    }

    private evaluateCase(node: CaseNode): void {
        const expressionValue = ensureStringOrNumber(
            this.evaluate(node.expression),
            node.line,
            node.column,
        );
        let executed = false;

        for (const caseItem of node.cases) {
            if (caseItem.values.length === 2) {
                const value1 = ensureStringOrNumber(
                    this.evaluate(caseItem.values[0]),
                    node.line,
                    node.column,
                );
                const value2 = ensureStringOrNumber(
                    this.evaluate(caseItem.values[1]),
                    node.line,
                    node.column,
                );

                if (value1 <= expressionValue && expressionValue <= value2) {
                    executed = true;

                    for (const statement of caseItem.body) {
                        this.executeStatementSync(statement);

                        if (this.context.shouldReturnFromRoutine()) {
                            return;
                        }
                    }

                    break;
                }
            } else if (caseItem.values.length === 1) {
                const value = this.evaluate(caseItem.values[0]);

                if (this.isEqual(expressionValue, value)) {
                    executed = true;

                    for (const statement of caseItem.body) {
                        this.executeStatementSync(statement);

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
                this.executeStatementSync(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        }
    }

    private evaluateFor(node: ForNode): void {
        const start = ensureNumber(this.evaluate(node.start), node.line, node.column);
        const end = ensureNumber(this.evaluate(node.end), node.line, node.column);
        const step = node.step ? ensureNumber(this.evaluate(node.step), node.line, node.column) : 1;

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
                this.executeStatementSync(statement);

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

    private evaluateWhile(node: WhileNode): void {
        while (true) {
            const condition = this.evaluate(node.condition);

            if (!this.isTruthy(condition)) {
                break;
            }

            for (const statement of node.body) {
                this.executeStatementSync(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        }
    }

    private evaluateRepeat(node: RepeatNode): void {
        do {
            for (const statement of node.body) {
                this.executeStatementSync(statement);

                if (this.context.shouldReturnFromRoutine()) {
                    return;
                }
            }
        } while (!this.isTruthy(this.evaluate(node.condition)));
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

    private assignToTarget(
        target: ExpressionNode,
        value: unknown,
        line?: number,
        column?: number,
    ): void {
        if (isIdentifierNode(target)) {
            this.environment.assign(target.name, value);
            return;
        }

        if (isArrayAccessNode(target)) {
            const address = this.resolveTargetAddress(target);

            let elementType: TypeInfo = PseudocodeType.INTEGER;
            if (isIdentifierNode(target.array)) {
                const typeInfo = this.environment.getType(target.array.name);
                if (
                    typeof typeInfo === "object" &&
                    typeInfo !== null &&
                    "elementType" in typeInfo
                ) {
                    elementType = this.resolveArrayElementType(typeInfo, target.indices.length);
                }
            }

            VariableAtomFactory.validateValue(elementType, value);

            this.heap.writeUnsafe(address, value, elementType);
            return;
        }

        throw new RuntimeError("Invalid assignment target", line, column);
    }

    private assignToTargetR(
        target: ExpressionNode,
        value: unknown,
        line?: number,
        column?: number,
    ): void {
        try {
            this.assignToTarget(target, value, line, column);
        } catch (error) {
            throw toRuntimeError(error, line, column);
        }
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

    private evaluateSetDeclaration(node: SetDeclarationNode): void {
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
            const value = this.evaluate(expr);
            VariableAtomFactory.validateValue(setType.elementType, value);
            values.add(value);
        }

        this.environment.define(node.name, setType, values, false);
    }

    private evaluateClassDeclaration(node: ClassDeclarationNode): void {
        const fields: Record<string, TypeInfo> = {};
        const fieldVisibility: Record<string, "PUBLIC" | "PRIVATE"> = {};

        for (const field of node.fields) {
            fields[field.name] = field.dataType;
            fieldVisibility[field.name] = field.visibility;
        }

        const methods: Record<string, ClassMethodInfo> = {};
        const methodBodies: Map<string, RuntimeMethodInfo> = new Map();

        for (const method of node.methods) {
            const params: ParameterInfo[] = method.parameters.map((p) => ({
                name: p.name,
                type: p.dataType,
                mode: p.mode,
            }));
            methods[method.name] = {
                name: method.name,
                visibility: method.visibility,
                parameters: params,
                returnType: method.returnType,
                body: [],
            };
            methodBodies.set(method.name, {
                name: method.name,
                visibility: method.visibility,
                parameters: method.parameters,
                returnType: method.returnType,
                body: method.body,
            });
        }

        const classDef: ClassTypeInfo = {
            kind: "CLASS",
            name: node.name,
            inherits: node.inherits,
            fields,
            fieldVisibility,
            methods,
        };

        this.classDefinitions.set(node.name, classDef);
        this.classMethodBodies.set(node.name, methodBodies);
    }

    private resolveClassDefinition(className: string): ClassTypeInfo | undefined {
        return this.classDefinitions.get(className);
    }

    private buildDefaultObjectValue(classDef: ClassTypeInfo): Record<string, unknown> {
        const fullClassDef = this.resolveFullClassDefinition(classDef.name);
        const fieldsToUse = fullClassDef?.fields ?? classDef.fields;
        const result: Record<string, unknown> = {};
        for (const [fieldName, fieldType] of Object.entries(fieldsToUse)) {
            result[fieldName] = this.heap.getDefaultValue(fieldType);
        }
        return result;
    }

    private applyBinaryOperator(operator: string, left: unknown, right: unknown, line?: number, column?: number): unknown {
        switch (operator) {
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
                    throw new DivisionByZeroError(line, column);
                }
                return Number(left) / Number(right);

            case "DIV":
                if (Number(right) === 0) {
                    throw new DivisionByZeroError(line, column);
                }
                return Math.floor(Number(left) / Number(right));

            case "MOD":
                if (Number(right) === 0) {
                    throw new DivisionByZeroError(line, column);
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
                if (typeof right !== "object" || right === null || !(right instanceof Set)) {
                    throw new RuntimeError(
                        "Right operand of IN must be a SET",
                        line,
                        column,
                    );
                }
                return right.has(left);

            default:
                throw new RuntimeError(
                    `Unknown binary operator: ${operator}`,
                    line,
                    column,
                );
        }
    }

    private evaluateBinaryExpression(node: BinaryExpressionNode): unknown {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);
        return this.applyBinaryOperator(node.operator, left, right, node.line, node.column);
    }

    private evaluateBinaryExpressionBounce(node: BinaryExpressionNode): Bounce {
        return seq(
            () => this.evaluateBounce(node.left),
            (left) =>
                seq(
                    () => this.evaluateBounce(node.right),
                    (right) => done(this.applyBinaryOperator(node.operator, left, right, node.line, node.column)),
                ),
        );
    }

    private applyUnaryOperator(operator: string, operand: unknown, line?: number, column?: number): unknown {
        switch (operator) {
            case "-":
                return -Number(operand);

            case "NOT":
                return !this.isTruthy(operand);

            default:
                throw new RuntimeError(
                    `Unknown unary operator: ${operator}`,
                    line,
                    column,
                );
        }
    }

    private evaluateUnaryExpression(node: UnaryExpressionNode): unknown {
        const operand = this.evaluate(node.operand);
        return this.applyUnaryOperator(node.operator, operand, node.line, node.column);
    }

    private evaluateUnaryExpressionBounce(node: UnaryExpressionNode): Bounce {
        return seq(
            () => this.evaluateBounce(node.operand),
            (operand) => done(this.applyUnaryOperator(node.operator, operand, node.line, node.column)),
        );
    }

    private serializeRecord(value: unknown): string {
        return serializeRecordHelper(value, this.heap);
    }

    private deserializeRecordImpl(data: string, target: ExpressionNode): void {
        const currentValue = this.evaluate(target);
        if (!isRecord(currentValue)) {
            throw new RuntimeError(
                "GETRECORD target must be a user-defined type variable",
                target.line,
                target.column,
            );
        }
        const parsed = parseRecordDataHelper(data);
        reconstructRecordHelper(parsed, currentValue, this.heap);
    }

    private deserializeRecord(data: string, target: ExpressionNode): void {
        this.deserializeRecordImpl(data, target);
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

    private evaluateArrayAccess(node: ArrayAccessNode): unknown {
        const address = this.resolveTargetAddress(node);
        return this.heap.readUnsafe(address).value;
    }

    private evaluateArrayAccessBounce(node: ArrayAccessNode): Bounce {
        const indicesCount = node.indices.length;

        if (indicesCount === 1) {
            // Fast path for single-dimensional array access (most common case)
            return seq(
                () => this.evaluateBounce(node.indices[0]),
                (value) => {
                    const index = ensureNumber(value, node.line, node.column);
                    if (!Number.isInteger(index)) {
                        throw new RuntimeError("Array index must be INTEGER", node.line, node.column);
                    }
                    const arrayAtom = this.resolveArrayRootAtom(node);
                    const arrayAddress = arrayAtom.getAddress();
                    const elemAddr = this.heap.readElementAddressUnsafe(arrayAddress, index);
                    return done(this.heap.readUnsafe(elemAddr).value);
                },
            );
        }

        // Multi-dimensional array access (slower path)
        return this.evaluateArrayAccessIndicesBounce(node, 0, [], (indices) => {
            const arrayAtom = this.resolveArrayRootAtom(node);
            const arrayAddress = arrayAtom.getAddress();
            const elemAddr = this.heap.readElementAddressUnsafe(arrayAddress, indices[0]);

            if (indices.length === 1) {
                return done(this.heap.readUnsafe(elemAddr).value);
            }

            let currentAddress = elemAddr;
            for (let i = 1; i < indices.length; i++) {
                currentAddress = this.heap.readElementAddressUnsafe(currentAddress, indices[i]);
            }
            return done(this.heap.readUnsafe(currentAddress).value);
        });
    }

    private evaluateArrayAccessIndicesBounce(
        node: ArrayAccessNode,
        index: number,
        accumulated: number[],
        callback: (indices: number[]) => Bounce,
    ): Bounce {
        if (index >= node.indices.length) {
            return callback(accumulated);
        }

        return seq(
            () => this.evaluateBounce(node.indices[index]),
            (value) => {
                const idx = ensureNumber(value, node.line, node.column);
                if (!Number.isInteger(idx)) {
                    throw new RuntimeError("Array index must be INTEGER", node.line, node.column);
                }
                accumulated.push(idx);
                return this.evaluateArrayAccessIndicesBounce(node, index + 1, accumulated, callback);
            },
        );
    }

    private evaluateCallExpression(node: CallExpressionNode): unknown {
        const routineName = node.name;

        if (node.namespace) {
            const methodResult = this.tryObjectMethodCallSync(node);
            if (methodResult.handled) {
                return methodResult.value;
            }

            const nsInfo = this.namespaceImports.get(node.namespace);
            if (!nsInfo) {
                throw new RuntimeError(
                    `Unknown namespace '${node.namespace}'`,
                    node.line,
                    node.column,
                );
            }
            if (!nsInfo.exportedNames.includes(routineName)) {
                throw new RuntimeError(
                    `'${routineName}' is not exported from '${node.namespace}'`,
                    node.line,
                    node.column,
                );
            }
        } else if (this.environment.has("SELF")) {
            const selfMethodResult = this.tryObjectMethodCallSync({
                ...node,
                namespace: "SELF",
            });
            if (selfMethodResult.handled) {
                return selfMethodResult.value;
            }
        }

        if (routineName === "EOF") {
            if (node.arguments.length !== 1) {
                throw new RuntimeError("EOF expects exactly one argument", node.line, node.column);
            }
            const fileId = this.evaluate(node.arguments[0]);
            if (typeof fileId !== "string") {
                throw new RuntimeError(
                    "EOF expects a string file identifier",
                    node.line,
                    node.column,
                );
            }
            return this.fileManager.isEOF(fileId);
        }

        if (this.strictMode && EXTENDED_BUILTIN_NAMES.has(routineName)) {
            throw new RuntimeError(
                `'${routineName}' is not a CAIE standard function (CAIE_ONLY mode is enabled)`,
                node.line,
                node.column,
            );
        }

        if (routineName === "TYPEOF") {
            return this.evaluateTypeofSync(node);
        }

        if (this.globalRoutines.has(routineName)) {
            const routineInfo = this.globalRoutines.get(routineName)!;

            if (routineInfo.isBuiltIn && routineInfo.implementation) {
                const args = node.arguments.map((arg) => this.evaluate(arg));
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
                    const address = this.resolveTargetAddress(argNode);
                    routineEnvironment.defineByRef(param.name, param.type, address);
                } else {
                    throw new RuntimeError(
                        `BYREF parameter '${param.name}' requires a variable, array element, or record field argument`,
                        node.line,
                        node.column,
                    );
                }
            } else {
                const arg = this.evaluate(argNode);
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
                        this.executeStatementSync(statement);

                        if (this.context.shouldReturnFromRoutine()) {
                            break;
                        }
                    }
                } else if (isFunctionDeclarationNode(routineInfo.node)) {
                    const functionNode = routineInfo.node;
                    for (const statement of functionNode.body) {
                        this.executeStatementSync(statement);

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

    private evaluateMemberAccess(node: MemberAccessNode): unknown {
        const parentAddress = this.resolveTargetAddress(node.object);
        this.checkFieldVisibility(parentAddress, node.field, node.line, node.column);
        const fieldAddr = this.heap.readFieldAddressUnsafe(parentAddress, node.field);
        return this.heap.readUnsafe(fieldAddr).value;
    }

    private resolveMemberPathType(expression: ExpressionNode): UserDefinedTypeInfo | undefined {
        if (isIdentifierNode(expression)) {
            const typeInfo = this.environment.getType(expression.name);
            if (typeof typeInfo === "object" && typeInfo !== null && "fields" in typeInfo) {
                return typeInfo;
            }

            if (typeInfo === PseudocodeType.INTEGER && this.environment.has(expression.name)) {
                const varValue = this.environment.get(expression.name);
                if (typeof varValue === "number") {
                    try {
                        const objType = this.heap.readUnsafe(varValue).type;
                        if (
                            typeof objType === "object" &&
                            objType !== null &&
                            "fields" in objType
                        ) {
                            return objType as UserDefinedTypeInfo;
                        }
                    } catch { }
                }
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
        const classDef = this.resolveFullClassDefinition(node.className);

        if (!classDef) {
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

        return this.createAndConstructObject(node.className, node.arguments);
    }

    private evaluateNewExpressionAsync(node: NewExpressionNode): unknown {
        const classDef = this.resolveFullClassDefinition(node.className);

        if (!classDef) {
            return this.evaluateNewExpression(node);
        }

        return this.createAndConstructObject(node.className, node.arguments);
    }

    private createAndConstructObject(className: string, args: ExpressionNode[]): number {
        const classDef = this.resolveFullClassDefinition(className);
        if (!classDef) {
            throw new RuntimeError(`Unknown class '${className}'`);
        }

        const objectValue = this.buildDefaultObjectValue(classDef);
        const objectTypeInfo: UserDefinedTypeInfo = {
            name: classDef.name,
            fields: classDef.fields,
        };
        const address = this.heap.allocate(objectValue, objectTypeInfo);

        this.invokeConstructor(className, address, args);

        return address;
    }

    private invokeConstructor(
        className: string,
        objectAddress: number,
        args: ExpressionNode[],
    ): void {
        const methodBodies = this.classMethodBodies.get(className);
        if (!methodBodies) return;

        const constructor = methodBodies.get("NEW");
        if (!constructor) return;

        const fullClassDef = this.resolveFullClassDefinition(className);
        const routineEnvironment = this.environment.createChild();

        routineEnvironment.define("SELF", PseudocodeType.INTEGER, objectAddress, true);

        if (fullClassDef) {
            this.bindObjectFieldsToEnvironment(objectAddress, fullClassDef, routineEnvironment);
        }

        for (let i = 0; i < constructor.parameters.length; i++) {
            const param = constructor.parameters[i];
            const argNode = args[i];
            const arg = this.evaluate(argNode);
            routineEnvironment.define(param.name, param.dataType, arg, false);
        }

        const previousContext = this.context;
        const previousEnvironment = this.environment;
        this.context = new ExecutionContext(routineEnvironment);
        this.environment = routineEnvironment;

        try {
            for (const statement of constructor.body) {
                this.executeStatementSync(statement);
                if (this.context.shouldReturnFromRoutine()) {
                    break;
                }
            }
        } finally {
            this.context = previousContext;
            this.environment = previousEnvironment;
            routineEnvironment.disposeScope();
        }
    }

    private bindObjectFieldsToEnvironment(
        objectAddress: number,
        classDef: ClassTypeInfo,
        env: Environment,
    ): void {
        let objectValue: unknown;
        try {
            objectValue = this.heap.readUnsafe(objectAddress).value;
        } catch {
            return;
        }

        if (typeof objectValue !== "object" || objectValue === null) return;

        for (const [fieldName, fieldType] of Object.entries(classDef.fields)) {
            const fieldAddress = this.heap.readFieldAddressUnsafe(objectAddress, fieldName);
            env.defineByRef(fieldName, fieldType, fieldAddress);
        }
    }

    private evaluateTypeCast(node: TypeCastNode): unknown {
        const value = this.evaluate(node.expression);
        return value;
    }

    private evaluateSetLiteral(node: SetLiteralNode): Set<unknown> {
        const values = new Set<unknown>();
        for (const element of node.elements) {
            values.add(this.evaluate(element));
        }
        return values;
    }

    private evaluateSetLiteralBounce(node: SetLiteralNode): Bounce {
        return this.evaluateSetLiteralElementsBounce(node, 0, new Set<unknown>(), (values) =>
            done(values),
        );
    }

    private evaluateSetLiteralElementsBounce(
        node: SetLiteralNode,
        index: number,
        accumulated: Set<unknown>,
        callback: (values: Set<unknown>) => Bounce,
    ): Bounce {
        if (index >= node.elements.length) {
            return callback(accumulated);
        }

        return seq(
            () => this.evaluateBounce(node.elements[index]),
            (value) => {
                accumulated.add(value);
                return this.evaluateSetLiteralElementsBounce(node, index + 1, accumulated, callback);
            },
        );
    }

    private evaluatePointerDereference(node: PointerDereferenceNode): unknown {
        const ptrValue = this.evaluate(node.pointer);

        if (ptrValue === null || ptrValue === undefined || ptrValue === NULL_POINTER) {
            throw new RuntimeError("Null pointer dereference", node.line, node.column);
        }

        if (typeof ptrValue !== "number") {
            throw new RuntimeError("Cannot dereference non-pointer value", node.line, node.column);
        }

        const heapResult = this.heap.readUnsafe(ptrValue);

        return heapResult.value;
    }

    private evaluateAddressOf(node: AddressOfNode): number {
        return this.resolveTargetAddress(node.target);
    }

    private resolveTargetAddress(target: ExpressionNode): number {
        if (isIdentifierNode(target)) {
            const atom = this.environment.getAtom(target.name);
            const varAddress = atom.getAddress();

            try {
                const varValue = this.heap.readUnsafe(varAddress).value;
                if (typeof varValue === "number") {
                    try {
                        const refObj = this.heap.readUnsafe(varValue);
                        if (
                            typeof refObj.value === "object" &&
                            refObj.value !== null &&
                            !Array.isArray(refObj.value)
                        ) {
                            return varValue;
                        }
                    } catch { }
                }
            } catch { }

            return varAddress;
        }

        if (isArrayAccessNode(target)) {
            const arrayAtom = this.resolveArrayRootAtom(target);
            const indices = ensureIndices(
                target.indices.map((index) => this.evaluate(index)),
                target.line,
                target.column,
            );

            const arrayAddress = arrayAtom.getAddress();
            const elemAddr = this.heap.readElementAddressUnsafe(arrayAddress, indices[0]);

            if (indices.length === 1) {
                return elemAddr;
            }

            let currentAddress = elemAddr;
            for (let i = 1; i < indices.length; i++) {
                currentAddress = this.heap.readElementAddressUnsafe(currentAddress, indices[i]);
            }
            return currentAddress;
        }

        if (isMemberAccessNode(target)) {
            const parentAddress = this.resolveTargetAddress(target.object);
            this.checkFieldVisibility(parentAddress, target.field, target.line, target.column);
            return this.heap.readFieldAddressUnsafe(parentAddress, target.field);
        }

        if (isPointerDereferenceNode(target)) {
            const ptrValue = this.evaluate(target.pointer);
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

    private checkFieldVisibility(
        parentAddress: number,
        fieldName: string,
        line?: number,
        column?: number,
    ): void {
        let objType: TypeInfo;
        try {
            objType = this.heap.readUnsafe(parentAddress).type;
        } catch {
            return;
        }

        if (typeof objType !== "object" || objType === null || !("name" in objType)) return;

        const className = (objType as { name: string }).name;
        const classDef = this.resolveFullClassDefinition(className);
        if (!classDef) return;

        const visibility = classDef.fieldVisibility[fieldName];
        if (visibility === "PRIVATE") {
            const isSelfAccess =
                this.environment.has("SELF") && this.environment.get("SELF") === parentAddress;
            if (!isSelfAccess) {
                throw new RuntimeError(
                    `Cannot access private field '${fieldName}' of class '${className}'`,
                    line,
                    column,
                );
            }
        }
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

    private evaluateDisposeStatement(node: DisposeStatementNode): void {
        const addr = this.evaluate(node.pointer);

        if (addr === null || addr === undefined) {
            return;
        }

        if (typeof addr !== "number") {
            throw new RuntimeError("Cannot dispose non-pointer value", node.line, node.column);
        }

        this.heap.deallocate(addr);
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

            const bKeysSet = new Set(bKeys);
            for (const key of aKeys) {
                if (!bKeysSet.has(key) || !this.isEqual(a[key], b[key])) {
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

    private createEmptyArray(arrayType: ArrayTypeInfo, line?: number, column?: number): unknown[] {
        if (arrayType.bounds.length === 1) {
            const bound = this.numericArrayBound(
                this.resolveArrayBound(arrayType.bounds[0], line, column),
            );
            const size = bound.upper - bound.lower + 1;
            return Array.from({ length: size }, () =>
                this.getDefaultValueForFieldType(arrayType.elementType),
            );
        }

        const result: unknown[] = [];
        const bound = this.numericArrayBound(
            this.resolveArrayBound(arrayType.bounds[0], line, column),
        );
        const size = bound.upper - bound.lower + 1;

        const subArrayType: ArrayTypeInfo = {
            elementType: arrayType.elementType,
            bounds: arrayType.bounds.slice(1),
        };

        for (let i = 0; i < size; i++) {
            result.push(this.createEmptyArray(subArrayType, line, column));
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
        if (typeof type === "object" && "kind" in type && type.kind === "CLASS") {
            return NULL_POINTER;
        }
        if (typeof type === "object" && "fields" in type) {
            const result: Record<string, unknown> = {};
            for (const [fieldName, fieldType] of Object.entries(type.fields)) {
                result[fieldName] = this.getDefaultValueForFieldType(fieldType);
            }
            return result;
        }
        if (typeof type === "object" && "elementType" in type) {
            return [];
        }
        return undefined;
    }

    private resolveType(
        type: TypeInfo,
        line?: number,
        column?: number,
        resolving: Set<string> = new Set(),
    ): TypeInfo {
        return resolveTypeHelper(
            type,
            this.userDefinedTypes,
            this.enumTypes,
            this.setTypes,
            this.pointerTypes,
            this.classDefinitions,
            line,
            column,
            resolving,
        );
    }

    private resolveFullClassDefinition(className: string): ClassTypeInfo | undefined {
        return resolveFullClassDefinitionHelper(
            className,
            this.classDefinitions,
            this.resolvedClassCache,
        );
    }

    private findMethodBody(className: string, methodName: string): RuntimeMethodInfo | undefined {
        return findMethodInHierarchy(
            className,
            methodName,
            this.classMethodBodies,
            this.classDefinitions,
        );
    }

    private getDefaultValue(type: TypeInfo, line?: number, column?: number): unknown {
        if (typeof type === "object" && "kind" in type && type.kind === "SET") {
            return new Set();
        }
        if (typeof type === "object" && "elementType" in type && !("kind" in type)) {
            return this.createEmptyArray(type, line, column);
        }
        return getDefaultValueHelper(type);
    }

    private resolveArrayElementType(arrayType: TypeInfo, indexCount: number): TypeInfo {
        return resolveArrayElementTypeHelper(arrayType, indexCount);
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
        let currentArray: unknown[] = array;
        for (let i = 0; i < indices.length; i++) {
            const index = indices[i];
            if (!Number.isInteger(index)) {
                throw new IndexError("Array index must be INTEGER");
            }
            if (index < 1 || index > currentArray.length) {
                throw new IndexError(`Array index out of bounds: ${index}`);
            }
            if (i === indices.length - 1) {
                return currentArray[index - 1];
            }
            const subArray = currentArray[index - 1];
            if (!Array.isArray(subArray)) {
                throw new RuntimeError("Array access on non-array value");
            }
            currentArray = subArray;
        }
        return undefined;
    }

    private setArrayElement(array: unknown, indices: number[], value: unknown): void {
        if (!Array.isArray(array)) {
            throw new RuntimeError("Array access on non-array value");
        }

        this.setArrayElementInValue(array, indices, value);
    }

    private setArrayElementInValue(array: unknown[], indices: number[], value: unknown): void {
        let currentArray: unknown[] = array;
        for (let i = 0; i < indices.length; i++) {
            const index = indices[i];
            if (!Number.isInteger(index)) {
                throw new IndexError("Array index must be INTEGER");
            }
            if (index < 1 || index > currentArray.length) {
                throw new IndexError(`Array index out of bounds: ${index}`);
            }
            if (i === indices.length - 1) {
                currentArray[index - 1] = value;
                return;
            }
            const subArray = currentArray[index - 1];
            if (!Array.isArray(subArray)) {
                throw new RuntimeError("Array access on non-array value");
            }
            currentArray = subArray;
        }
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
