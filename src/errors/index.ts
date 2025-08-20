/**
 * Error Handling Infrastructure for CAIE Pseudocode Interpreter
 *
 * This module defines the error classes and error handling utilities for the interpreter.
 */

import { IOInterface } from '../io/io-interface';

/**
 * Base error class for all pseudocode interpreter errors
 */
export class PseudocodeError extends Error {
	constructor(
		message: string,
		public readonly line?: number,
		public readonly column?: number
	) {
		super(message);
		this.name = this.constructor.name;
	}

	/**
	 * Get a string representation of the error including location information
	 */
	toString(): string {
		let result = `${this.name}: ${this.message}`;

		if (this.line !== undefined) {
			result += ` at line ${this.line}`;

			if (this.column !== undefined) {
				result += `, column ${this.column}`;
			}
		}

		return result;
	}
}

/**
 * Syntax error for parsing issues
 */
export class SyntaxError extends PseudocodeError {
	constructor(message: string, line?: number, column?: number) {
		super(message, line, column);
	}
}

/**
 * Runtime error for execution issues
 */
export class RuntimeError extends PseudocodeError {
	constructor(message: string, line?: number, column?: number) {
		super(message, line, column);
	}
}

/**
 * Type error for type checking issues
 */
export class TypeError extends PseudocodeError {
	constructor(message: string, line?: number, column?: number) {
		super(message, line, column);
	}
}

/**
 * File I/O error
 */
export class FileIOError extends RuntimeError {
	constructor(message: string, line?: number, column?: number) {
		super(message, line, column);
	}
}

/**
 * Division by zero error
 */
export class DivisionByZeroError extends RuntimeError {
	constructor(line?: number, column?: number) {
		super('Division by zero', line, column);
	}
}

/**
 * Stack overflow error
 */
export class StackOverflowError extends RuntimeError {
	constructor(message: string = 'Stack overflow', line?: number, column?: number) {
		super(message, line, column);
	}
}

/**
 * Index out of bounds error
 */
export class IndexError extends RuntimeError {
	constructor(message: string = 'Index out of bounds', line?: number, column?: number) {
		super(message, line, column);
	}
}

/**
 * Null reference error
 */
export class NullReferenceError extends RuntimeError {
	constructor(message: string = 'Null reference', line?: number, column?: number) {
		super(message, line, column);
	}
}

/**
 * Error handler class for managing error reporting
 */
export class ErrorHandler {
	constructor(private io: IOInterface) { }

	/**
	 * Report a syntax error
	 */
	syntaxError(message: string, line: number, column: number): void {
		this.io.error(`Syntax Error: ${message}`, line, column);
	}

	/**
	 * Report a runtime error
	 */
	runtimeError(message: string, line?: number, column?: number): void {
		this.io.error(`Runtime Error: ${message}`, line, column);
	}

	/**
	 * Report a type error
	 */
	typeError(message: string, line?: number, column?: number): void {
		this.io.error(`Type Error: ${message}`, line, column);
	}

	/**
	 * Report a file I/O error
	 */
	fileIOError(message: string, line?: number, column?: number): void {
		this.io.error(`File I/O Error: ${message}`, line, column);
	}

	/**
	 * Report a division by zero error
	 */
	divisionByZeroError(line?: number, column?: number): void {
		this.io.error('Runtime Error: Division by zero', line, column);
	}

	/**
	 * Report a stack overflow error
	 */
	stackOverflowError(message?: string, line?: number, column?: number): void {
		const msg = message ? `Runtime Error: ${message}` : 'Runtime Error: Stack overflow';
		this.io.error(msg, line, column);
	}

	/**
	 * Report an index out of bounds error
	 */
	indexError(message?: string, line?: number, column?: number): void {
		const msg = message ? `Runtime Error: ${message}` : 'Runtime Error: Index out of bounds';
		this.io.error(msg, line, column);
	}

	/**
	 * Report a null reference error
	 */
	nullReferenceError(message?: string, line?: number, column?: number): void {
		const msg = message ? `Runtime Error: ${message}` : 'Runtime Error: Null reference';
		this.io.error(msg, line, column);
	}

	/**
	 * Report a generic error
	 */
	error(message: string, line?: number, column?: number): void {
		this.io.error(`Error: ${message}`, line, column);
	}

	/**
	 * Report a warning
	 */
	warning(message: string, line?: number, column?: number): void {
		let warningMessage = `Warning: ${message}`;

		if (line !== undefined) {
			warningMessage += ` at line ${line}`;

			if (column !== undefined) {
				warningMessage += `, column ${column}`;
			}
		}

		this.io.output(warningMessage + '\n');
	}

	/**
	 * Report an informational message
	 */
	info(message: string, line?: number, column?: number): void {
		let infoMessage = `Info: ${message}`;

		if (line !== undefined) {
			infoMessage += ` at line ${line}`;

			if (column !== undefined) {
				infoMessage += `, column ${column}`;
			}
		}

		this.io.output(infoMessage + '\n');
	}
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
	/**
	 * Attempt to recover from a syntax error by finding the next valid statement boundary
	 */
	static findNextStatement(tokens: any[], currentIndex: number): number {
		// Simple implementation: look for common statement starters
		const statementStarters = [
			'DECLARE', 'IF', 'FOR', 'WHILE', 'REPEAT', 'PROCEDURE', 'FUNCTION',
			'INPUT', 'OUTPUT', 'OPENFILE', 'CLOSEFILE', 'RETURN', 'CALL'
		];

		for (let i = currentIndex + 1; i < tokens.length; i++) {
			const token = tokens[i];

			if (token.type === 'NEWLINE' || token.type === 'EOF_TOKEN') {
				// Check the next token after the newline
				if (i + 1 < tokens.length) {
					const nextToken = tokens[i + 1];
					if (statementStarters.includes(nextToken.value)) {
						return i + 1; // Return the index of the statement starter
					}
				}
			}
		}

		return tokens.length - 1; // Return the last token if no recovery point is found
	}

	/**
	 * Suggest possible corrections for common syntax errors
	 */
	static suggestCorrections(error: SyntaxError, tokens: any[]): string[] {
		const suggestions: string[] = [];

		if (error.message.includes('Unexpected token')) {
			// Common corrections for unexpected tokens
			suggestions.push('Check for missing semicolons or other delimiters');
			suggestions.push('Verify that all keywords are spelled correctly');
			suggestions.push('Ensure that all parentheses and brackets are properly matched');
		}

		if (error.message.includes('Expected')) {
			// Common corrections for missing tokens
			suggestions.push('Check for missing keywords or operators');
			suggestions.push('Verify that all statements are properly terminated');
		}

		return suggestions;
	}
}

/**
 * Error location tracking
 */
export interface ErrorLocation {
	line: number;
	column: number;
	fileName?: string;
}

/**
 * Enhanced error with source code context
 */
export class ContextualError extends PseudocodeError {
	constructor(
		message: string,
		public location: ErrorLocation,
		public sourceCode?: string,
		public contextLines: number = 2
	) {
		super(message, location.line, location.column);
	}

	/**
	 * Get the error message with source code context
	 */
	getContextualMessage(): string {
		let result = this.toString();

		if (this.sourceCode && this.location.line) {
			const lines = this.sourceCode.split('\n');
			const startLine = Math.max(1, this.location.line - this.contextLines);
			const endLine = Math.min(lines.length, this.location.line + this.contextLines);

			result += '\n\nSource code context:\n';

			for (let i = startLine; i <= endLine; i++) {
				const lineNum = i.toString().padStart(4, ' ');
				const marker = i === this.location.line ? ' >>>' : '    ';
				result += `${lineNum}${marker} ${lines[i - 1]}\n`;
			}
		}

		return result;
	}
}
