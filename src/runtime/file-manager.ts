import { IOInterface } from "../io/io-interface";
import { FileIOError } from "../errors";

export type FileMode = "READ" | "WRITE" | "APPEND" | "RANDOM";

interface TextFileState {
    kind: "text";
    identifier: string;
    mode: Exclude<FileMode, "RANDOM">;
    lines: string[];
    readIndex: number;
}

interface RandomFileState {
    kind: "random";
    identifier: string;
    handle: number;
    position: number;
}

type FileState = TextFileState | RandomFileState;

export class RuntimeFileManager {
    private openFiles: Map<string, FileState> = new Map();

    constructor(private readonly io: IOInterface) {}

    async open(identifier: string, mode: FileMode): Promise<void> {
        if (this.openFiles.has(identifier)) {
            throw new FileIOError(`File '${identifier}' is already open`);
        }

        if (mode === "RANDOM") {
            const handle = await this.io.openRandomFile(identifier);
            this.openFiles.set(identifier, {
                kind: "random",
                identifier,
                handle,
                position: 0,
            });
            return;
        }

        if (mode === "READ") {
            const content = await this.io.readFile(identifier);
            this.openFiles.set(identifier, {
                kind: "text",
                identifier,
                mode,
                lines: this.toLines(content),
                readIndex: 0,
            });
            return;
        }

        if (mode === "WRITE") {
            this.openFiles.set(identifier, {
                kind: "text",
                identifier,
                mode,
                lines: [],
                readIndex: 0,
            });
            return;
        }

        const existing = (await this.io.fileExists(identifier))
            ? await this.io.readFile(identifier)
            : "";

        this.openFiles.set(identifier, {
            kind: "text",
            identifier,
            mode,
            lines: this.toLines(existing),
            readIndex: 0,
        });
    }

    async close(identifier: string): Promise<void> {
        const state = this.getFileState(identifier);

        if (state.kind === "random") {
            await this.io.closeFile(state.handle);
            this.openFiles.delete(identifier);
            return;
        }

        if (state.mode === "WRITE" || state.mode === "APPEND") {
            await this.io.writeFile(identifier, state.lines.join("\n"));
        }

        this.openFiles.delete(identifier);
    }

    async closeAll(): Promise<string[]> {
        const identifiers = Array.from(this.openFiles.keys());
        for (const identifier of identifiers) {
            await this.close(identifier);
        }
        return identifiers;
    }

    readLine(identifier: string): string {
        const state = this.requireTextState(identifier, "READ");

        if (state.readIndex >= state.lines.length) {
            return "";
        }

        const line = state.lines[state.readIndex];
        state.readIndex += 1;
        return line;
    }

    writeLine(identifier: string, value: string): void {
        const state = this.requireTextState(identifier, "WRITE", "APPEND");
        state.lines.push(value);
    }

    isEOF(identifier: string): boolean {
        const state = this.requireTextState(identifier, "READ");
        return state.readIndex >= state.lines.length;
    }

    seek(identifier: string, position: number): void {
        const state = this.requireRandomState(identifier);
        if (!Number.isInteger(position) || position < 0) {
            throw new FileIOError(`Invalid random file position '${position}'`);
        }
        state.position = position;
    }

    async getRecord(identifier: string): Promise<string> {
        const state = this.requireRandomState(identifier);
        return this.io.readRecord(state.handle, state.position);
    }

    async putRecord(identifier: string, data: string): Promise<void> {
        const state = this.requireRandomState(identifier);
        await this.io.writeRecord(state.handle, state.position, data);
    }

    private getFileState(identifier: string): FileState {
        const state = this.openFiles.get(identifier);
        if (!state) {
            throw new FileIOError(`File '${identifier}' is not open`);
        }
        return state;
    }

    private requireTextState(
        identifier: string,
        ...modes: Array<"READ" | "WRITE" | "APPEND">
    ): TextFileState {
        const state = this.getFileState(identifier);
        if (state.kind !== "text") {
            throw new FileIOError(`File '${identifier}' is not open as a text file`);
        }
        if (!modes.includes(state.mode)) {
            throw new FileIOError(`File '${identifier}' is open in ${state.mode} mode`);
        }
        return state;
    }

    private requireRandomState(identifier: string): RandomFileState {
        const state = this.getFileState(identifier);
        if (state.kind !== "random") {
            throw new FileIOError(`File '${identifier}' is not open in RANDOM mode`);
        }
        return state;
    }

    private toLines(content: string): string[] {
        if (content.length === 0) {
            return [];
        }
        return content.replace(/\r\n/g, "\n").split("\n");
    }
}
