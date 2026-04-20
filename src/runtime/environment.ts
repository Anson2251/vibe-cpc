import { TypeInfo, VariableInfo, RoutineSignature } from "../types";
import { RuntimeError } from "../errors";
import type { ASTNode } from "../parser/ast-nodes";
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
        const atom = new VariableAtom(address, type, false, true);
        this.variables.set(name, atom);
    }

    /**
     * Define a variable with Copy-on-Write semantics for BYVAL parameters.
     * For complex types (arrays, records), shares the underlying heap storage
     * and only copies on write.
     */
    defineByValCOW(name: string, type: TypeInfo, value: unknown): void {
        if (this.variables.has(name)) {
            throw new RuntimeError(`Variable '${name}' already declared in this scope`);
        }

        // Check if type is a complex type (array or record) that uses heap storage
        const isComplexType = typeof type === "object" &&
            ("elementType" in type || "fields" in type);

        if (isComplexType && typeof value === "number") {
            // Value is a heap address - share it (COW)
            this.heap.incrementRef(value);
            const atom = new VariableAtom(value, type, false);
            this.variables.set(name, atom);
            return;
        }

        // For primitive types or non-address values, normal allocation
        const atom = VariableAtomFactory.createAtom(type, value, false, this.heap, false);
        this.variables.set(name, atom);
    }

    get(name: string): unknown {
        const atom = this.variables.get(name);
        if (atom !== undefined) {
            return atom.getValue(this.heap);
        }

        if (this.parent !== undefined) {
            return this.parent.get(name);
        }

        throw new RuntimeError(`Undefined variable '${name}'`);
    }

    getAtom(name: string): VariableAtom {
        const atom = this.variables.get(name);
        if (atom !== undefined) {
            return atom;
        }

        if (this.parent !== undefined) {
            return this.parent.getAtom(name);
        }

        throw new RuntimeError(`Undefined variable '${name}'`);
    }

    getType(name: string): TypeInfo {
        const atom = this.variables.get(name);
        if (atom !== undefined) {
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
        const atom = this.variables.get(name);
        if (atom !== undefined) {
            if (atom.isConstant) {
                throw new RuntimeError(`Cannot assign to constant '${name}'`);
            }

            VariableAtomFactory.validateValue(atom.type, value);

            // BYREF variables should never trigger COW - they are meant to be shared
            if (atom.isByRef) {
                this.heap.write(atom.getAddress(), value, atom.type);
                return;
            }

            // Check if this is a shared variable (COW candidate)
            // Only use COW for BYVAL parameters with refCount > 1
            const heapObj = this.heap.readUnsafe(atom.getAddress());
            if (heapObj.refCount > 1) {
                // Use COW semantics: create a copy
                const newAddress = this.heap.writeCOW(atom.getAddress(), value, atom.type);
                if (newAddress !== atom.getAddress()) {
                    atom.address = newAddress;
                }
            } else {
                // Normal write for non-shared variables
                this.heap.write(atom.getAddress(), value, atom.type);
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
        const atom = this.variables.get(name);
        if (atom !== undefined) {
            if (atom.isConstant) {
                throw new RuntimeError(`Cannot assign to constant '${name}'`);
            }

            const oldAddress = atom.getAddress();
            this.heap.incrementRef(sourceAddress);
            atom.address = sourceAddress;

            this.heap.decrementRef(oldAddress);

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
        const routine = this.routines.get(name);
        if (routine !== undefined) {
            return routine;
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

    exitScope(): void { }

    disposeScope(): void {
        for (const atom of this.variables.values()) {
            this.heap.decrementRefUnsafe(atom.getAddress());
        }
        this.variables.clear();
    }
}
