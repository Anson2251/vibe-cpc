import type {
    ASTNode,
    StatementNode,
    ExpressionNode,
    AssignmentNode,
    VariableDeclarationNode,
    IfNode,
    ForNode,
    WhileNode,
    RepeatNode,
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
    DebuggerNode,
    DisposeStatementNode,
    SuperCallNode,
    RuntimeMethodInfo,
} from "../parser/ast-nodes";

import type { TypeInfo, ClassTypeInfo } from "../types";
import type { Environment, RoutineInfo, ExecutionContext } from "./environment";
import type { IOOperation, IOQueue } from "./io-queue";
import type { Heap } from "./heap";
import type { RuntimeFileManager } from "./file-manager";
import type { DebuggerController, DebugSnapshot } from "./debugger";
import type { IOInterface } from "../io/io-interface";

export type FrameSyscall =
    | { type: "io_input"; prompt: string }
    | { type: "io_output"; data: string }
    | { type: "file_op"; operation: IOOperation }
    | { type: "debug_pause"; snapshot: DebugSnapshot }
    | { type: "host_call"; name: string; args: unknown[] };

export type FrameResult =
    | { kind: "continue"; ctx: FrameContext }
    | { kind: "syscall"; call: FrameSyscall; ctx: FrameContext }
    | { kind: "complete"; value: unknown };

export interface FrameContext {
    valueStack: unknown[];
    frameStack: Frame[];
    callStack: CallFrame[];
    envStack: Environment[];
    currentNode: ASTNode | null;
    currentLine?: number;
    currentColumn?: number;
    shouldReturn: boolean;
    returnValue: unknown;
    pendingArgNodes?: ExpressionNode[];
}

export type Frame =
    | { kind: "BinaryRight"; op: string; right: ExpressionNode; line?: number; column?: number }
    | { kind: "BinaryOp"; op: string; leftValue: unknown; line?: number; column?: number }
    | { kind: "UnaryOp"; op: string }
    | { kind: "CallArgs"; callee: string; namespace?: string; args: unknown[]; argNodes: ExpressionNode[]; index: number; totalArgs: number; line?: number; column?: number }
    | { kind: "CallOp"; callee: string; namespace?: string; args: unknown[]; line?: number; column?: number }
    | { kind: "ArrayAccessIndex"; array: ExpressionNode; indexNodes: ExpressionNode[]; indices: number[]; index: number; totalIndices: number; line?: number; column?: number }
    | { kind: "ArrayAccessRead"; address: number }
    | { kind: "MemberAccess"; object: ExpressionNode; field: string; line?: number; column?: number }
    | { kind: "NewExpressionArgs"; className: string; args: unknown[]; argNodes: ExpressionNode[]; index: number; totalArgs: number; line?: number; column?: number }
    | { kind: "NewExpressionOp"; className: string; args: unknown[]; line?: number; column?: number }
    | { kind: "TypeCast"; targetType: TypeInfo; line?: number; column?: number }
    | { kind: "SetLiteralElements"; elements: ExpressionNode[]; index: number; collected: unknown[]; line?: number; column?: number }
    | { kind: "PointerDereference"; pointer: ExpressionNode }
    | { kind: "AddressOf"; target: ExpressionNode }
    | { kind: "AssignmentValue"; target: AssignmentNode; line?: number; column?: number }
    | { kind: "VariableDeclarationValue"; node: VariableDeclarationNode; line?: number; column?: number }
    | { kind: "IfCondition"; node: IfNode }
    | { kind: "IfElse"; node: IfNode }
    | { kind: "CaseExpression"; node: import("../parser/ast-nodes").StatementNode & { type: "Case"; expression: ExpressionNode; cases: { values: ExpressionNode[]; body: StatementNode[] }[]; otherwise?: StatementNode[] } }
    | { kind: "CaseMatch"; node: import("../parser/ast-nodes").StatementNode & { type: "Case"; expression: ExpressionNode; cases: { values: ExpressionNode[]; body: StatementNode[] }[]; otherwise?: StatementNode[] }; expressionValue: string | number; caseIndex: number }
    | { kind: "ForStart"; node: ForNode; startValue?: number }
    | { kind: "ForEnd"; node: ForNode; startValue: number; endValue?: number }
    | { kind: "ForStep"; node: ForNode; startValue: number; endValue: number; stepValue?: number }
    | { kind: "ForBody"; node: ForNode; startValue: number; endValue: number; stepValue: number }
    | { kind: "ForLoop"; node: ForNode; startValue: number; endValue: number; stepValue: number; increment: boolean }
    | { kind: "WhileCondition"; node: WhileNode }
    | { kind: "WhileBody"; node: WhileNode }
    | { kind: "WhileLoop"; node: WhileNode }
    | { kind: "RepeatBody"; node: RepeatNode }
    | { kind: "RepeatCondition"; node: RepeatNode }
    | { kind: "RepeatCheck"; node: RepeatNode }
    | { kind: "RepeatLoop"; node: RepeatNode; firstIteration: boolean }
    | { kind: "OutputExpression"; node: OutputNode; values: string[]; index: number }
    | { kind: "ReturnValue"; node: ReturnNode }
    | { kind: "InputPrompt"; node: InputNode }
    | { kind: "SeqStatement"; statements: StatementNode[]; index: number }
    | { kind: "CallStatement"; node: CallStatementNode }
    | { kind: "SuperCall"; node: SuperCallNode }
    | { kind: "DisposeStatement"; node: DisposeStatementNode }
    | { kind: "Debugger"; node: DebuggerNode }
    | { kind: "FileOpen"; node: OpenFileNode }
    | { kind: "FileClose"; node: CloseFileNode }
    | { kind: "FileRead"; node: ReadFileNode }
    | { kind: "FileWrite"; node: WriteFileNode; values: string[] }
    | { kind: "FileSeek"; node: SeekNode }
    | { kind: "FileGetRecord"; node: GetRecordNode }
    | { kind: "FilePutRecord"; node: PutRecordNode; data: string }
    | { kind: "ReturnFromCall"; savedEnv: Environment; savedContext: Omit<FrameContext, "envStack">; routineEnv: Environment };

export interface CallFrame {
    routineName: string;
    environment: Environment;
    returnAddress?: { line: number; column: number };
}

export interface FrameEvaluatorDeps {
    heap: Heap;
    environment: Environment;
    context: ExecutionContext;
    io: IOInterface;
    ioQueue: IOQueue;
    fileManager: RuntimeFileManager;
    globalRoutines: Map<string, RoutineInfo>;
    userDefinedTypes: Map<string, import("../types").UserDefinedTypeInfo>;
    enumTypes: Map<string, import("../types").EnumTypeInfo>;
    setTypes: Map<string, import("../types").SetTypeInfo>;
    pointerTypes: Map<string, import("../types").PointerTypeInfo>;
    classDefinitions: Map<string, ClassTypeInfo>;
    classMethodBodies: Map<string, Map<string, RuntimeMethodInfo>>;
    resolvedClassCache: Map<string, ClassTypeInfo>;
    debuggerController?: DebuggerController;
    onStep?: () => void;
    strictMode: boolean;
    namespaceImports: Map<string, import("./linker").ImportInfo>;
}
