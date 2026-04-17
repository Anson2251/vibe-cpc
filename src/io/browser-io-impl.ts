/**
 * Browser IO Implementation for CAIE Pseudocode Interpreter
 *
 * This class implements IOInterface for browser environments and delegates
 * persistence to an injected file-system adapter.
 */

import { IOInterface } from "./io-interface";

const RECORD_SIZE = 256;

export interface BrowserFileSystemAdapter {
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, data: string): Promise<void>;
    appendTextFile(path: string, data: string): Promise<void>;
    fileExists(path: string): Promise<boolean>;
    readBinaryFile(path: string): Promise<Uint8Array>;
    writeBinaryFile(path: string, data: Uint8Array): Promise<void>;
}

export interface BrowserIOOptions {
    fileSystem: BrowserFileSystemAdapter;
    onOutput?: (data: string) => void;
    onError?: (data: string) => void;
    inputProvider?: (prompt?: string) => Promise<string>;
}

interface BrowserRandomFileHandle {
    id: number;
    path: string;
}

export class BrowserIOImpl implements IOInterface {
    private readonly fileSystem: BrowserFileSystemAdapter;
    private readonly onOutput?: (data: string) => void;
    private readonly onError?: (data: string) => void;
    private readonly inputProvider: (prompt?: string) => Promise<string>;
    private readonly randomFileHandles: Map<number, BrowserRandomFileHandle> = new Map();
    private nextRandomHandle = 1;

    constructor(options: BrowserIOOptions) {
        this.fileSystem = options.fileSystem;
        this.onOutput = options.onOutput;
        this.onError = options.onError;
        if (!options.inputProvider && !globalThis.prompt) {
            throw new Error("BrowserIO requires an inputProvider in browser environment");
        }
        // eslint-disable-next-line typescript-eslint/promise-function-async
        this.inputProvider =
            options.inputProvider ||
            ((prompt?: string) => {
                const result = globalThis.prompt?.(prompt);
                return Promise.resolve(result || "");
            });
    }

    async input(prompt?: string): Promise<string> {
        return this.inputProvider(prompt);
    }

    output(data: string): void {
        if (this.onOutput) {
            this.onOutput(data);
            return;
        }
        console.log(data);
    }

    async readFile(path: string): Promise<string> {
        return this.fileSystem.readTextFile(path);
    }

    async writeFile(path: string, data: string): Promise<void> {
        await this.fileSystem.writeTextFile(path, data);
    }

    async appendFile(path: string, data: string): Promise<void> {
        await this.fileSystem.appendTextFile(path, data);
    }

    async fileExists(path: string): Promise<boolean> {
        return this.fileSystem.fileExists(path);
    }

    async openRandomFile(path: string): Promise<number> {
        const exists = await this.fileSystem.fileExists(path);
        if (!exists) {
            await this.fileSystem.writeBinaryFile(path, new Uint8Array());
        }

        const handle = this.nextRandomHandle++;
        this.randomFileHandles.set(handle, { id: handle, path });
        return handle;
    }

    async readRecord(fileHandle: number, position: number): Promise<string> {
        const handle = this.requireHandle(fileHandle);
        const bytes = await this.fileSystem.readBinaryFile(handle.path);
        const offset = position * RECORD_SIZE;
        const chunk = bytes.slice(offset, offset + RECORD_SIZE);
        const text = new TextDecoder().decode(chunk);
        // Remove trailing null characters
        let end = text.length;
        while (end > 0 && text.charCodeAt(end - 1) === 0) {
            end--;
        }
        return text.substring(0, end);
    }

    async writeRecord(fileHandle: number, position: number, data: string): Promise<void> {
        const handle = this.requireHandle(fileHandle);
        const existing = await this.fileSystem.readBinaryFile(handle.path);
        const requiredSize = (position + 1) * RECORD_SIZE;
        const next = new Uint8Array(Math.max(requiredSize, existing.length));
        next.set(existing);

        const encoded = new TextEncoder().encode(data);
        const recordBytes = new Uint8Array(RECORD_SIZE);
        recordBytes.set(encoded.slice(0, RECORD_SIZE));
        next.set(recordBytes, position * RECORD_SIZE);

        await this.fileSystem.writeBinaryFile(handle.path, next);
    }

    async closeFile(fileHandle: number): Promise<void> {
        await Promise.resolve(); // avoid the lint complaint
        this.randomFileHandles.delete(fileHandle);
    }

    error(message: string, line?: number, column?: number): void {
        let output = message;
        if (line !== undefined) {
            output += ` at line ${line}`;
        }
        if (column !== undefined) {
            output += `, column ${column}`;
        }

        if (this.onError) {
            this.onError(output);
            return;
        }
        console.error(output);
    }

    async dispose(): Promise<void> {
        await Promise.resolve(); // avoid the lint complaint
        this.randomFileHandles.clear();
    }

    private requireHandle(fileHandle: number): BrowserRandomFileHandle {
        const handle = this.randomFileHandles.get(fileHandle);
        if (!handle) {
            throw new Error(`Invalid file handle: ${fileHandle}`);
        }
        return handle;
    }
}
