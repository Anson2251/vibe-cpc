import { IOQueue, IOOperation } from "./io-queue";

export type Bounce =
    | { type: "done"; value: unknown }
    | { type: "io"; kind: "input" | "output"; data: string; resume: (result: string) => Bounce }
    | { type: "file"; operation: IOOperation; resume: () => Bounce }
    | { type: "debug"; pause: () => Promise<void>; resume: () => Bounce }
    | { type: "seq"; step: () => Bounce; then: (value: unknown) => Bounce }
    | { type: "loop"; condition: () => Bounce; body: () => Bounce; after: () => Bounce };

export function done(value: unknown): Bounce {
    return { type: "done", value };
}

export function io(
    kind: "input" | "output",
    data: string,
    resume: (result: string) => Bounce,
): Bounce {
    return { type: "io", kind, data, resume };
}

export function fileOp(operation: IOOperation, resume: () => Bounce): Bounce {
    return { type: "file", operation, resume };
}

export function debugPause(pause: () => Promise<void>, resume: () => Bounce): Bounce {
    return { type: "debug", pause, resume };
}

export function seq(step: () => Bounce, then: (value: unknown) => Bounce): Bounce {
    return { type: "seq", step, then };
}

export function seqMany(steps: Array<() => Bounce>, then: () => Bounce): Bounce {
    return seqManyRecursive(steps, 0, then);
}

function seqManyRecursive(steps: Array<() => Bounce>, index: number, then: () => Bounce): Bounce {
    if (index >= steps.length) {
        return then();
    }
    return seq(steps[index], () => seqManyRecursive(steps, index + 1, then));
}

export function loop(condition: () => Bounce, body: () => Bounce, after: () => Bounce): Bounce {
    return { type: "loop", condition, body, after };
}

export class TrampolineEngine {
    private ioQueue: IOQueue;
    private onInput?: (prompt: string) => Promise<string>;
    private onOutput?: (data: string) => void;

    constructor(
        ioQueue: IOQueue,
        callbacks?: {
            onInput?: (prompt: string) => Promise<string>;
            onOutput?: (data: string) => void;
        },
    ) {
        this.ioQueue = ioQueue;
        this.onInput = callbacks?.onInput;
        this.onOutput = callbacks?.onOutput;
    }

    async run(bounce: Bounce): Promise<unknown> {
        let current: Bounce = bounce;

        while (true) {
            if (current.type === "done") {
                await this.ioQueue.drain();
                return current.value;
            }

            if (current.type === "io") {
                if (current.kind === "output") {
                    if (this.onOutput) {
                        this.onOutput(current.data);
                    }
                    current = current.resume("");
                    continue;
                } else {
                    const result = await this.handleIO(current.kind, current.data);
                    current = current.resume(result);
                    continue;
                }
            }

            if (current.type === "file") {
                const result = await this.ioQueue.execute(current.operation);
                if (result.isErr()) {
                    throw result.error;
                }
                current = current.resume();
                continue;
            }

            if (current.type === "debug") {
                await current.pause();
                current = current.resume();
                continue;
            }

            if (current.type === "seq") {
                const stepBounce = current.step();
                if (stepBounce.type === "done") {
                    current = current.then(stepBounce.value);
                    continue;
                } else {
                    const stepResult = await this.runStep(stepBounce);
                    current = current.then(stepResult);
                    continue;
                }
            }

            if (current.type === "loop") {
                const loopBounce = current;
                const condBounce = loopBounce.condition();
                if (condBounce.type === "done") {
                    if (condBounce.value === true) {
                        const bodyBounce = loopBounce.body();
                        if (bodyBounce.type === "done") {
                            // Reuse the same loop bounce object to avoid allocation
                            current = loopBounce;
                            continue;
                        } else {
                            await this.runStep(bodyBounce);
                            // Reuse the same loop bounce object to avoid allocation
                            current = loopBounce;
                            continue;
                        }
                    } else {
                        current = loopBounce.after();
                        continue;
                    }
                } else {
                    const condResult = await this.runStep(condBounce);
                    if (condResult === true) {
                        await this.runStep(loopBounce.body());
                        // Reuse the same loop bounce object to avoid allocation
                        current = loopBounce;
                        continue;
                    } else {
                        current = loopBounce.after();
                        continue;
                    }
                }
            }

            throw new Error(`Unknown bounce type: ${(current as { type: string }).type}`);
        }
    }

    private async runStep(bounce: Bounce): Promise<unknown> {
        let current: Bounce = bounce;

        while (current.type !== "done") {
            if (current.type === "io") {
                if (current.kind === "output") {
                    if (this.onOutput) {
                        this.onOutput(current.data);
                    }
                    current = current.resume("");
                    continue;
                } else {
                    const result = await this.handleIO(current.kind, current.data);
                    current = current.resume(result);
                    continue;
                }
            }

            if (current.type === "file") {
                const result = await this.ioQueue.execute(current.operation);
                if (result.isErr()) {
                    throw result.error;
                }
                current = current.resume();
                continue;
            }

            if (current.type === "debug") {
                await current.pause();
                current = current.resume();
                continue;
            }

            if (current.type === "seq") {
                const stepBounce = current.step();
                if (stepBounce.type === "done") {
                    current = current.then(stepBounce.value);
                    continue;
                } else if (stepBounce.type === "loop") {
                    const savedThen = current.then;
                    current = {
                        type: "loop",
                        condition: stepBounce.condition,
                        body: stepBounce.body,
                        after: () => savedThen(undefined),
                    };
                    continue;
                } else {
                    const stepResult = await this.runStep(stepBounce);
                    current = current.then(stepResult);
                    continue;
                }
            }

            if (current.type === "loop") {
                const loopBounce = current;
                const condBounce = loopBounce.condition();
                if (condBounce.type === "done") {
                    if (condBounce.value === true) {
                        const bodyBounce = loopBounce.body();
                        if (bodyBounce.type === "done") {
                            // Reuse the same loop bounce object to avoid allocation
                            current = loopBounce;
                            continue;
                        } else {
                            await this.runStep(bodyBounce);
                            // Reuse the same loop bounce object to avoid allocation
                            current = loopBounce;
                            continue;
                        }
                    } else {
                        current = loopBounce.after();
                        continue;
                    }
                } else {
                    const condResult = await this.runStep(condBounce);
                    if (condResult === true) {
                        await this.runStep(loopBounce.body());
                        // Reuse the same loop bounce object to avoid allocation
                        current = loopBounce;
                        continue;
                    } else {
                        current = loopBounce.after();
                        continue;
                    }
                }
            }

            throw new Error(`Unknown bounce type: ${(current as { type: string }).type}`);
        }

        return current.value;
    }

    private async handleIO(kind: "input" | "output", data: string): Promise<string> {
        switch (kind) {
            case "input":
                if (this.onInput) {
                    return this.onInput(data);
                }
                return "";
            case "output":
                if (this.onOutput) {
                    this.onOutput(data);
                }
                return "";
        }
    }
}
