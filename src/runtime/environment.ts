import { TypeInfo, VariableInfo, RoutineSignature } from "../types";
import { RuntimeError } from "../errors";
import { ASTNode } from "../parser/ast-nodes";
import { VariableAtom, VariableAtomFactory } from "./variable-atoms";
import { Heap } from "./heap";

export interface RuntimeValue {
    value: unknown;
    type: TypeInfo;
}

export class ExecutionContext {
    environment: Environment;
    returnValue?: unknown;
    shouldReturn: boolean;
    currentLine?: number;
    currentColumn?: number;
    callStack: CallFrame[];

    constructor(environment: Environment) {
        this.environment = environment;
        this.shouldReturn = false;
        this.callStack = [];
    }

    shouldReturnFromRoutine(): boolean {
        return this.shouldReturn;
    }

    getReturnValue(): unknown {
        return this.returnValue;
    }

    setReturnValue(value: unknown): void {
        this.returnValue = value;
    }

    resetReturnFlag(): void {
        this.shouldReturn = false;
        this.returnValue = undefined;
    }

    pushCallFrame(frame: CallFrame): void {
        this.callStack.push(frame);
    }

    popCallFrame(): CallFrame | undefined {
        return this.callStack.pop();
    }

    getCurrentCallFrame(): CallFrame | undefined {
        return this.callStack[this.callStack.length - 1];
    }
}

export interface CallFrame {
    routineName: string;
    environment: Environment;
    returnAddress?: { line: number; column: number };
}

export interface Scope {
    variables: VariableInfo[];
    parent?: Scope;
}

export interface RoutineInfo<
    TArgs extends unknown[] = unknown[],
    TReturn = unknown,
> extends RoutineSignature {
    node?: ASTNode;
    isBuiltIn?: boolean;
    implementation?: (...args: TArgs) => TReturn;
    returnType?: TypeInfo;
}

export class Environment {
    private variables: Map<string, VariableAtom> = new Map();
    private parent?: Environment;
    private routines: Map<string, RoutineSignature> = new Map();
    private fileHandles: Map<string, number> = new Map();
    private nextFileHandle: number = 1;
    private heap: Heap;

    constructor(heap: Heap, parent?: Environment) {
        this.heap = heap;
        this.parent = parent;
    }

    getHeap(): Heap {
        return this.heap;
    }

    define(
        name: string,
        type: TypeInfo,
        value: unknown,
        isConstant: boolean = false,
        fromHeap: boolean = false,
    ): void {
        if (this.variables.has(name)) {
            throw new RuntimeError(`Variable '${name}' already declared in this scope`);
        }

        const atom = VariableAtomFactory.createAtom(type, value, isConstant, this.heap, fromHeap);
        this.variables.set(name, atom);
    }

    defineByRef(name: string, type: TypeInfo, address: number): void {
        if (this.variables.has(name)) {
            throw new RuntimeError(`Variable '${name}' already declared in this scope`);
        }

        this.heap.incrementRef(address);
        const atom = new VariableAtom(address, type, false);
        this.variables.set(name, atom);
    }

    get(name: string): unknown {
        if (this.variables.has(name)) {
            const atom = this.variables.get(name)!;
            return atom.getValue(this.heap);
        }

        if (this.parent !== undefined) {
            return this.parent.get(name);
        }

        throw new RuntimeError(`Undefined variable '${name}'`);
    }

    getAtom(name: string): VariableAtom {
        if (this.variables.has(name)) {
            return this.variables.get(name)!;
        }

        if (this.parent !== undefined) {
            return this.parent.getAtom(name);
        }

        throw new RuntimeError(`Undefined variable '${name}'`);
    }

    getType(name: string): TypeInfo {
        if (this.variables.has(name)) {
            const atom = this.variables.get(name)!;
            return atom.type;
        }

        if (this.parent !== undefined) {
            return this.parent.getType(name);
        }

        throw new RuntimeError(`Undefined variable '${name}'`);
    }

    has(name: string): boolean {
        if (this.variables.has(name)) {
            return true;
        }

        if (this.parent !== undefined) {
            return this.parent.has(name);
        }

        return false;
    }

    assign(name: string, value: unknown): void {
        if (this.variables.has(name)) {
            const atom = this.variables.get(name)!;

            if (atom.isConstant) {
                throw new RuntimeError(`Cannot assign to constant '${name}'`);
            }

            VariableAtomFactory.validateValue(atom.type, value);

            const writeResult = this.heap.write(atom.getAddress(), value, atom.type);
            if (writeResult.isErr()) {
                throw writeResult.error;
            }

            return;
        }

        if (this.parent !== undefined) {
            this.parent.assign(name, value);
            return;
        }

        throw new RuntimeError(`Undefined variable '${name}'`);
    }

    assignPointer(name: string, sourceAddress: number): void {
        if (this.variables.has(name)) {
            const atom = this.variables.get(name)!;

            if (atom.isConstant) {
                throw new RuntimeError(`Cannot assign to constant '${name}'`);
            }

            const oldAddress = atom.getAddress();
            this.heap.incrementRef(sourceAddress);
            atom.address = sourceAddress;

            const decResult = this.heap.decrementRef(oldAddress);
            if (decResult.isErr()) {
                throw decResult.error;
            }

            return;
        }

        if (this.parent !== undefined) {
            this.parent.assignPointer(name, sourceAddress);
            return;
        }

        throw new RuntimeError(`Undefined variable '${name}'`);
    }

    defineRoutine(signature: RoutineSignature): void {
        if (this.routines.has(signature.name)) {
            throw new RuntimeError(`Routine '${signature.name}' already declared`);
        }

        this.routines.set(signature.name, signature);
    }

    getRoutine(name: string): RoutineSignature {
        if (this.routines.has(name)) {
            return this.routines.get(name)!;
        }

        if (this.parent !== undefined) {
            return this.parent.getRoutine(name);
        }

        throw new RuntimeError(`Undefined routine '${name}'`);
    }

    hasRoutine(name: string): boolean {
        if (this.routines.has(name)) {
            return true;
        }

        if (this.parent !== undefined) {
            return this.parent.hasRoutine(name);
        }

        return false;
    }

    allocateFileHandle(variableName: string): number {
        const handle = this.nextFileHandle++;
        this.fileHandles.set(variableName, handle);
        return handle;
    }

    getFileHandle(variableName: string): number {
        if (this.fileHandles.has(variableName)) {
            return this.fileHandles.get(variableName)!;
        }

        if (this.parent !== undefined) {
            return this.parent.getFileHandle(variableName);
        }

        throw new RuntimeError(`Undefined file handle '${variableName}'`);
    }

    releaseFileHandle(variableName: string): void {
        if (this.fileHandles.has(variableName)) {
            this.fileHandles.delete(variableName);
            return;
        }

        if (this.parent !== undefined) {
            this.parent.releaseFileHandle(variableName);
            return;
        }

        throw new RuntimeError(`Undefined file handle '${variableName}'`);
    }

    createChild(): Environment {
        return new Environment(this.heap, this);
    }

    getVariables(): VariableInfo[] {
        const variables: VariableInfo[] = [];

        for (const [name, atom] of this.variables.entries()) {
            variables.push({
                name,
                type: atom.type,
                value: atom.getValue(this.heap),
                isConstant: atom.isConstant,
            });
        }

        return variables;
    }

    getDebugScopes(): Scope[] {
        const scopes: Scope[] = [];

        const collectScopes = (env: Environment | undefined): void => {
            if (!env) return;
            scopes.push({ variables: env.getVariables() });
            collectScopes(env.parent);
        };

        collectScopes(this);
        return scopes;
    }

    getRoutines(): RoutineSignature[] {
        return Array.from(this.routines.values());
    }

    defineVariable(
        name: string,
        type: TypeInfo,
        value: unknown,
        isConstant: boolean = false,
    ): void {
        this.define(name, type, value, isConstant);
    }

    setVariable(name: string, value: unknown): void {
        this.assign(name, value);
    }

    getVariable(name: string): unknown {
        return this.get(name);
    }

    getFilename(handleVariable: string): string {
        return `file_${this.getFileHandle(handleVariable)}`;
    }

    enterScope(): Environment {
        return this.createChild();
    }

    exitScope(): void {}

    disposeScope(): void {
        for (const atom of this.variables.values()) {
            const decResult = this.heap.decrementRef(atom.getAddress());
            if (decResult.isErr()) {
                throw decResult.error;
            }
        }
        this.variables.clear();
    }
}
