/**
 * IO Interface for CAIE Pseudocode Interpreter
 *
 * This interface defines the contract for all I/O operations in the interpreter.
 * It's designed to be ES2020 compatible and environment-agnostic, allowing
 * implementations for different environments (Node.js, browser, etc.).
 */

export interface IOInterface {
	// Console operations
	/**
	 * Read input from the user with an optional prompt
	 * @param prompt - Optional prompt to display before reading input
	 * @returns Promise that resolves with the user's input as a string
	 */
	input(prompt?: string): Promise<string>;

	/**
	 * Output data to the console
	 * @param data - The data to output
	 */
	output(data: string): void;

	// File operations
	/**
	 * Read the contents of a file
	 * @param path - The path to the file to read
	 * @returns Promise that resolves with the file contents as a string
	 */
	readFile(path: string): Promise<string>;

	/**
	 * Write data to a file, overwriting if it exists
	 * @param path - The path to the file to write
	 * @param data - The data to write to the file
	 * @returns Promise that resolves when the write operation is complete
	 */
	writeFile(path: string, data: string): Promise<void>;

	/**
	 * Append data to a file
	 * @param path - The path to the file to append to
	 * @param data - The data to append to the file
	 * @returns Promise that resolves when the append operation is complete
	 */
	appendFile(path: string, data: string): Promise<void>;

	/**
	 * Check if a file exists
	 * @param path - The path to the file to check
	 * @returns Promise that resolves with true if the file exists, false otherwise
	 */
	fileExists(path: string): Promise<boolean>;

	// Random file operations
	/**
	 * Open a random access file
	 * @param path - The path to the file to open
	 * @returns Promise that resolves with a file handle
	 */
	openRandomFile(path: string): Promise<number>;

	/**
	 * Read a record from a random access file
	 * @param fileHandle - The handle of the file to read from
	 * @param position - The position of the record to read
	 * @returns Promise that resolves with the record data as a string
	 */
	readRecord(fileHandle: number, position: number): Promise<string>;

	/**
	 * Write a record to a random access file
	 * @param fileHandle - The handle of the file to write to
	 * @param position - The position of the record to write
	 * @param data - The data to write to the record
	 * @returns Promise that resolves when the write operation is complete
	 */
	writeRecord(fileHandle: number, position: number, data: string): Promise<void>;

	/**
	 * Close a random access file
	 * @param fileHandle - The handle of the file to close
	 * @returns Promise that resolves when the file is closed
	 */
	closeFile(fileHandle: number): Promise<void>;

	// Error handling
	/**
	 * Report an error with optional location information
	 * @param message - The error message
	 * @param line - Optional line number where the error occurred
	 * @param column - Optional column number where the error occurred
	 */
	error(message: string, line?: number, column?: number): void;

	dispose(): Promise<void>;
}
