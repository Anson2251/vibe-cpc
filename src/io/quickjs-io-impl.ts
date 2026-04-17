// oxlint-disable typescript/require-await
import { IOInterface } from "./io-interface";
import * as std from "std";
import * as os from "os";

const RECORD_SIZE = 256;

interface QuickJSFileHandle {
    id: number;
    path: string;
    file: std.QuickJSFile;
}

export class QuickJSIOImpl implements IOInterface {
    private fileHandles: Map<number, QuickJSFileHandle> = new Map();
    private nextFileHandle: number = 1;

    async input(prompt?: string): Promise<string> {
        if (prompt) {
            std.out.puts(prompt);
            std.out.flush();
        }
        return std.in.getline();
    }

    output(data: string): void {
        std.out.puts(data);
        std.out.flush();
    }

    async readFile(path: string): Promise<string> {
        const content = std.loadFile(path);
        if (content === null || content === undefined) {
            throw new Error(`Failed to read file '${path}'`);
        }
        return content;
    }

    async writeFile(path: string, data: string): Promise<void> {
        const file = std.open(path, "w");
        if (!file) {
            throw new Error(`Failed to open file for writing '${path}'`);
        }
        try {
            file.puts(data);
            file.flush();
        } finally {
            file.close();
        }
    }

    async appendFile(path: string, data: string): Promise<void> {
        const file = std.open(path, "a");
        if (!file) {
            throw new Error(`Failed to open file for appending '${path}'`);
        }
        try {
            file.puts(data);
            file.flush();
        } finally {
            file.close();
        }
    }

    async fileExists(path: string): Promise<boolean> {
        const [, err] = os.stat(path);
        return err === 0;
    }

    async openRandomFile(path: string): Promise<number> {
        let file = std.open(path, "r+");
        if (!file) {
            file = std.open(path, "w+");
            if (!file) {
                throw new Error(`Failed to open random file '${path}'`);
            }
            file.close();
            file = std.open(path, "r+");
            if (!file) {
                throw new Error(`Failed to open random file '${path}'`);
            }
        }
        const handle = this.nextFileHandle++;
        this.fileHandles.set(handle, { id: handle, path, file });
        return handle;
    }

    async readRecord(fileHandle: number, position: number): Promise<string> {
        const handle = this.fileHandles.get(fileHandle);
        if (!handle) {
            throw new Error(`Invalid file handle: ${fileHandle}`);
        }
        try {
            handle.file.seek(position * RECORD_SIZE, std.SEEK_SET);
            const buf = new ArrayBuffer(RECORD_SIZE);
            handle.file.read(buf, 0, RECORD_SIZE);
            const text = new TextDecoder().decode(buf);
            let end = text.length;
            while (end > 0 && text.charCodeAt(end - 1) === 0) {
                end--;
            }
            return text.substring(0, end);
        } catch {
            throw new Error(`Failed to read record at position ${position}`);
        }
    }

    async writeRecord(fileHandle: number, position: number, data: string): Promise<void> {
        const handle = this.fileHandles.get(fileHandle);
        if (!handle) {
            throw new Error(`Invalid file handle: ${fileHandle}`);
        }
        try {
            const encoded = new TextEncoder().encode(data);
            const record = new Uint8Array(RECORD_SIZE);
            record.set(encoded.slice(0, RECORD_SIZE));
            handle.file.seek(position * RECORD_SIZE, std.SEEK_SET);
            handle.file.write(record.buffer, 0, RECORD_SIZE);
            handle.file.flush();
        } catch {
            throw new Error(`Failed to write record at position ${position}`);
        }
    }

    async closeFile(fileHandle: number): Promise<void> {
        const handle = this.fileHandles.get(fileHandle);
        if (!handle) {
            throw new Error(`Invalid file handle: ${fileHandle}`);
        }
        try {
            handle.file.close();
            this.fileHandles.delete(fileHandle);
        } catch {
            throw new Error(`Failed to close file handle ${fileHandle}`);
        }
    }

    error(message: string, line?: number, column?: number): void {
        let errorMessage = message;
        if (line !== undefined) {
            errorMessage += ` at line ${line}`;
            if (column !== undefined) {
                errorMessage += `, column ${column}`;
            }
        }
        std.err.puts(errorMessage + "\n");
        std.err.flush();
    }

    async dispose(): Promise<void> {
        for (const handle of this.fileHandles.values()) {
            try {
                handle.file.close();
            } catch {
                // ignore close errors during dispose
            }
        }
        this.fileHandles.clear();
    }
}
