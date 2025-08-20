/**
 * Node.js IO Implementation for CAIE Pseudocode Interpreter
 *
 * This class implements the IOInterface using Node.js APIs for file operations
 * and console I/O. It provides a concrete implementation for running the
 * interpreter in a Node.js environment.
 */

import { IOInterface } from './io-interface';
import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Node.js implementation of the IOInterface
 */
export class NodeIOImpl implements IOInterface {
	private fileHandles: Map<number, fs.promises.FileHandle> = new Map();
	private nextFileHandle: number = 1;
	private readlineInterface: readline.Interface | null = null;

	constructor() {
		// Initialize readline interface for console input
		this.readlineInterface = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
	}

	// Console operations
	async input(prompt?: string): Promise<string> {
		if (!this.readlineInterface) {
			throw new Error('Readline interface not initialized');
		}

		return new Promise<string>((resolve) => {
			this.readlineInterface!.question(prompt || '', (answer) => {
				resolve(answer);
			});
		});
	}

	output(data: string): void {
		process.stdout.write(data);
	}

	// File operations
	async readFile(path: string): Promise<string> {
		try {
			return await fs.promises.readFile(path, 'utf8');
		} catch (error) {
			throw new Error(`Failed to read file '${path}': ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async writeFile(path: string, data: string): Promise<void> {
		try {
			await fs.promises.writeFile(path, data, 'utf8');
		} catch (error) {
			throw new Error(`Failed to write file '${path}': ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async appendFile(path: string, data: string): Promise<void> {
		try {
			await fs.promises.appendFile(path, data, 'utf8');
		} catch (error) {
			throw new Error(`Failed to append to file '${path}': ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async fileExists(path: string): Promise<boolean> {
		try {
			await fs.promises.access(path);
			return true;
		} catch {
			return false;
		}
	}

	// Random file operations
	async openRandomFile(path: string): Promise<number> {
		try {
			const fileHandle = await fs.promises.open(path, 'r+');
			const handle = this.nextFileHandle++;
			this.fileHandles.set(handle, fileHandle);
			return handle;
		} catch (error) {
			throw new Error(`Failed to open random file '${path}': ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async readRecord(fileHandle: number, position: number): Promise<string> {
		const handle = this.fileHandles.get(fileHandle);
		if (!handle) {
			throw new Error(`Invalid file handle: ${fileHandle}`);
		}

		try {
			// For simplicity, we'll assume fixed-length records of 256 bytes
			const recordSize = 256;
			const buffer = Buffer.alloc(recordSize);

			await handle.read(buffer, 0, recordSize, position * recordSize);

			// Trim null bytes and return as string
			return buffer.toString('utf8').replace(/\0+$/, '');
		} catch (error) {
			throw new Error(`Failed to read record at position ${position}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async writeRecord(fileHandle: number, position: number, data: string): Promise<void> {
		const handle = this.fileHandles.get(fileHandle);
		if (!handle) {
			throw new Error(`Invalid file handle: ${fileHandle}`);
		}

		try {
			// For simplicity, we'll assume fixed-length records of 256 bytes
			const recordSize = 256;
			const buffer = Buffer.alloc(recordSize);

			// Write data and pad with null bytes if necessary
			buffer.write(data, 'utf8');

			await handle.write(buffer, 0, recordSize, position * recordSize);
		} catch (error) {
			throw new Error(`Failed to write record at position ${position}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async closeFile(fileHandle: number): Promise<void> {
		const handle = this.fileHandles.get(fileHandle);
		if (!handle) {
			throw new Error(`Invalid file handle: ${fileHandle}`);
		}

		try {
			await handle.close();
			this.fileHandles.delete(fileHandle);
		} catch (error) {
			throw new Error(`Failed to close file handle ${fileHandle}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	// Error handling
	error(message: string, line?: number, column?: number): void {
		let errorMessage = `Error: ${message}`;

		if (line !== undefined) {
			errorMessage += ` at line ${line}`;

			if (column !== undefined) {
				errorMessage += `, column ${column}`;
			}
		}

		process.stderr.write(errorMessage + '\n');
	}

	/**
	 * Clean up resources when the IO implementation is no longer needed
	 */
	dispose(): void {
		// Close all open file handles
		for (const [handle, fileHandle] of this.fileHandles.entries()) {
			try {
				fileHandle.close();
			} catch (error) {
				console.warn("Failed to close file handle: ", error)
			}
		}
		this.fileHandles.clear();

		// Close readline interface
		if (this.readlineInterface) {
			this.readlineInterface.close();
			this.readlineInterface = null;
		}
	}
}
