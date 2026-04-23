// oxlint-disable typescript/no-unsafe-type-assertion
import {
    ASTNode,
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
    ArrayTypeInfo,
} from "../types";

import { RuntimeError, DivisionByZeroError, IndexError } from "../errors";

import { EXTENDED_BUILTIN_NAMES } from "./builtin-functions";
import { FileMode } from "./file-manager";
import { Environment } from "./environment";
import type { RoutineInfo } from "./environment";
import { VariableAtomFactory, VariableAtom } from "./variable-atoms";
import { type DebugSnapshot, type DebugPauseReason } from "./debugger";
import { NULL_POINTER } from "./heap";
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

import {
    FrameContext,
    FrameResult,
    FrameEvaluatorDeps,
    FrameSyscall,
} from "./frame-stack";

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

function extractRoutineBody(node: ASTNode | undefined): StatementNode[] {
    if (!node || typeof node !== "object") {
        return [];
    }
    const maybeBody = (node as unknown as Record<string, unknown>).body;
    if (!Array.isArray(maybeBody)) {
        return [];
    }
    return maybeBody as StatementNode[];
}

export class FrameEvaluator {
    private deps: FrameEvaluatorDeps;

    constructor(deps: FrameEvaluatorDeps) {
        this.deps = deps;
    }

    step(ctx: FrameContext): FrameResult {
        if (ctx.currentNode) {
            return this.evalNode(ctx, ctx.currentNode);
        }

        if (ctx.frameStack.length > 0) {
            return this.resumeFrame(ctx);
        }

        // Only complete when there's nothing left to do
        if (ctx.shouldReturn) {
            return { kind: "complete", value: ctx.returnValue };
        }

        return {
            kind: "complete",
            value: ctx.valueStack.length > 0 ? ctx.valueStack.pop() : undefined,
        };
    }

    createInitialContext(node: ASTNode): FrameContext {
        return {
            valueStack: [],
            frameStack: [],
            callStack: [],
            envStack: [this.deps.environment],
            currentNode: node,
            currentLine: undefined,
            currentColumn: undefined,
            shouldReturn: false,
            returnValue: undefined,
        };
    }

    private currentEnv(ctx: FrameContext): Environment {
        return ctx.envStack[ctx.envStack.length - 1];
    }

    private evalNode(ctx: FrameContext, node: ASTNode): FrameResult {
        if (node.line !== undefined) {
            ctx.currentLine = node.line;
        }
        if (node.column !== undefined) {
            ctx.currentColumn = node.column;
        }

        this.deps.onStep?.();

        switch (node.type) {
            case "Literal":
                return this.evalLiteral(ctx, node as LiteralNode);

            case "Identifier":
                return this.evalIdentifier(ctx, node as IdentifierNode);

            case "BinaryExpression":
                return this.evalBinaryExpression(ctx, node as BinaryExpressionNode);

            case "UnaryExpression":
                return this.evalUnaryExpression(ctx, node as UnaryExpressionNode);

            case "ArrayAccess":
                return this.evalArrayAccess(ctx, node as ArrayAccessNode);

            case "CallExpression":
                return this.evalCallExpression(ctx, node as CallExpressionNode);

            case "MemberAccess":
                return this.evalMemberAccess(ctx, node as MemberAccessNode);

            case "NewExpression":
                return this.evalNewExpression(ctx, node as NewExpressionNode);

            case "TypeCast":
                return this.evalTypeCast(ctx, node as TypeCastNode);

            case "SetLiteral":
                return this.evalSetLiteral(ctx, node as SetLiteralNode);

            case "PointerDereference":
                return this.evalPointerDereference(ctx, node as PointerDereferenceNode);

            case "AddressOf":
                return this.evalAddressOf(ctx, node as AddressOfNode);

            case "VariableDeclaration":
                return this.evalVariableDeclaration(ctx, node as VariableDeclarationNode);

            case "DeclareStatement":
                return this.evalDeclareStatement(ctx, node as DeclareStatementNode);

            case "Assignment":
                return this.evalAssignment(ctx, node as AssignmentNode);

            case "If":
                return this.evalIf(ctx, node as IfNode);

            case "Case":
                return this.evalCase(ctx, node as CaseNode);

            case "For":
                return this.evalFor(ctx, node as ForNode);

            case "While":
                return this.evalWhile(ctx, node as WhileNode);

            case "Repeat":
                return this.evalRepeat(ctx, node as RepeatNode);

            case "ProcedureDeclaration":
                return this.evalProcedureDeclaration(ctx, node as ProcedureDeclarationNode);

            case "FunctionDeclaration":
                return this.evalFunctionDeclaration(ctx, node as FunctionDeclarationNode);

            case "CallStatement":
                return this.evalCallStatement(ctx, node as CallStatementNode);

            case "Input":
                return this.evalInput(ctx, node as InputNode);

            case "Output":
                return this.evalOutput(ctx, node as OutputNode);

            case "Return":
                return this.evalReturn(ctx, node as ReturnNode);

            case "OpenFile":
                return this.evalOpenFile(ctx, node as OpenFileNode);

            case "CloseFile":
                return this.evalCloseFile(ctx, node as CloseFileNode);

            case "ReadFile":
                return this.evalReadFile(ctx, node as ReadFileNode);

            case "WriteFile":
                return this.evalWriteFile(ctx, node as WriteFileNode);

            case "Seek":
                return this.evalSeek(ctx, node as SeekNode);

            case "GetRecord":
                return this.evalGetRecord(ctx, node as GetRecordNode);

            case "PutRecord":
                return this.evalPutRecord(ctx, node as PutRecordNode);

            case "TypeDeclaration":
                return this.evalTypeDeclaration(ctx, node as TypeDeclarationNode);

            case "SetDeclaration":
                return this.evalSetDeclaration(ctx, node as SetDeclarationNode);

            case "ClassDeclaration":
                return this.evalClassDeclaration(ctx, node as ClassDeclarationNode);

            case "MethodDeclaration":
                ctx.currentNode = null;
                return { kind: "continue", ctx };

            case "SuperCall":
                return this.evalSuperCall(ctx, node as SuperCallNode);

            case "Debugger":
                return this.evalDebugger(ctx, node as DebuggerNode);

            case "DisposeStatement":
                return this.evalDisposeStatement(ctx, node as DisposeStatementNode);

            case "ImportStatement":
            case "ImportExpression":
                if (this.deps.strictMode) {
                    throw new RuntimeError(
                        "IMPORT is not a CAIE standard feature",
                        node.line,
                        node.column,
                    );
                }
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            case "ExportStatement":
                if (this.deps.strictMode) {
                    throw new RuntimeError(
                        "EXPORT is not a CAIE standard feature",
                        node.line,
                        node.column,
                    );
                }
                ctx.currentNode = null;
                return { kind: "continue", ctx };

            case "Program": {
                const programNode = node as import("../parser/ast-nodes").ProgramNode;
                if (programNode.body.length > 0) {
                    ctx.frameStack.push({
                        kind: "SeqStatement",
                        statements: programNode.body,
                        index: 0,
                    });
                    ctx.currentNode = programNode.body[0];
                } else {
                    ctx.currentNode = null;
                }
                return { kind: "continue", ctx };
            }

            default:
                throw new RuntimeError(`Unknown node type: ${(node as { type: string }).type}`, node.line, node.column);
        }
    }

    private evalLiteral(ctx: FrameContext, node: LiteralNode): FrameResult {
        ctx.valueStack.push(node.value);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalIdentifier(ctx: FrameContext, node: IdentifierNode): FrameResult {
        const env = this.currentEnv(ctx);
        if (env.has(node.name)) {
            const varType = env.getType(node.name);
            // For record types, return the heap address for member access
            if (typeof varType === "object" && varType !== null && "fields" in varType) {
                const atom = env.getAtom(node.name);
                // For CLASS types, return the value (heap address of the object)
                // For user-defined record types, return the variable's storage address
                if ("kind" in varType && varType.kind === "CLASS") {
                    ctx.valueStack.push(atom.getValue(this.deps.heap));
                } else {
                    ctx.valueStack.push(atom.getAddress());
                }
            } else {
                ctx.valueStack.push(env.get(node.name));
            }
        } else {
            for (const enumType of this.deps.enumTypes.values()) {
                if (enumType.values.includes(node.name)) {
                    ctx.valueStack.push(node.name);
                    ctx.currentNode = null;
                    return { kind: "continue", ctx };
                }
            }
            ctx.valueStack.push(env.get(node.name));
        }
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalBinaryExpression(ctx: FrameContext, node: BinaryExpressionNode): FrameResult {
        ctx.frameStack.push({
            kind: "BinaryRight",
            op: node.operator,
            right: node.right,
            line: node.line,
            column: node.column,
        });
        ctx.currentNode = node.left;
        return { kind: "continue", ctx };
    }

    private evalUnaryExpression(ctx: FrameContext, node: UnaryExpressionNode): FrameResult {
        ctx.frameStack.push({ kind: "UnaryOp", op: node.operator });
        ctx.currentNode = node.operand;
        return { kind: "continue", ctx };
    }

    private evalArrayAccess(ctx: FrameContext, node: ArrayAccessNode): FrameResult {
        ctx.frameStack.push({
            kind: "ArrayAccessIndex",
            array: node.array,
            indexNodes: node.indices,
            indices: [],
            index: 0,
            totalIndices: node.indices.length,
            line: node.line,
            column: node.column,
        });
        if (node.indices.length > 0) {
            ctx.currentNode = node.indices[0];
        } else {
            throw new RuntimeError("Array access requires at least one index", node.line, node.column);
        }
        return { kind: "continue", ctx };
    }

    private evalCallExpression(ctx: FrameContext, node: CallExpressionNode): FrameResult {
        if (node.arguments.length > 0) {
            ctx.frameStack.push({
                kind: "CallArgs",
                callee: node.name,
                namespace: node.namespace,
                args: [],
                argNodes: node.arguments,
                index: 0,
                totalArgs: node.arguments.length,
                line: node.line,
                column: node.column,
            });
            ctx.currentNode = node.arguments[0];
            return { kind: "continue", ctx };
        } else {
            // No arguments - call directly without pushing frame
            return this.makeHostCall(ctx, node.name, node.namespace || undefined, []);
        }
    }

    private evalMemberAccess(ctx: FrameContext, node: MemberAccessNode): FrameResult {
        // For simple identifiers, get the address directly instead of evaluating to value
        if (isIdentifierNode(node.object)) {
            const atom = this.currentEnv(ctx).getAtom(node.object.name);
            const varType = this.currentEnv(ctx).getType(node.object.name);
            let objAddress: number;
            // For CLASS types, the value stored is the heap address of the object
            if (typeof varType === "object" && varType !== null && "kind" in varType && varType.kind === "CLASS") {
                objAddress = atom.getValue(this.deps.heap) as number;
            } else {
                objAddress = atom.getAddress();
            }
            ctx.frameStack.push({
                kind: "MemberAccess",
                object: node.object,
                field: node.field,
                line: node.line,
                column: node.column,
            });
            ctx.valueStack.push(objAddress);
            ctx.currentNode = null;
            return { kind: "continue", ctx };
        }
        ctx.frameStack.push({
            kind: "MemberAccess",
            object: node.object,
            field: node.field,
            line: node.line,
            column: node.column,
        });
        ctx.currentNode = node.object;
        return { kind: "continue", ctx };
    }

    private evalNewExpression(ctx: FrameContext, node: NewExpressionNode): FrameResult {
        ctx.frameStack.push({
            kind: "NewExpressionArgs",
            className: node.className,
            args: [],
            argNodes: node.arguments,
            index: 0,
            totalArgs: node.arguments.length,
            line: node.line,
            column: node.column,
        });
        if (node.arguments.length > 0) {
            ctx.currentNode = node.arguments[0];
        } else {
            return this.createNewObject(ctx, node.className, []);
        }
        return { kind: "continue", ctx };
    }

    private evalTypeCast(ctx: FrameContext, node: TypeCastNode): FrameResult {
        ctx.frameStack.push({
            kind: "TypeCast",
            targetType: node.targetType,
            line: node.line,
            column: node.column,
        });
        ctx.currentNode = node.expression;
        return { kind: "continue", ctx };
    }

    private evalSetLiteral(ctx: FrameContext, node: SetLiteralNode): FrameResult {
        ctx.frameStack.push({
            kind: "SetLiteralElements",
            elements: node.elements,
            index: 0,
            collected: [],
            line: node.line,
            column: node.column,
        });
        if (node.elements.length > 0) {
            ctx.currentNode = node.elements[0];
        } else {
            ctx.valueStack.push(new Set());
            ctx.currentNode = null;
            return { kind: "continue", ctx };
        }
        return { kind: "continue", ctx };
    }

    private evalPointerDereference(ctx: FrameContext, node: PointerDereferenceNode): FrameResult {
        ctx.frameStack.push({ kind: "PointerDereference", pointer: node.pointer });
        ctx.currentNode = node.pointer;
        return { kind: "continue", ctx };
    }

    private evalAddressOf(ctx: FrameContext, node: AddressOfNode): FrameResult {
        ctx.frameStack.push({ kind: "AddressOf", target: node.target });
        ctx.currentNode = node.target;
        return { kind: "continue", ctx };
    }

    private evalVariableDeclaration(ctx: FrameContext, node: VariableDeclarationNode): FrameResult {
        ctx.frameStack.push({
            kind: "VariableDeclarationValue",
            node,
            line: node.line,
            column: node.column,
        });
        if (node.initialValue) {
            ctx.currentNode = node.initialValue;
        } else {
            return this.performVariableDeclaration(ctx, node, undefined);
        }
        return { kind: "continue", ctx };
    }

    private evalDeclareStatement(ctx: FrameContext, node: DeclareStatementNode): FrameResult {
        let initialValue: unknown = undefined;
        let resolvedType: TypeInfo;

        if (node.initialValue) {
            const result = this.evalSync(node.initialValue, ctx);
            initialValue = result;
        }

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

        let finalValue: unknown;
        if (initialValue !== undefined) {
            finalValue = initialValue;
        } else if (
            typeof resolvedType === "object" &&
            resolvedType !== null &&
            "elementType" in resolvedType &&
            "bounds" in resolvedType
        ) {
            finalValue = this.allocateArrayWithVariableBounds(ctx, resolvedType as ArrayTypeInfo);
        } else {
            finalValue = this.getDefaultValue(resolvedType, node.line, node.column);
        }

        this.currentEnv(ctx).define(node.name, resolvedType, finalValue, node.isConstant);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private allocateArrayWithVariableBounds(ctx: FrameContext, arrayType: ArrayTypeInfo): number {
        const env = this.currentEnv(ctx);
        const resolvedBounds = arrayType.bounds.map((bound) => {
            const lower = typeof bound.lower === "string" ? this.evalSyncVariable(bound.lower, env) : bound.lower;
            const upper = typeof bound.upper === "string" ? this.evalSyncVariable(bound.upper, env) : bound.upper;
            return { lower: lower as number, upper: upper as number };
        });

        const firstBoundSize = resolvedBounds[0].upper - resolvedBounds[0].lower + 1;

        if (arrayType.bounds.length > 1) {
            const subArrayType: ArrayTypeInfo = {
                elementType: arrayType.elementType,
                bounds: resolvedBounds.slice(1).map((b) => ({ lower: b.lower, upper: b.upper })),
            };
            const addresses: number[] = [];
            for (let i = 0; i < firstBoundSize; i++) {
                const subArrayAddr = this.allocateArrayWithVariableBounds(ctx, subArrayType);
                addresses.push(subArrayAddr);
            }
            return this.deps.heap.allocate(addresses, arrayType, true, false);
        }

        const elementType = arrayType.elementType;
        const addresses: number[] = [];
        for (let i = 0; i < firstBoundSize; i++) {
            const defaultValue = this.getDefaultValue(elementType, 0, 0);
            const addr = this.deps.heap.allocate(defaultValue, elementType, true, false);
            addresses.push(addr);
        }
        return this.deps.heap.allocate(addresses, arrayType, true, false);
    }

    private allocateArray(ctx: FrameContext, arrayType: ArrayTypeInfo): number {
        return this.allocateArrayWithVariableBounds(ctx, arrayType);
    }

    private evalSyncVariable(name: string, env: Environment): number {
        const value = env.get(name);
        if (typeof value !== "number" || !Number.isInteger(value)) {
            throw new RuntimeError(`Array bound variable '${name}' must be an integer`);
        }
        return value;
    }

    private evalAssignment(ctx: FrameContext, node: AssignmentNode): FrameResult {
        // Pre-check: if target is an enum variable and value is an undefined identifier,
        // produce a better error message
        if (isIdentifierNode(node.target) && isIdentifierNode(node.value)) {
            const env = this.currentEnv(ctx);
            const varType = env.getType(node.target.name);
            if (
                typeof varType === "object" &&
                varType !== null &&
                "kind" in varType &&
                varType.kind === "ENUM" &&
                !env.has(node.value.name)
            ) {
                let isEnumValue = false;
                for (const enumType of this.deps.enumTypes.values()) {
                    if (enumType.values.includes(node.value.name)) {
                        isEnumValue = true;
                        break;
                    }
                }
                if (!isEnumValue) {
                    const enumType = varType as EnumTypeInfo;
                    throw new RuntimeError(
                        `Expected enum '${enumType.name}' value`,
                        node.line,
                        node.column,
                    );
                }
            }
        }
        ctx.frameStack.push({
            kind: "AssignmentValue",
            target: node,
            line: node.line,
            column: node.column,
        });
        ctx.currentNode = node.value;
        return { kind: "continue", ctx };
    }

    private evalIf(ctx: FrameContext, node: IfNode): FrameResult {
        ctx.frameStack.push({
            kind: "IfCondition",
            node,
        });
        ctx.currentNode = node.condition;
        return { kind: "continue", ctx };
    }

    private evalCase(ctx: FrameContext, node: CaseNode): FrameResult {
        const expressionValue = ensureStringOrNumber(
            this.evalSync(node.expression, ctx),
            node.line,
            node.column,
        );

        for (const caseItem of node.cases) {
            if (caseItem.values.length === 2) {
                const value1 = ensureStringOrNumber(
                    this.evalSync(caseItem.values[0], ctx),
                    node.line,
                    node.column,
                );
                const value2 = ensureStringOrNumber(
                    this.evalSync(caseItem.values[1], ctx),
                    node.line,
                    node.column,
                );

                if (value1 <= expressionValue && expressionValue <= value2) {
                    return this.evalStatementSeq(ctx, caseItem.body);
                }
            } else if (caseItem.values.length === 1) {
                const value = this.evalSync(caseItem.values[0], ctx);

                if (this.isEqual(expressionValue, value)) {
                    return this.evalStatementSeq(ctx, caseItem.body);
                }
            } else {
                throw new RuntimeError("Invalid case item", node.line, node.column);
            }
        }

        if (node.otherwise) {
            return this.evalStatementSeq(ctx, node.otherwise);
        }

        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalFor(ctx: FrameContext, node: ForNode): FrameResult {
        // Push ForStart frame to handle initialization and condition check
        ctx.frameStack.push({
            kind: "ForStart",
            node,
        });
        ctx.currentNode = node.start;
        return { kind: "continue", ctx };
    }

    private evalForCondition(ctx: FrameContext, node: ForNode, startValue: number, endValue: number, stepValue: number): FrameResult {
        const currentValue = ensureNumber(
            this.currentEnv(ctx).get(node.variable),
            node.line,
            node.column,
        );

        const increment = stepValue > 0;
        const shouldContinue = increment ? currentValue <= endValue : currentValue >= endValue;

        if (!shouldContinue) {
            ctx.currentNode = null;
            return { kind: "continue", ctx };
        }

        // Execute body and then loop
        if (node.body.length > 0) {
            ctx.frameStack.push({
                kind: "ForLoop",
                node,
                startValue,
                endValue,
                stepValue,
                increment,
            });
            ctx.frameStack.push({
                kind: "SeqStatement",
                statements: node.body,
                index: 0,
            });
            ctx.currentNode = node.body[0];
        } else {
            // No body, just update and continue
            const current = ensureNumber(
                this.currentEnv(ctx).get(node.variable),
                node.line,
                node.column,
            );
            this.currentEnv(ctx).assign(node.variable, current + stepValue);
            return this.evalForCondition(ctx, node, startValue, endValue, stepValue);
        }
        return { kind: "continue", ctx };
    }

    private evalWhile(ctx: FrameContext, node: WhileNode): FrameResult {
        // Push WhileCondition frame to evaluate condition
        ctx.frameStack.push({
            kind: "WhileCondition",
            node,
        });
        ctx.currentNode = node.condition;
        return { kind: "continue", ctx };
    }

    private evalRepeat(ctx: FrameContext, node: RepeatNode): FrameResult {
        // Push RepeatCondition frame and execute body first
        ctx.frameStack.push({
            kind: "RepeatCondition",
            node,
        });
        if (node.body.length > 0) {
            ctx.frameStack.push({
                kind: "SeqStatement",
                statements: node.body,
                index: 0,
            });
            ctx.currentNode = node.body[0];
        } else {
            // No body, check condition immediately
            ctx.currentNode = node.condition;
        }
        return { kind: "continue", ctx };
    }

    private evalProcedureDeclaration(ctx: FrameContext, node: ProcedureDeclarationNode): FrameResult {
        const routineInfo: RoutineInfo = {
            name: node.name,
            parameters: node.parameters.map((p) => ({
                name: p.name,
                type: p.dataType,
                mode: p.mode,
            })),
            node,
            isBuiltIn: false,
        };
        this.currentEnv(ctx).defineRoutine({
            name: node.name,
            parameters: node.parameters.map((p) => ({
                name: p.name,
                type: p.dataType,
                mode: p.mode,
            })),
        });
        this.deps.globalRoutines.set(node.name, routineInfo);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalFunctionDeclaration(ctx: FrameContext, node: FunctionDeclarationNode): FrameResult {
        const routineInfo: RoutineInfo = {
            name: node.name,
            parameters: node.parameters.map((p) => ({
                name: p.name,
                type: p.dataType,
                mode: p.mode,
            })),
            returnType: node.returnType,
            node,
            isBuiltIn: false,
        };
        this.currentEnv(ctx).defineRoutine({
            name: node.name,
            parameters: node.parameters.map((p) => ({
                name: p.name,
                type: p.dataType,
                mode: p.mode,
            })),
            returnType: node.returnType,
        });
        this.deps.globalRoutines.set(node.name, routineInfo);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalCallStatement(ctx: FrameContext, node: CallStatementNode): FrameResult {
        if (!node.namespace && this.currentEnv(ctx).hasRoutine(node.name)) {
            const signature = this.currentEnv(ctx).getRoutine(node.name);
            if (signature.returnType) {
                throw new RuntimeError(
                    `Cannot CALL function '${node.name}', use it in an expression instead`,
                    node.line,
                    node.column,
                );
            }
        }

        return this.evalCallExpression(ctx, {
            type: "CallExpression",
            name: node.name,
            namespace: node.namespace,
            arguments: node.arguments,
            line: node.line,
            column: node.column,
        });
    }

    private evalInput(ctx: FrameContext, node: InputNode): FrameResult {
        let promptText = "";
        if (node.prompt) {
            promptText = String(this.evalSync(node.prompt, ctx));
        }

        // Store input node info in frame for later processing
        ctx.frameStack.push({
            kind: "InputPrompt",
            node,
        });

        return {
            kind: "syscall",
            call: { type: "io_input", prompt: promptText },
            ctx: { ...ctx, currentNode: null },
        };
    }

    private evalOutput(ctx: FrameContext, node: OutputNode): FrameResult {
        if (node.expressions.length === 0) {
            return {
                kind: "syscall",
                call: { type: "io_output", data: "\n" },
                ctx: { ...ctx, currentNode: null },
            };
        }

        ctx.frameStack.push({
            kind: "OutputExpression",
            node,
            values: [],
            index: 0,
        });
        ctx.currentNode = node.expressions[0];
        return { kind: "continue", ctx };
    }

    private evalReturn(ctx: FrameContext, node: ReturnNode): FrameResult {
        if (node.value) {
            ctx.frameStack.push({ kind: "ReturnValue", node });
            ctx.currentNode = node.value;
            return { kind: "continue", ctx };
        }

        ctx.shouldReturn = true;
        ctx.returnValue = undefined;
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalOpenFile(ctx: FrameContext, node: OpenFileNode): FrameResult {
        const fileId = this.evalSync(node.fileIdentifier, ctx);
        if (typeof fileId !== "string") {
            throw new RuntimeError("File identifier must be a string", node.line, node.column);
        }
        return {
            kind: "syscall",
            call: {
                type: "file_op",
                operation: {
                    type: "open",
                    fileIdentifier: fileId,
                    mode: node.mode as FileMode,
                    line: node.line,
                    column: node.column,
                },
            },
            ctx: { ...ctx, currentNode: null },
        };
    }

    private evalCloseFile(ctx: FrameContext, node: CloseFileNode): FrameResult {
        const fileId = this.evalSync(node.fileIdentifier, ctx);
        if (typeof fileId !== "string") {
            throw new RuntimeError("File identifier must be a string", node.line, node.column);
        }
        return {
            kind: "syscall",
            call: {
                type: "file_op",
                operation: {
                    type: "close",
                    fileIdentifier: fileId,
                    line: node.line,
                    column: node.column,
                },
            },
            ctx: { ...ctx, currentNode: null },
        };
    }

    private evalReadFile(ctx: FrameContext, node: ReadFileNode): FrameResult {
        const fileId = this.evalSync(node.fileIdentifier, ctx);
        if (typeof fileId !== "string") {
            throw new RuntimeError("File identifier must be a string", node.line, node.column);
        }
        return {
            kind: "syscall",
            call: {
                type: "file_op",
                operation: {
                    type: "read",
                    fileIdentifier: fileId,
                    target: (content) => {
                        this.assignToTarget(node.target, content, ctx);
                    },
                    line: node.line,
                    column: node.column,
                },
            },
            ctx: { ...ctx, currentNode: null },
        };
    }

    private evalWriteFile(ctx: FrameContext, node: WriteFileNode): FrameResult {
        const fileId = this.evalSync(node.fileIdentifier, ctx);
        if (typeof fileId !== "string") {
            throw new RuntimeError("File identifier must be a string", node.line, node.column);
        }
        const values = node.expressions.map((expr) => String(this.evalSync(expr, ctx)));
        return {
            kind: "syscall",
            call: {
                type: "file_op",
                operation: {
                    type: "write",
                    fileIdentifier: fileId,
                    values,
                    line: node.line,
                    column: node.column,
                },
            },
            ctx: { ...ctx, currentNode: null },
        };
    }

    private evalSeek(ctx: FrameContext, node: SeekNode): FrameResult {
        const fileId = this.evalSync(node.fileIdentifier, ctx);
        if (typeof fileId !== "string") {
            throw new RuntimeError("File identifier must be a string", node.line, node.column);
        }
        const position = this.evalSync(node.position, ctx);
        if (typeof position !== "number") {
            throw new RuntimeError("Seek position must be a number", node.line, node.column);
        }
        return {
            kind: "syscall",
            call: {
                type: "file_op",
                operation: {
                    type: "seek",
                    fileIdentifier: fileId,
                    position,
                    line: node.line,
                    column: node.column,
                },
            },
            ctx: { ...ctx, currentNode: null },
        };
    }

    private evalGetRecord(ctx: FrameContext, node: GetRecordNode): FrameResult {
        const fileId = this.evalSync(node.fileIdentifier, ctx);
        if (typeof fileId !== "string") {
            throw new RuntimeError("File identifier must be a string", node.line, node.column);
        }
        return {
            kind: "syscall",
            call: {
                type: "file_op",
                operation: {
                    type: "getRecord",
                    fileIdentifier: fileId,
                    target: (data) => {
                        this.deserializeRecord(data, node.target, ctx);
                    },
                    line: node.line,
                    column: node.column,
                },
            },
            ctx: { ...ctx, currentNode: null },
        };
    }

    private evalPutRecord(ctx: FrameContext, node: PutRecordNode): FrameResult {
        const fileId = this.evalSync(node.fileIdentifier, ctx);
        if (typeof fileId !== "string") {
            throw new RuntimeError("File identifier must be a string", node.line, node.column);
        }
        const data = this.serializeRecord(this.evalSync(node.source, ctx));
        return {
            kind: "syscall",
            call: {
                type: "file_op",
                operation: {
                    type: "putRecord",
                    fileIdentifier: fileId,
                    data,
                    line: node.line,
                    column: node.column,
                },
            },
            ctx: { ...ctx, currentNode: null },
        };
    }

    private evalTypeDeclaration(ctx: FrameContext, node: TypeDeclarationNode): FrameResult {
        if (node.enumValues && node.enumValues.length > 0) {
            const enumType: EnumTypeInfo = {
                kind: "ENUM",
                name: node.name,
                values: node.enumValues,
            };
            this.deps.enumTypes.set(node.name, enumType);
        } else if (node.setElementType) {
            // Handle set type declaration: TYPE TLetterSet = SET OF CHAR
            const setType: SetTypeInfo = {
                kind: "SET",
                name: node.name,
                elementType: node.setElementType,
            };
            this.deps.setTypes.set(node.name, setType);
        } else if (node.pointerType) {
            // Handle pointer type declaration: TYPE PInteger = ^INTEGER
            const resolvedPointedType = this.resolveType(node.pointerType, node.line, node.column);
            const pointerType: PointerTypeInfo = {
                kind: "POINTER",
                name: node.name,
                pointedType: resolvedPointedType,
            };
            this.deps.pointerTypes.set(node.name, pointerType);
        } else {
            const fields: Record<string, TypeInfo> = {};
            for (const field of node.fields) {
                fields[field.name] = this.resolveType(field.dataType, node.line, node.column);
            }
            const typeInfo: UserDefinedTypeInfo = {
                name: node.name,
                fields,
            };
            this.deps.userDefinedTypes.set(node.name, typeInfo);
        }
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalSetDeclaration(ctx: FrameContext, node: SetDeclarationNode): FrameResult {
        // Look up the set type by name (e.g., "LetterSet")
        const setTypeInfo = this.deps.setTypes.get(node.setTypeName);
        if (!setTypeInfo) {
            throw new RuntimeError(`Unknown set type '${node.setTypeName}'`, node.line, node.column);
        }

        // Evaluate values and validate element types
        const values: unknown[] = [];
        for (const expr of node.values) {
            const value = this.evalSync(expr, ctx);
            // Validate element type
            if (setTypeInfo.elementType === PseudocodeType.INTEGER && typeof value !== "number") {
                throw new RuntimeError(
                    `Expected ${setTypeInfo.elementType}`,
                    node.line,
                    node.column,
                );
            }
            if (setTypeInfo.elementType === PseudocodeType.CHAR && typeof value !== "string") {
                throw new RuntimeError(
                    `Expected ${setTypeInfo.elementType}`,
                    node.line,
                    node.column,
                );
            }
            values.push(value);
        }

        // Create the set and define the variable
        const setValue = new Set(values);
        this.currentEnv(ctx).define(node.name, setTypeInfo, setValue, true);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalClassDeclaration(ctx: FrameContext, node: ClassDeclarationNode): FrameResult {
        const fields: Record<string, TypeInfo> = {};
        const fieldVisibility: Record<string, "PUBLIC" | "PRIVATE"> = {};
        const methods: Record<string, ClassMethodInfo> = {};

        for (const field of node.fields) {
            fields[field.name] = this.resolveType(field.dataType, node.line, node.column);
            fieldVisibility[field.name] = field.visibility;
        }

        for (const method of node.methods) {
            methods[method.name] = {
                name: method.name,
                visibility: method.visibility,
                parameters: method.parameters.map((p) => ({
                    name: p.name,
                    type: p.dataType,
                    mode: p.mode,
                })),
                returnType: method.returnType,
                body: [],
            };
            const methodBodies = this.deps.classMethodBodies.get(node.name) || new Map<string, RuntimeMethodInfo>();
            methodBodies.set(method.name, {
                name: method.name,
                visibility: method.visibility,
                parameters: method.parameters,
                returnType: method.returnType,
                body: method.body,
            });
            this.deps.classMethodBodies.set(node.name, methodBodies);
        }

        const classDef: ClassTypeInfo = {
            kind: "CLASS",
            name: node.name,
            fields,
            fieldVisibility,
            methods,
            inherits: node.inherits,
        };
        this.deps.classDefinitions.set(node.name, classDef);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalSuperCall(ctx: FrameContext, node: SuperCallNode): FrameResult {
        const selfAddress = this.currentEnv(ctx).get("SELF");
        if (typeof selfAddress !== "number") {
            throw new RuntimeError("SUPER can only be used inside a method", node.line, node.column);
        }

        const selfHeapObj = this.deps.heap.readUnsafe(selfAddress);
        const selfType = selfHeapObj.type;
        if (typeof selfType !== "object" || !("name" in selfType)) {
            throw new RuntimeError("SELF does not refer to a class instance", node.line, node.column);
        }

        const className = selfType.name;
        const classDef = this.deps.classDefinitions.get(className);
        if (!classDef || !classDef.inherits) {
            throw new RuntimeError(
                `Class '${className}' does not inherit from any class`,
                node.line,
                node.column,
            );
        }

        const parentClassName = classDef.inherits;
        const parentMethodBodies = this.deps.classMethodBodies.get(parentClassName);
        if (!parentMethodBodies) {
            throw new RuntimeError(`Parent class '${parentClassName}' not found`, node.line, node.column);
        }

        const method = parentMethodBodies.get(node.methodName);
        if (!method) {
            throw new RuntimeError(
                `Method '${node.methodName}' not found in parent class '${parentClassName}'`,
                node.line,
                node.column,
            );
        }

        const routineEnvironment = this.currentEnv(ctx).createChild();
        routineEnvironment.define("SELF", PseudocodeType.INTEGER, selfAddress, true);

        this.bindObjectFieldsToEnvironment(selfAddress, classDef, routineEnvironment);

        for (let i = 0; i < method.parameters.length; i++) {
            const param = method.parameters[i];
            const argNode = node.arguments[i];
            const arg = argNode ? this.evalSync(argNode, ctx) : undefined;
            routineEnvironment.define(param.name, param.dataType, arg, false);
        }

        const savedEnv = this.currentEnv(ctx);

        ctx.envStack = [...ctx.envStack, routineEnvironment];
        ctx.currentNode = null;

        const bodyStatements = method.body || [];
        if (bodyStatements.length > 0) {
            return this.evalStatementSeq(ctx, bodyStatements);
        }

        return { kind: "continue", ctx };
    }

    private evalDebugger(ctx: FrameContext, node: DebuggerNode): FrameResult {
        if (this.deps.strictMode) {
            throw new RuntimeError(
                "DEBUGGER is not a CAIE standard feature (CAIE_ONLY mode is enabled)",
                node.line,
                node.column,
            );
        }
        if (this.deps.debuggerController) {
            const snapshot = this.buildDebugSnapshot("debugger-statement", node.line, node.column, ctx);
            return {
                kind: "syscall",
                call: { type: "debug_pause", snapshot },
                ctx: { ...ctx, currentNode: null },
            };
        }
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private evalDisposeStatement(ctx: FrameContext, node: DisposeStatementNode): FrameResult {
        const address = this.resolveTargetAddress(node.pointer, ctx);
        this.deps.heap.decrementRef(address);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private resumeFrame(ctx: FrameContext): FrameResult {
        const frame = ctx.frameStack.pop()!;

        switch (frame.kind) {
            case "BinaryRight": {
                const leftValue = ctx.valueStack.pop()!;
                ctx.frameStack.push({
                    kind: "BinaryOp",
                    op: frame.op,
                    leftValue,
                    line: frame.line,
                    column: frame.column,
                });
                ctx.currentNode = frame.right;
                return { kind: "continue", ctx };
            }

            case "BinaryOp": {
                const rightValue = ctx.valueStack.pop()!;
                const result = this.applyOp(frame.leftValue, rightValue, frame.op, frame.line, frame.column);
                ctx.valueStack.push(result);
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "UnaryOp": {
                const operand = ctx.valueStack.pop()!;
                const result = this.applyUnaryOp(operand, frame.op, ctx.currentLine, ctx.currentColumn);
                ctx.valueStack.push(result);
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "CallArgs": {
                const argValue = ctx.valueStack.pop()!;
                frame.args.push(argValue);

                if (frame.index + 1 < frame.totalArgs) {
                    frame.index++;
                    ctx.frameStack.push(frame);
                    if (frame.argNodes[frame.index]) {
                        ctx.currentNode = frame.argNodes[frame.index];
                    }
                    return { kind: "continue", ctx };
                } else {
                    ctx.pendingArgNodes = frame.argNodes;
                    return this.makeHostCall(ctx, frame.callee, frame.namespace, frame.args);
                }
            }

            case "ArrayAccessIndex": {
                const indexValue = ctx.valueStack.pop()!;
                const idx = ensureIndices([indexValue], frame.line, frame.column)[0];
                frame.indices.push(idx);

                if (frame.index + 1 < frame.totalIndices) {
                    frame.index++;
                    ctx.frameStack.push(frame);
                    // Use stored indexNodes to get the next index expression
                    if (frame.indexNodes[frame.index]) {
                        ctx.currentNode = frame.indexNodes[frame.index];
                    }
                    return { kind: "continue", ctx };
                } else {
                    const arrayNode = frame.array;
                    if (isIdentifierNode(arrayNode)) {
                        const atom = this.currentEnv(ctx).getAtom(arrayNode.name);
                        const arrayAddress = atom.getAddress();
                        return this.readArrayElement(ctx, arrayAddress, frame.indices);
                    } else {
                        const parentAddress = this.resolveTargetAddress(arrayNode, ctx);
                        return this.readArrayElement(ctx, parentAddress, frame.indices);
                    }
                }
            }

            case "MemberAccess": {
                const objAddress = ctx.valueStack.pop()!;
                if (typeof objAddress !== "number") {
                    throw new RuntimeError("Member access on non-object value", frame.line, frame.column);
                }
                this.checkFieldVisibility(objAddress, frame.field, frame.line, frame.column);
                const fieldAddr = this.deps.heap.readFieldAddressUnsafe(objAddress, frame.field);
                const fieldValue = this.deps.heap.readUnsafe(fieldAddr);
                // If the field is a record/object, return its address for chained access
                if (typeof fieldValue.type === "object" &&
                    fieldValue.type !== null &&
                    "fields" in fieldValue.type) {
                    ctx.valueStack.push(fieldAddr);
                } else {
                    ctx.valueStack.push(fieldValue.value);
                }
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "NewExpressionArgs": {
                const argValue = ctx.valueStack.pop()!;
                frame.args.push(argValue);

                if (frame.index + 1 < frame.totalArgs) {
                    frame.index++;
                    ctx.frameStack.push(frame);
                    if (frame.argNodes[frame.index]) {
                        ctx.currentNode = frame.argNodes[frame.index];
                    }
                    return { kind: "continue", ctx };
                } else {
                    return this.createNewObject(ctx, frame.className, frame.args);
                }
            }

            case "TypeCast": {
                const value = ctx.valueStack.pop()!;
                ctx.valueStack.push(this.performTypeCast(value, frame.targetType, frame.line, frame.column));
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "SetLiteralElements": {
                const elementValue = ctx.valueStack.pop()!;
                frame.collected.push(elementValue);

                if (frame.index + 1 < frame.elements.length) {
                    frame.index++;
                    ctx.frameStack.push(frame);
                    ctx.currentNode = frame.elements[frame.index];
                    return { kind: "continue", ctx };
                } else {
                    ctx.valueStack.push(new Set(frame.collected));
                    ctx.currentNode = null;
                    return { kind: "continue", ctx };
                }
            }

            case "PointerDereference": {
                const ptrValue = ctx.valueStack.pop()!;
                if (typeof ptrValue !== "number") {
                    throw new RuntimeError("Cannot dereference non-pointer", ctx.currentLine, ctx.currentColumn);
                }
                if (ptrValue === NULL_POINTER) {
                    throw new RuntimeError("Null pointer dereference", ctx.currentLine, ctx.currentColumn);
                }
                const pointedObj = this.deps.heap.readUnsafe(ptrValue);
                // If pointing to a record/object, return the address for member access
                if (typeof pointedObj.type === "object" &&
                    pointedObj.type !== null &&
                    ("fields" in pointedObj.type || "kind" in pointedObj.type)) {
                    ctx.valueStack.push(ptrValue);
                } else {
                    ctx.valueStack.push(pointedObj.value);
                }
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "AddressOf": {
                const address = this.resolveTargetAddress(frame.target, ctx);
                ctx.valueStack.push(address);
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "AssignmentValue": {
                const value = ctx.valueStack.pop()!;
                this.performAssignment(frame.target, value, ctx);
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "VariableDeclarationValue": {
                const initialValue = ctx.valueStack.pop();
                this.performVariableDeclaration(ctx, frame.node, initialValue);
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "ReturnValue": {
                const value = ctx.valueStack.pop();
                ctx.shouldReturn = true;
                ctx.returnValue = value;
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "InputPrompt": {
                const inputValue = ctx.valueStack.pop() as string;
                const node = frame.node;
                let targetName = "";
                if (node.target.type === "Identifier") {
                    targetName = node.target.name;
                } else {
                    throw new RuntimeError("Invalid input target", node.line, node.column);
                }

                const targetType = this.currentEnv(ctx).getType(targetName);
                const value = this.convertInput(
                    inputValue,
                    ensurePseudocodeType(targetType, node.line, node.column),
                );

                this.currentEnv(ctx).assign(targetName, value);
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "ForStart": {
                const startValue = ensureNumber(ctx.valueStack.pop(), frame.node.line, frame.node.column);
                ctx.frameStack.push({
                    kind: "ForEnd",
                    node: frame.node,
                    startValue,
                });
                ctx.currentNode = frame.node.end;
                return { kind: "continue", ctx };
            }

            case "ForEnd": {
                const endValue = ensureNumber(ctx.valueStack.pop(), frame.node.line, frame.node.column);
                if (frame.node.step) {
                    ctx.frameStack.push({
                        kind: "ForStep",
                        node: frame.node,
                        startValue: frame.startValue,
                        endValue,
                    });
                    ctx.currentNode = frame.node.step;
                } else {
                    // No step, use default 1
                    const stepValue = 1;
                    const env = this.currentEnv(ctx);
                    if (!env.has(frame.node.variable)) {
                        env.define(frame.node.variable, PseudocodeType.INTEGER, frame.startValue);
                    } else {
                        env.assign(frame.node.variable, frame.startValue);
                    }
                    return this.evalForCondition(ctx, frame.node, frame.startValue, endValue, stepValue);
                }
                return { kind: "continue", ctx };
            }

            case "ForStep": {
                const stepValue = ensureNumber(ctx.valueStack.pop(), frame.node.line, frame.node.column);
                const env = this.currentEnv(ctx);
                if (!env.has(frame.node.variable)) {
                    env.define(frame.node.variable, PseudocodeType.INTEGER, frame.startValue);
                } else {
                    env.assign(frame.node.variable, frame.startValue);
                }
                return this.evalForCondition(ctx, frame.node, frame.startValue, frame.endValue, stepValue);
            }

            case "ForLoop": {
                // Update loop variable and continue
                const current = ensureNumber(
                    this.currentEnv(ctx).get(frame.node.variable),
                    frame.node.line,
                    frame.node.column,
                );
                this.currentEnv(ctx).assign(frame.node.variable, current + frame.stepValue);
                return this.evalForCondition(ctx, frame.node, frame.startValue, frame.endValue, frame.stepValue);
            }

            case "WhileCondition": {
                const conditionValue = ctx.valueStack.pop();
                if (!this.isTruthy(conditionValue)) {
                    ctx.currentNode = null;
                    return { kind: "continue", ctx };
                }
                // Execute body and then check condition again
                ctx.frameStack.push({
                    kind: "WhileLoop",
                    node: frame.node,
                });
                if (frame.node.body.length > 0) {
                    ctx.frameStack.push({
                        kind: "SeqStatement",
                        statements: frame.node.body,
                        index: 0,
                    });
                    ctx.currentNode = frame.node.body[0];
                } else {
                    // No body, go directly to WhileLoop
                    ctx.currentNode = null;
                }
                return { kind: "continue", ctx };
            }

            case "WhileLoop": {
                // After body execution, check condition again
                ctx.frameStack.push({
                    kind: "WhileCondition",
                    node: frame.node,
                });
                ctx.currentNode = frame.node.condition;
                return { kind: "continue", ctx };
            }

            case "RepeatCondition": {
                // First, evaluate the condition
                ctx.frameStack.push({
                    kind: "RepeatCheck",
                    node: frame.node,
                });
                ctx.currentNode = frame.node.condition;
                return { kind: "continue", ctx };
            }

            case "RepeatCheck": {
                const conditionValue = ctx.valueStack.pop();
                if (this.isTruthy(conditionValue)) {
                    // Condition true, exit loop
                    ctx.currentNode = null;
                    return { kind: "continue", ctx };
                }
                // Condition false, execute body again
                ctx.frameStack.push({
                    kind: "RepeatCondition",
                    node: frame.node,
                });
                if (frame.node.body.length > 0) {
                    ctx.frameStack.push({
                        kind: "SeqStatement",
                        statements: frame.node.body,
                        index: 0,
                    });
                    ctx.currentNode = frame.node.body[0];
                } else {
                    // No body, go directly to RepeatCondition
                    ctx.currentNode = null;
                }
                return { kind: "continue", ctx };
            }

            case "RepeatLoop": {
                // This case is no longer used, but keep for compatibility
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "RepeatBody": {
                // Body executed, now check condition
                ctx.frameStack.push({
                    kind: "RepeatCondition",
                    node: frame.node,
                });
                ctx.currentNode = frame.node.condition;
                return { kind: "continue", ctx };
            }

            case "OutputExpression": {
                const value = ctx.valueStack.pop()!;
                frame.values.push(String(value));

                if (frame.index + 1 < frame.node.expressions.length) {
                    frame.index++;
                    ctx.frameStack.push(frame);
                    ctx.currentNode = frame.node.expressions[frame.index];
                    return { kind: "continue", ctx };
                } else {
                    return {
                        kind: "syscall",
                        call: { type: "io_output", data: frame.values.join("") + "\n" },
                        ctx: { ...ctx, currentNode: null },
                    };
                }
            }

            case "IfCondition": {
                const conditionValue = ctx.valueStack.pop();
                const node = frame.node;
                if (this.isTruthy(conditionValue)) {
                    if (node.thenBranch.length > 0) {
                        ctx.frameStack.push({
                            kind: "SeqStatement",
                            statements: node.thenBranch,
                            index: 0,
                        });
                        ctx.currentNode = node.thenBranch[0];
                    } else {
                        ctx.currentNode = null;
                    }
                    return { kind: "continue", ctx };
                } else if (node.elseBranch && node.elseBranch.length > 0) {
                    ctx.frameStack.push({
                        kind: "SeqStatement",
                        statements: node.elseBranch,
                        index: 0,
                    });
                    ctx.currentNode = node.elseBranch[0];
                    return { kind: "continue", ctx };
                } else {
                    ctx.currentNode = null;
                    return { kind: "continue", ctx };
                }
            }

            case "SeqStatement": {
                // This frame was pushed before executing statements[frame.index]
                // After statements[frame.index] completes, we end up here
                // Check if we should return early (from RETURN statement)
                if (ctx.shouldReturn) {
                    ctx.currentNode = null;
                    return { kind: "continue", ctx };
                }
                // Now move to the next statement if available
                const nextIndex = frame.index + 1;
                if (nextIndex < frame.statements.length) {
                    ctx.frameStack.push({
                        ...frame,
                        index: nextIndex,
                    });
                    ctx.currentNode = frame.statements[nextIndex];
                    return { kind: "continue", ctx };
                }
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            case "ReturnFromCall": {
                // Restore return value
                const returnValue = ctx.shouldReturn ? ctx.returnValue : undefined;

                // Restore environment stack (pop routine environment)
                ctx.envStack.pop();

                // Pop call stack
                ctx.callStack.pop();

                // Dispose routine environment
                frame.routineEnv.disposeScope();

                // Restore context state
                ctx.valueStack = [...frame.savedContext.valueStack, returnValue];
                ctx.frameStack = [...frame.savedContext.frameStack];
                ctx.callStack = [...frame.savedContext.callStack];
                // currentNode should be null since the call statement has completed
                ctx.currentNode = null;
                ctx.currentLine = frame.savedContext.currentLine;
                ctx.currentColumn = frame.savedContext.currentColumn;
                ctx.shouldReturn = frame.savedContext.shouldReturn;
                ctx.returnValue = frame.savedContext.returnValue;

                return { kind: "continue", ctx };
            }

            default:
                throw new RuntimeError(`Unknown frame kind: ${(frame as { kind: string }).kind}`);
        }
    }

    private evalSync(node: ASTNode, ctx: FrameContext): unknown {
        const tempCtx: FrameContext = {
            ...ctx,
            valueStack: [],
            frameStack: [],
            currentNode: node,
        };

        let result = this.evalNode(tempCtx, node);
        while (result.kind === "continue") {
            if (tempCtx.currentNode) {
                result = this.evalNode(tempCtx, tempCtx.currentNode);
            } else if (tempCtx.frameStack.length > 0) {
                result = this.resumeFrame(tempCtx);
            } else {
                break;
            }
        }

        if (result.kind === "syscall") {
            throw new RuntimeError("Sync evaluation encountered syscall");
        }

        return tempCtx.valueStack.length > 0 ? tempCtx.valueStack.pop() : undefined;
    }

    private evalStatementSeq(ctx: FrameContext, statements: StatementNode[]): FrameResult {
        if (statements.length === 0) {
            ctx.currentNode = null;
            return { kind: "continue", ctx };
        }

        ctx.frameStack.push({
            kind: "SeqStatement",
            statements,
            index: 0,
        });
        ctx.currentNode = statements[0];
        return { kind: "continue", ctx };
    }

    private evalForLoop(ctx: FrameContext, node: ForNode, increment: boolean, step: number, end: number): FrameResult {
        const currentValue = ensureNumber(
            this.currentEnv(ctx).get(node.variable),
            node.line,
            node.column,
        );

        const shouldContinue = increment ? currentValue <= end : currentValue >= end;

        if (!shouldContinue) {
            ctx.currentNode = null;
            return { kind: "continue", ctx };
        }

        return this.evalStatementSeqWithAfter(
            ctx,
            node.body,
            () => {
                const current = ensureNumber(
                    this.currentEnv(ctx).get(node.variable),
                    node.line,
                    node.column,
                );
                this.currentEnv(ctx).assign(node.variable, current + step);
                return this.evalForLoop(ctx, node, increment, step, end);
            },
        );
    }

    private evalWhileLoop(ctx: FrameContext, node: WhileNode): FrameResult {
        const condition = this.evalSync(node.condition, ctx);
        if (!this.isTruthy(condition)) {
            ctx.currentNode = null;
            return { kind: "continue", ctx };
        }

        return this.evalStatementSeqWithAfter(
            ctx,
            node.body,
            () => this.evalWhileLoop(ctx, node),
        );
    }

    private evalRepeatLoop(ctx: FrameContext, node: RepeatNode, firstIteration: boolean): FrameResult {
        if (!firstIteration) {
            const condition = this.evalSync(node.condition, ctx);
            if (this.isTruthy(condition)) {
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }
        }

        return this.evalStatementSeqWithAfter(
            ctx,
            node.body,
            () => this.evalRepeatLoop(ctx, node, false),
        );
    }

    private evalStatementSeqWithAfter(
        ctx: FrameContext,
        statements: StatementNode[],
        after: () => FrameResult,
    ): FrameResult {
        if (statements.length === 0) {
            return after();
        }

        const savedFrameStack = [...ctx.frameStack];
        const savedValueStack = [...ctx.valueStack];

        const runSeq = (index: number): FrameResult => {
            if (index >= statements.length) {
                ctx.frameStack = savedFrameStack;
                ctx.valueStack = savedValueStack;
                return after();
            }

            ctx.currentNode = statements[index];
            let result = this.evalNode(ctx, statements[index]);

            // Handle async execution within the statement (e.g., Assignment, Call)
            while (result.kind === "continue") {
                if (result.ctx.currentNode) {
                    result = this.evalNode(result.ctx, result.ctx.currentNode);
                } else if (result.ctx.frameStack.length > 0) {
                    result = this.resumeFrame(result.ctx);
                } else {
                    break;
                }
            }

            if (result.kind === "continue") {
                // Update ctx to the result context for the next iteration
                ctx = result.ctx;
                return runSeq(index + 1);
            }

            if (result.kind === "syscall") {
                return {
                    ...result,
                    ctx: {
                        ...result.ctx,
                        frameStack: [...savedFrameStack],
                        valueStack: [...savedValueStack],
                    },
                };
            }

            return result;
        };

        return runSeq(0);
    }

    private makeHostCall(ctx: FrameContext, callee: string, namespace: string | undefined, args: unknown[]): FrameResult {
        if (namespace) {
            const methodResult = this.tryObjectMethodCall(ctx, namespace, callee, args);
            if (methodResult.handled) {
                ctx.valueStack.push(methodResult.value);
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }

            const nsInfo = this.deps.namespaceImports.get(namespace);
            if (!nsInfo) {
                throw new RuntimeError(`Unknown namespace '${namespace}'`, ctx.currentLine, ctx.currentColumn);
            }
            if (!nsInfo.exportedNames.includes(callee)) {
                throw new RuntimeError(
                    `'${callee}' is not exported from '${namespace}'`,
                    ctx.currentLine,
                    ctx.currentColumn,
                );
            }
        } else if (this.currentEnv(ctx).has("SELF")) {
            const selfMethodResult = this.tryObjectMethodCall(ctx, "SELF", callee, args);
            if (selfMethodResult.handled) {
                ctx.valueStack.push(selfMethodResult.value);
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }
        }

        if (callee === "EOF") {
            if (args.length !== 1) {
                throw new RuntimeError("EOF expects exactly one argument", ctx.currentLine, ctx.currentColumn);
            }
            const fileId = args[0];
            if (typeof fileId !== "string") {
                throw new RuntimeError("EOF expects a string file identifier", ctx.currentLine, ctx.currentColumn);
            }
            return {
                kind: "syscall",
                call: {
                    type: "file_op",
                    operation: {
                        type: "eof",
                        fileIdentifier: fileId as string,
                        target: (isEof) => {
                            ctx.valueStack.push(isEof);
                        },
                        line: ctx.currentLine,
                        column: ctx.currentColumn,
                    },
                },
                ctx: { ...ctx, currentNode: null },
            };
        }

        if (this.deps.strictMode && EXTENDED_BUILTIN_NAMES.has(callee)) {
            throw new RuntimeError(
                `'${callee}' is not a CAIE standard function (CAIE_ONLY mode is enabled)`,
                ctx.currentLine,
                ctx.currentColumn,
            );
        }

        if (callee === "TYPEOF") {
            ctx.valueStack.push(this.evaluateTypeof(ctx, args));
            ctx.currentNode = null;
            return { kind: "continue", ctx };
        }

        if (this.deps.globalRoutines.has(callee)) {
            const routineInfo = this.deps.globalRoutines.get(callee)!;

            if (routineInfo.isBuiltIn && routineInfo.implementation) {
                ctx.valueStack.push(routineInfo.implementation(...args));
                ctx.currentNode = null;
                return { kind: "continue", ctx };
            }
        }

        const env = this.currentEnv(ctx);
        if (!env.hasRoutine(callee)) {
            throw new RuntimeError(`Undefined routine '${callee}'`, ctx.currentLine, ctx.currentColumn);
        }

        const signature = env.getRoutine(callee);

        return this.executeRoutineCall(ctx, callee, signature, args);
    }

    private executeRoutineCall(
        ctx: FrameContext,
        routineName: string,
        signature: { name: string; parameters: ParameterInfo[]; returnType?: TypeInfo },
        args: unknown[],
    ): FrameResult {
        const routineEnvironment = this.currentEnv(ctx).createChild();

        for (let i = 0; i < signature.parameters.length; i++) {
            const param = signature.parameters[i];
            const resolvedParamType = this.resolveType(param.type, ctx.currentLine, ctx.currentColumn);

            if (param.mode === ParameterMode.BY_REFERENCE) {
                const argNode = this.findArgNodeForParam(ctx, routineName, i);
                if (!argNode) {
                    throw new RuntimeError(
                        `BYREF parameter '${param.name}' requires an argument`,
                        ctx.currentLine,
                        ctx.currentColumn,
                    );
                }

                if (isIdentifierNode(argNode)) {
                    const callerAtom = this.currentEnv(ctx).getAtom(argNode.name);
                    routineEnvironment.defineByRef(param.name, resolvedParamType, callerAtom.getAddress());
                } else if (isArrayAccessNode(argNode) || isMemberAccessNode(argNode)) {
                    const address = this.resolveTargetAddress(argNode, ctx);
                    routineEnvironment.defineByRef(param.name, resolvedParamType, address);
                } else {
                    throw new RuntimeError(
                        `BYREF parameter '${param.name}' requires a variable, array element, or record field argument`,
                        ctx.currentLine,
                        ctx.currentColumn,
                    );
                }
            } else {
                const arg = args[i] ?? this.getDefaultValue(resolvedParamType, ctx.currentLine, ctx.currentColumn);
                const fromHeap =
                    typeof resolvedParamType === "object" &&
                    resolvedParamType !== null &&
                    ("elementType" in resolvedParamType || "fields" in resolvedParamType);
                routineEnvironment.define(param.name, resolvedParamType, arg, false, fromHeap);
            }
        }

        const savedEnv = this.currentEnv(ctx);
        const savedContext: Omit<FrameContext, "envStack"> = {
            valueStack: [...ctx.valueStack],
            frameStack: [...ctx.frameStack],
            callStack: [...ctx.callStack],
            currentNode: ctx.currentNode,
            currentLine: ctx.currentLine,
            currentColumn: ctx.currentColumn,
            shouldReturn: ctx.shouldReturn,
            returnValue: ctx.returnValue,
        };

        ctx.callStack.push({
            routineName,
            environment: savedEnv,
            returnAddress: ctx.currentLine !== undefined && ctx.currentColumn !== undefined
                ? { line: ctx.currentLine, column: ctx.currentColumn }
                : undefined,
        });

        ctx.envStack.push(routineEnvironment);
        ctx.shouldReturn = false;
        ctx.returnValue = undefined;

        const routineInfo = this.deps.globalRoutines.get(routineName);
        const bodyStatements = extractRoutineBody(routineInfo?.node);

        if (bodyStatements.length === 0) {
            ctx.envStack.pop();
            ctx.callStack.pop();
            routineEnvironment.disposeScope();
            ctx.valueStack.push(undefined);
            ctx.currentNode = null;
            return { kind: "continue", ctx };
        }

        // Push ReturnFromCall frame to handle cleanup after body execution
        ctx.frameStack.push({
            kind: "ReturnFromCall",
            savedEnv,
            savedContext,
            routineEnv: routineEnvironment,
        });

        // Push SeqStatement frame to execute body
        ctx.frameStack.push({
            kind: "SeqStatement",
            statements: bodyStatements,
            index: 0,
        });

        ctx.currentNode = bodyStatements[0];
        return { kind: "continue", ctx };
    }

    private createNewObject(ctx: FrameContext, className: string, args: unknown[]): FrameResult {
        const classDef = this.deps.classDefinitions.get(className);
        if (!classDef) {
            throw new RuntimeError(`Unknown class '${className}'`, ctx.currentLine, ctx.currentColumn);
        }

        const fullClassDef = this.resolveFullClassDefinition(className);
        if (!fullClassDef) {
            throw new RuntimeError(`Cannot resolve class '${className}'`, ctx.currentLine, ctx.currentColumn);
        }

        const defaultValue = this.buildDefaultObjectValue(fullClassDef);
        const address = this.deps.heap.allocate(defaultValue, fullClassDef);

        const routineEnvironment = this.currentEnv(ctx).createChild();
        routineEnvironment.define("SELF", PseudocodeType.INTEGER, address, true);

        this.bindObjectFieldsToEnvironment(address, fullClassDef, routineEnvironment);

        const constructor = fullClassDef.methods["NEW"];
        if (constructor) {
            for (let i = 0; i < constructor.parameters.length; i++) {
                const param = constructor.parameters[i];
                const arg = args[i] ?? this.getDefaultValue(param.type, ctx.currentLine, ctx.currentColumn);
                routineEnvironment.define(param.name, param.type, arg, false);
            }

            ctx.envStack = [...ctx.envStack, routineEnvironment];

            const methodBody = this.findMethodBody(className, "NEW");
            if (methodBody && methodBody.body) {
                for (const statement of methodBody.body) {
                    this.evalStatementSync(statement, ctx);
                }
                ctx.envStack = ctx.envStack.slice(0, -1);
                routineEnvironment.disposeScope();
            }
        }

        ctx.valueStack.push(address);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private applyOp(left: unknown, right: unknown, op: string, line?: number, column?: number): unknown {
        switch (op) {
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
                    throw new RuntimeError("Right operand of IN must be a SET", line, column);
                }
                return (right as Set<unknown>).has(left);

            default:
                throw new RuntimeError(`Unknown binary operator: ${op}`, line, column);
        }
    }

    private applyUnaryOp(operand: unknown, op: string, line?: number, column?: number): unknown {
        switch (op) {
            case "-":
                return -Number(operand);

            case "NOT":
                return !this.isTruthy(operand);

            default:
                throw new RuntimeError(`Unknown unary operator: ${op}`, line, column);
        }
    }

    private isTruthy(value: unknown): boolean {
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "number") {
            return value !== 0;
        }
        if (typeof value === "string") {
            return value.length > 0;
        }
        return value !== null && value !== undefined;
    }

    private isEqual(left: unknown, right: unknown): boolean {
        if (left === right) {
            return true;
        }
        if (typeof left === "number" && typeof right === "number") {
            return left === right;
        }
        if (typeof left === "string" && typeof right === "string") {
            return left === right;
        }
        if (typeof left === "boolean" && typeof right === "boolean") {
            return left === right;
        }
        return false;
    }

    private resolveTargetAddress(node: ExpressionNode, ctx: FrameContext): number {
        if (isIdentifierNode(node)) {
            const atom = this.currentEnv(ctx).getAtom(node.name);
            const varType = this.currentEnv(ctx).getType(node.name);
            // For pointer types, return the pointer value (address pointed to), not the variable address
            if (typeof varType === "object" && varType !== null && "kind" in varType && varType.kind === "POINTER") {
                const ptrValue = atom.getValue(this.deps.heap);
                if (typeof ptrValue !== "number") {
                    throw new RuntimeError("Cannot dereference non-pointer", node.line, node.column);
                }
                return ptrValue;
            }
            return atom.getAddress();
        }

        if (isArrayAccessNode(node)) {
            const arrayAtom = this.resolveArrayRootAtom(node, ctx);
            const arrayAddress = arrayAtom.getAddress();
            const indices = this.collectArrayIndices(node, ctx);
            let currentAddress = arrayAddress;
            for (const idx of indices) {
                currentAddress = this.deps.heap.readElementAddressUnsafe(currentAddress, idx);
            }
            return currentAddress;
        }

        if (isMemberAccessNode(node)) {
            const parentAddress = this.resolveMemberAccessAddress(node, ctx);
            return this.deps.heap.readFieldAddressUnsafe(parentAddress, node.field);
        }

        if (isPointerDereferenceNode(node)) {
            const ptrValue = this.evalSync(node.pointer, ctx);
            if (typeof ptrValue !== "number") {
                throw new RuntimeError("Cannot dereference non-pointer", node.line, node.column);
            }
            return ptrValue;
        }

        throw new RuntimeError("Cannot resolve target address", node.line, node.column);
    }

    private resolveArrayRootAtom(node: ArrayAccessNode, ctx: FrameContext): VariableAtom {
        if (isIdentifierNode(node.array)) {
            return this.currentEnv(ctx).getAtom(node.array.name);
        }
        if (isArrayAccessNode(node.array)) {
            return this.resolveArrayRootAtom(node.array, ctx);
        }
        throw new RuntimeError("Cannot resolve array root", node.line, node.column);
    }

    private collectArrayIndices(node: ArrayAccessNode, ctx: FrameContext): number[] {
        const indices: number[] = [];
        let current: ArrayAccessNode = node;
        while (true) {
            const idxValue = this.evalSync(current.indices[current.indices.length - 1], ctx);
            indices.unshift(ensureIndices([idxValue], node.line, node.column)[0]);
            if (current.indices.length > 1) {
                for (let i = 0; i < current.indices.length - 1; i++) {
                    const idxVal = this.evalSync(current.indices[i], ctx);
                    indices.unshift(ensureIndices([idxVal], node.line, node.column)[0]);
                }
            }
            break;
        }
        return indices;
    }

    private resolveMemberAccessAddress(node: MemberAccessNode, ctx: FrameContext): number {
        if (isIdentifierNode(node.object)) {
            const atom = this.currentEnv(ctx).getAtom(node.object.name);
            const varType = this.currentEnv(ctx).getType(node.object.name);
            // For CLASS types, the value stored is the heap address of the object
            if (typeof varType === "object" && varType !== null && "kind" in varType && varType.kind === "CLASS") {
                return atom.getValue(this.deps.heap) as number;
            }
            return atom.getAddress();
        }
        if (isMemberAccessNode(node.object)) {
            // For nested member access like obj.Inner.Value
            // First get the parent record address (obj.Inner)
            const parentAddress = this.resolveMemberAccessAddress(node.object, ctx);
            // Then get the field address (Inner) from the parent record
            return this.deps.heap.readFieldAddressUnsafe(parentAddress, node.object.field);
        }
        if (isArrayAccessNode(node.object)) {
            return this.resolveTargetAddress(node.object, ctx);
        }
        if (isPointerDereferenceNode(node.object)) {
            // p^.field - evaluate the pointer to get the record address
            const ptrValue = this.evalSync(node.object.pointer, ctx);
            if (typeof ptrValue !== "number") {
                throw new RuntimeError("Cannot dereference non-pointer", node.line, node.column);
            }
            return ptrValue;
        }
        throw new RuntimeError("Cannot resolve member access address", node.line, node.column);
    }

    private performAssignment(node: AssignmentNode, value: unknown, ctx: FrameContext): void {
        if (isIdentifierNode(node.target)) {
            const varType = this.currentEnv(ctx).getType(node.target.name);
            let finalValue = value;
            // Validate enum assignment
            if (typeof varType === "object" && varType !== null && "kind" in varType && varType.kind === "ENUM") {
                const enumType = varType as EnumTypeInfo;
                if (typeof value === "string" && !enumType.values.includes(value)) {
                    throw new RuntimeError(
                        `Expected enum '${enumType.name}' value`,
                        node.line,
                        node.column,
                    );
                }
            }
            if (typeof varType === "object" && varType !== null && "fields" in varType) {
                // For user-defined record types, read the heap value
                // For CLASS types, keep the heap address
                const isClassType = "kind" in varType && varType.kind === "CLASS";
                if (!isClassType && typeof value === "number") {
                    const srcObj = this.deps.heap.readUnsafe(value);
                    finalValue = srcObj.value;
                }
            }
            this.currentEnv(ctx).assign(node.target.name, finalValue);
        } else if (isArrayAccessNode(node.target)) {
            const address = this.resolveTargetAddress(node.target, ctx);

            let elementType: TypeInfo = PseudocodeType.INTEGER;
            if (isIdentifierNode(node.target.array)) {
                const typeInfo = this.currentEnv(ctx).getType(node.target.array.name);
                if (
                    typeof typeInfo === "object" &&
                    typeInfo !== null &&
                    "elementType" in typeInfo
                ) {
                    elementType = this.resolveArrayElementType(typeInfo, node.target.indices.length);
                }
            }

            VariableAtomFactory.validateValue(elementType, value);
            this.deps.heap.writeUnsafe(address, value, elementType);
        } else if (isMemberAccessNode(node.target)) {
            const memberAccess = node.target;
            const parentAddress = this.resolveMemberAccessAddress(memberAccess, ctx);
            this.checkFieldVisibility(parentAddress, memberAccess.field, node.line, node.column);
            const fieldAddr = this.deps.heap.readFieldAddressUnsafe(parentAddress, memberAccess.field);
            const fieldObj = this.deps.heap.readUnsafe(fieldAddr);
            VariableAtomFactory.validateValue(fieldObj.type, value);
            this.deps.heap.writeUnsafe(fieldAddr, value, fieldObj.type);
        } else if (isPointerDereferenceNode(node.target)) {
            // p^ <- value or ptrs[i]^ <- value
            const ptrValue = this.evalSync(node.target.pointer, ctx);
            if (typeof ptrValue !== "number") {
                throw new RuntimeError("Cannot dereference non-pointer", node.line, node.column);
            }
            const pointedObj = this.deps.heap.readUnsafe(ptrValue);
            VariableAtomFactory.validateValue(pointedObj.type, value);
            this.deps.heap.writeUnsafe(ptrValue, value, pointedObj.type);
        } else {
            throw new RuntimeError("Invalid assignment target", node.line, node.column);
        }
    }

    private performVariableDeclaration(ctx: FrameContext, node: VariableDeclarationNode, initialValue: unknown | undefined): FrameResult {
        const resolvedType = this.resolveType(node.dataType, node.line, node.column);
        let finalValue: unknown;
        if (initialValue !== undefined) {
            finalValue = initialValue;
        } else if (
            typeof resolvedType === "object" &&
            resolvedType !== null &&
            "elementType" in resolvedType &&
            "bounds" in resolvedType
        ) {
            finalValue = this.allocateArray(ctx, resolvedType as ArrayTypeInfo);
        } else {
            finalValue = this.getDefaultValue(resolvedType, node.line, node.column);
        }

        this.currentEnv(ctx).define(node.name, resolvedType, finalValue, node.isConstant);
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private assignToTarget(target: ExpressionNode, content: string, ctx: FrameContext): void {
        if (isIdentifierNode(target)) {
            this.currentEnv(ctx).assign(target.name, content);
        } else {
            throw new RuntimeError("Invalid read file target", target.line, target.column);
        }
    }

    private deserializeRecord(data: string, target: ExpressionNode, ctx: FrameContext): void {
        const currentValue = this.evalSync(target, ctx);
        if (!isRecord(currentValue)) {
            throw new RuntimeError(
                "GETRECORD target must be a user-defined type variable",
                target.line,
                target.column,
            );
        }
        const parsed = parseRecordDataHelper(data);
        reconstructRecordHelper(parsed, currentValue, this.deps.heap);
    }

    private serializeRecord(value: unknown): string {
        return serializeRecordHelper(value, this.deps.heap);
    }

    private convertInput(input: string, type: PseudocodeType): unknown {
        switch (type) {
            case PseudocodeType.INTEGER:
                return parseInt(input, 10);
            case PseudocodeType.REAL:
                return parseFloat(input);
            case PseudocodeType.BOOLEAN:
                return input.toLowerCase() === "true";
            case PseudocodeType.CHAR:
                return input.charAt(0);
            case PseudocodeType.STRING:
            default:
                return input;
        }
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

    private resolveType(type: TypeInfo, line?: number, column?: number, resolving: Set<string> = new Set()): TypeInfo {
        return resolveTypeHelper(
            type,
            this.deps.userDefinedTypes,
            this.deps.enumTypes,
            this.deps.setTypes,
            this.deps.pointerTypes,
            this.deps.classDefinitions,
            line,
            column,
            resolving,
        );
    }

    private resolveFullClassDefinition(className: string): ClassTypeInfo | undefined {
        return resolveFullClassDefinitionHelper(
            className,
            this.deps.classDefinitions,
            this.deps.resolvedClassCache,
        );
    }

    private findMethodBody(className: string, methodName: string): RuntimeMethodInfo | undefined {
        return findMethodInHierarchy(
            className,
            methodName,
            this.deps.classMethodBodies,
            this.deps.classDefinitions,
        );
    }

    private getDefaultValue(type: TypeInfo, line?: number, column?: number): unknown {
        return getDefaultValueHelper(type);
    }

    private resolveArrayElementType(arrayType: TypeInfo, indexCount: number): TypeInfo {
        return resolveArrayElementTypeHelper(arrayType, indexCount);
    }

    private readArrayElement(ctx: FrameContext, arrayAddress: number, indices: number[]): FrameResult {
        if (indices.length === 0) {
            throw new RuntimeError("Array access requires at least one index");
        }

        let currentAddress = arrayAddress;
        for (let i = 0; i < indices.length - 1; i++) {
            currentAddress = this.deps.heap.readElementAddressUnsafe(currentAddress, indices[i]);
        }

        const elemAddr = this.deps.heap.readElementAddressUnsafe(currentAddress, indices[indices.length - 1]);
        const elemValue = this.deps.heap.readUnsafe(elemAddr);
        // If element is a record/object, return its address for chained access
        if (typeof elemValue.type === "object" &&
            elemValue.type !== null &&
            "fields" in elemValue.type) {
            ctx.valueStack.push(elemAddr);
        } else {
            ctx.valueStack.push(elemValue.value);
        }
        ctx.currentNode = null;
        return { kind: "continue", ctx };
    }

    private tryObjectMethodCall(
        ctx: FrameContext,
        namespace: string,
        methodName: string,
        args: unknown[],
    ): { handled: boolean; value?: unknown } {
        if (!this.currentEnv(ctx).has(namespace)) {
            return { handled: false };
        }

        const objValue = this.currentEnv(ctx).get(namespace);
        if (typeof objValue !== "number") {
            return { handled: false };
        }

        let objType: TypeInfo;
        try {
            objType = this.deps.heap.readUnsafe(objValue).type;
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

        const method = fullClassDef.methods[methodName];
        if (!method) {
            throw new RuntimeError(
                `Method '${methodName}' not found on class '${className}'`,
                ctx.currentLine,
                ctx.currentColumn,
            );
        }

        const selfAddress = objValue;
        const routineEnvironment = this.currentEnv(ctx).createChild();
        routineEnvironment.define("SELF", PseudocodeType.INTEGER, selfAddress, true);

        this.bindObjectFieldsToEnvironment(selfAddress, fullClassDef, routineEnvironment);

        for (let i = 0; i < method.parameters.length; i++) {
            const param = method.parameters[i];
            const arg = args[i] ?? undefined;
            routineEnvironment.define(param.name, param.type, arg, false);
        }

        const savedEnv = this.currentEnv(ctx);

        ctx.envStack = [...ctx.envStack, routineEnvironment];

        let result: unknown = undefined;

        const methodBody = this.findMethodBody(className, methodName);
        if (methodBody && methodBody.body) {
            for (const statement of methodBody.body) {
                this.evalStatementSync(statement, ctx);
                if (ctx.shouldReturn) {
                    result = ctx.returnValue;
                    break;
                }
            }
        }

        ctx.envStack = ctx.envStack.slice(0, -1);
        routineEnvironment.disposeScope();

        // Reset shouldReturn so it doesn't affect subsequent method calls
        ctx.shouldReturn = false;
        ctx.returnValue = undefined;

        return { handled: true, value: result };
    }

    private evalStatementSync(statement: StatementNode, ctx: FrameContext): void {
        this.deps.onStep?.();
        const tempCtx: FrameContext = {
            ...ctx,
            valueStack: [],
            frameStack: [],
            currentNode: statement,
        };
        let result = this.evalNode(tempCtx, statement);
        while (result.kind === "continue") {
            if (tempCtx.currentNode) {
                result = this.evalNode(tempCtx, tempCtx.currentNode);
            } else if (tempCtx.frameStack.length > 0) {
                result = this.resumeFrame(tempCtx);
            } else {
                break;
            }
        }
        // Handle syscall (e.g., Output) by executing it directly
        if (result.kind === "syscall") {
            this.executeSyscall(result.call);
        }
        // Sync state back to parent context
        ctx.shouldReturn = tempCtx.shouldReturn;
        ctx.returnValue = tempCtx.returnValue;
        ctx.envStack = tempCtx.envStack;
    }

    private executeSyscall(call: FrameSyscall): void {
        switch (call.type) {
            case "io_output":
                this.deps.io.output(call.data);
                break;
            case "io_input":
                // Input is handled by the trampoline
                break;
            case "host_call":
                // Host calls are handled by the trampoline
                break;
            case "file_op":
                // File operations are handled by the trampoline
                break;
            case "debug_pause":
                // Debug pause is handled by the trampoline
                break;
            default:
                break;
        }
    }

    private evaluateTypeof(ctx: FrameContext, args: unknown[]): string {
        if (args.length === 0) {
            throw new RuntimeError("TYPEOF expects an argument", ctx.currentLine, ctx.currentColumn);
        }

        // Try to get the type from the argument node for accurate type information
        if (ctx.pendingArgNodes && ctx.pendingArgNodes.length > 0) {
            const argNode = ctx.pendingArgNodes[0];
            if (isIdentifierNode(argNode)) {
                try {
                    const varType = this.currentEnv(ctx).getType(argNode.name);
                    return TypeValidator.typeInfoToName(varType);
                } catch {
                    // Fall through to value-based inference
                }
            }
        }

        const value = args[0];
        return TypeValidator.typeInfoToName(this.inferTypeFromValue(value));
    }

    private buildDebugSnapshot(
        reason: DebugPauseReason,
        line?: number,
        column?: number,
        ctx?: FrameContext,
    ): DebugSnapshot {
        const heapSnapshot = new Map<
            number,
            { value: unknown; type: TypeInfo; refCount: number }
        >();
        for (const [addr, obj] of this.deps.heap.getSnapshot().entries()) {
            heapSnapshot.set(addr, { value: obj.value, type: obj.type, refCount: obj.refCount });
        }

        const env = ctx ? this.currentEnv(ctx) : this.deps.environment;
        const scopes = this.deps.debuggerController
            ? env.getDebugScopes().map((scope, index) => ({
                scopeName: index === 0 ? "local" : "global",
                variables: this.deps.debuggerController!.variablesToDebugWithHeap(
                    scope.variables,
                    heapSnapshot,
                ),
            }))
            : [];

        const callStack = ctx
            ? ctx.callStack.map((frame) => ({
                routineName: frame.routineName,
                line: frame.returnAddress?.line,
                column: frame.returnAddress?.column,
            }))
            : [];

        return {
            reason,
            location: { line, column },
            scopes,
            callStack,
            heapSnapshot,
        };
    }

    private bindObjectFieldsToEnvironment(
        address: number,
        classDef: ClassTypeInfo,
        environment: Environment,
    ): void {
        for (const [fieldName, fieldType] of Object.entries(classDef.fields)) {
            const fieldAddr = this.deps.heap.readFieldAddressUnsafe(address, fieldName);
            environment.defineByRef(fieldName, fieldType, fieldAddr);
        }
    }

    private buildDefaultObjectValue(classDef: ClassTypeInfo): Record<string, unknown> {
        const fullClassDef = this.resolveFullClassDefinition(classDef.name);
        const fieldsToUse = fullClassDef?.fields ?? classDef.fields;
        const result: Record<string, unknown> = {};
        for (const [fieldName, fieldType] of Object.entries(fieldsToUse)) {
            result[fieldName] = this.getDefaultValue(fieldType);
        }
        return result;
    }

    private checkFieldVisibility(address: number, field: string, line?: number, column?: number): void {
        const obj = this.deps.heap.readUnsafe(address);
        const classType = obj.type as ClassTypeInfo;
        if (!classType || classType.kind !== "CLASS") {
            return;
        }

        const visibility = classType.fieldVisibility?.[field];
        if (visibility === "PRIVATE") {
            // Check if we're inside a method by looking for SELF in the environment
            const isInMethod = this.isInsideMethod(address);
            if (!isInMethod) {
                throw new RuntimeError(`Cannot access private field '${field}'`, line, column);
            }
        }
    }

    private isInsideMethod(selfAddress: number): boolean {
        try {
            const currentEnv = this.currentEnv({} as FrameContext);
            // Check if SELF is defined in current or parent environment
            let env: Environment | undefined = currentEnv;
            while (env) {
                if (env.has("SELF")) {
                    const selfValue = env.get("SELF");
                    if (selfValue === selfAddress) {
                        return true;
                    }
                }
                env = env.getParent();
            }
            return false;
        } catch {
            return false;
        }
    }

    private performTypeCast(value: unknown, _targetType: TypeInfo, _line?: number, _column?: number): unknown {
        return value;
    }

    private findCallExpressionNode(ctx: FrameContext, callee: string, namespace?: string): CallExpressionNode | null {
        return null;
    }

    private findNewExpressionNode(ctx: FrameContext, className: string): NewExpressionNode | null {
        return null;
    }

    private findArgNodeForParam(ctx: FrameContext, routineName: string, paramIndex: number): ExpressionNode | null {
        for (let i = ctx.frameStack.length - 1; i >= 0; i--) {
            const frame = ctx.frameStack[i];
            if (frame.kind === "CallArgs" && (frame as any).callee === routineName && paramIndex < (frame as any).totalArgs) {
                return (frame as any).argNodes[paramIndex];
            }
        }
        if (ctx.pendingArgNodes && paramIndex < ctx.pendingArgNodes.length) {
            return ctx.pendingArgNodes[paramIndex];
        }
        return null;
    }
}
