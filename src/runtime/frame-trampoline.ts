import type { IOInterface } from "../io/io-interface";
import type { ASTNode, RuntimeMethodInfo } from "../parser/ast-nodes";
import { RuntimeError } from "../errors";
import { FrameEvaluator } from "./frame-evaluator";
import { FrameContext, FrameResult, FrameSyscall } from "./frame-stack";
import { Environment, ExecutionContext } from "./environment";
import { Heap } from "./heap";
import { IOQueue } from "./io-queue";
import { RuntimeFileManager } from "./file-manager";
import { DebuggerController } from "./debugger";
import type { RoutineInfo } from "./environment";
import type { UserDefinedTypeInfo, EnumTypeInfo, SetTypeInfo, PointerTypeInfo, ClassTypeInfo } from "../types";
import type { ImportInfo } from "./linker";

export interface FrameTrampolineDeps {
    io: IOInterface;
    strictMode: boolean;
    globalRoutines: Map<string, RoutineInfo>;
    userDefinedTypes: Map<string, UserDefinedTypeInfo>;
    enumTypes: Map<string, EnumTypeInfo>;
    setTypes: Map<string, SetTypeInfo>;
    pointerTypes: Map<string, PointerTypeInfo>;
    classDefinitions: Map<string, ClassTypeInfo>;
    classMethodBodies: Map<string, Map<string, RuntimeMethodInfo>>;
    namespaceImports: Map<string, ImportInfo>;
    debuggerController?: DebuggerController;
    onStep?: () => void;
}

export class FrameTrampoline {
    private deps: FrameTrampolineDeps;
    private heap: Heap;
    private fileManager: RuntimeFileManager;
    private ioQueue: IOQueue;
    private environment: Environment;
    private context: ExecutionContext;

    constructor(deps: FrameTrampolineDeps) {
        this.deps = deps;
        this.heap = new Heap();
        this.fileManager = new RuntimeFileManager(this.deps.io);
        this.ioQueue = new IOQueue(this.fileManager);
        this.environment = new Environment(this.heap);
        this.context = new ExecutionContext(this.environment);
    }

    async run(entryNode: ASTNode): Promise<unknown> {
        const evaluatorDeps = {
            heap: this.heap,
            environment: this.environment,
            context: this.context,
            ioQueue: this.ioQueue,
            fileManager: this.fileManager,
            globalRoutines: this.deps.globalRoutines,
            userDefinedTypes: this.deps.userDefinedTypes,
            enumTypes: this.deps.enumTypes,
            setTypes: this.deps.setTypes,
            pointerTypes: this.deps.pointerTypes,
            classDefinitions: this.deps.classDefinitions,
            classMethodBodies: this.deps.classMethodBodies,
            resolvedClassCache: new Map(),
            debuggerController: this.deps.debuggerController,
            onStep: this.deps.onStep,
            strictMode: this.deps.strictMode,
            namespaceImports: this.deps.namespaceImports,
        };

        const evaluator = new FrameEvaluator(evaluatorDeps);
        let ctx = evaluator.createInitialContext(entryNode);
        let result = evaluator.step(ctx);

        while (result.kind !== "complete") {
            if (result.kind === "syscall") {
                const syscallResult = await this.handleSyscall(result.call, evaluator, result.ctx);
                // Push syscall result to value stack for input and host_call
                if (result.call.type === "host_call" || result.call.type === "io_input") {
                    result.ctx.valueStack.push(syscallResult);
                }
            }
            result = evaluator.step(result.ctx);
        }

        await this.ioQueue.drain();
        return result.value;
    }

    private async handleSyscall(call: FrameSyscall, evaluator: FrameEvaluator, ctx: FrameContext): Promise<unknown> {
        switch (call.type) {
            case "io_input": {
                const input = await this.deps.io.input(call.prompt);
                return input;
            }
            case "io_output":
                this.deps.io.output(call.data);
                return undefined;
            case "file_op":
                this.ioQueue.enqueue(call.operation);
                await this.ioQueue.drain();
                return undefined;
            case "debug_pause":
                if (this.deps.debuggerController) {
                    await this.deps.debuggerController.pause(call.snapshot);
                }
                return undefined;
            case "host_call":
                return await this.handleHostCall(call, evaluator);
        }
    }

    private async handleHostCall(call: { type: "host_call"; name: string; args: unknown[] }, evaluator: FrameEvaluator): Promise<unknown> {
        const { name, args } = call;

        if (this.deps.globalRoutines.has(name)) {
            const routineInfo = this.deps.globalRoutines.get(name)!;

            if (routineInfo.isBuiltIn && routineInfo.implementation) {
                const result = routineInfo.implementation(...args);
                if (result instanceof Promise) {
                    return await result;
                }
                return result;
            }
        }

        throw new RuntimeError(`Undefined host function '${name}'`);
    }
}
