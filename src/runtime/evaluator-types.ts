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

import { Environment, ExecutionContext, RoutineInfo } from "./environment";
import { IOInterface } from "../io/io-interface";
import { VariableAtomFactory, VariableAtom } from "./variable-atoms";
import { DebuggerController, DebugSnapshot, type DebugPauseReason } from "./debugger";
import { Heap, NULL_POINTER } from "./heap";
import { RuntimeFileManager } from "./file-manager";
import { FileOperationEvaluator } from "./file-operations-evaluator";
import type { ImportInfo } from "./linker";

export interface CaseNode extends StatementNode {
    type: "Case";
    expression: ExpressionNode;
    cases: { values: ExpressionNode[]; body: StatementNode[] }[];
    otherwise?: StatementNode[];
}

export type EvaluatableNode =
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

export interface EvaluatorCallbacks {
    evaluate(node: ASTNode): Promise<unknown>;
    executeStatement(statement: StatementNode): Promise<unknown>;
}

export interface EvaluatorCore {
    heap: Heap;
    environment: Environment;
    context: ExecutionContext;
    io: IOInterface;
    fileManager: RuntimeFileManager;
    fileOperations: FileOperationEvaluator;
    debuggerController?: DebuggerController;
    onStep?: () => void;
    strictMode: boolean;
    namespaceImports: Map<string, ImportInfo>;
    globalRoutines: Map<string, RoutineInfo>;
    userDefinedTypes: Map<string, UserDefinedTypeInfo>;
    enumTypes: Map<string, EnumTypeInfo>;
    setTypes: Map<string, SetTypeInfo>;
    pointerTypes: Map<string, PointerTypeInfo>;
    classDefinitions: Map<string, ClassTypeInfo>;
    classMethodBodies: Map<string, Map<string, RuntimeMethodInfo>>;
    resolvedClassCache: Map<string, ClassTypeInfo>;
    callbacks: EvaluatorCallbacks;
}

export function isEvaluatableNode(node: ASTNode): node is EvaluatableNode {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isIdentifierNode(node: ExpressionNode): node is IdentifierNode {
    return node.type === "Identifier";
}

export function isArrayAccessNode(node: ExpressionNode): node is ArrayAccessNode {
    return node.type === "ArrayAccess";
}

export function isMemberAccessNode(node: ExpressionNode): node is MemberAccessNode {
    return node.type === "MemberAccess";
}

export function isPointerDereferenceNode(node: ExpressionNode): node is PointerDereferenceNode {
    return node.type === "PointerDereference";
}

export function isProcedureDeclarationNode(node: ASTNode): node is ProcedureDeclarationNode {
    return node.type === "ProcedureDeclaration";
}

export function isFunctionDeclarationNode(node: ASTNode): node is FunctionDeclarationNode {
    return node.type === "FunctionDeclaration";
}

export function ensureNumber(value: unknown, line?: number, column?: number): number {
    if (typeof value !== "number") {
        throw new RuntimeError("Expected numeric value", line, column);
    }
    return value;
}

export function ensureIndices(values: unknown[], line?: number, column?: number): number[] {
    return values.map((value) => {
        const num = ensureNumber(value, line, column);
        if (!Number.isInteger(num)) {
            throw new IndexError("Array index must be INTEGER", line, column);
        }
        return num;
    });
}

export function ensureStringOrNumber(value: unknown, line?: number, column?: number): string | number {
    if (typeof value !== "string" && typeof value !== "number") {
        throw new RuntimeError("Expected STRING or NUMBER value", line, column);
    }
    return value;
}

export function ensurePseudocodeType(type: TypeInfo, line?: number, column?: number): PseudocodeType {
    if (typeof type !== "string") {
        throw new RuntimeError("Expected scalar pseudocode type", line, column);
    }
    return type;
}

export function getRecordField<T>(record: Record<string, T>, fieldName: string): T | undefined {
    for (const [key, value] of Object.entries(record)) {
        if (key === fieldName) {
            return value;
        }
    }
    return undefined;
}

export {
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
    RuntimeError,
    DivisionByZeroError,
    IndexError,
    Environment,
    ExecutionContext,
    RoutineInfo,
    IOInterface,
    VariableAtomFactory,
    VariableAtom,
    DebuggerController,
    DebugSnapshot,
    DebugPauseReason,
    Heap,
    NULL_POINTER,
    RuntimeFileManager,
    FileOperationEvaluator,
    ImportInfo,
    RuntimeMethodInfo,
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
};
