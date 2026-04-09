import {
	ExpressionNode,
	OpenFileNode,
	CloseFileNode,
	ReadFileNode,
	WriteFileNode,
	SeekNode,
	GetRecordNode,
	PutRecordNode
} from '../parser/ast-nodes';
import { FileIOError, RuntimeError } from '../errors';
import { RuntimeFileManager } from './file-manager';

export interface FileOperationExecutionContext {
	evaluateExpression(expression: ExpressionNode): Promise<unknown>;
	assignToTarget(target: ExpressionNode, value: unknown, line?: number, column?: number): Promise<void>;
}

export class FileOperationEvaluator {
	constructor(
		private readonly fileManager: RuntimeFileManager,
		private readonly ctx: FileOperationExecutionContext
	) {}

	async openFile(node: OpenFileNode): Promise<void> {
		const fileIdentifier = await this.evaluateFileIdentifier(node.fileIdentifier, node.line, node.column);
		try {
			await this.fileManager.open(fileIdentifier, node.mode);
		} catch (error) {
			throw new FileIOError(`Failed to open file '${fileIdentifier}': ${error instanceof Error ? error.message : 'Unknown error'}`, node.line, node.column);
		}
	}

	async closeFile(node: CloseFileNode): Promise<void> {
		const fileIdentifier = await this.evaluateFileIdentifier(node.fileIdentifier, node.line, node.column);
		try {
			await this.fileManager.close(fileIdentifier);
		} catch (error) {
			throw new FileIOError(`Failed to close file: ${String(error)}`, node.line, node.column);
		}
	}

	async readFile(node: ReadFileNode): Promise<void> {
		const fileIdentifier = await this.evaluateFileIdentifier(node.fileIdentifier, node.line, node.column);
		try {
			const content = this.fileManager.readLine(fileIdentifier);
			await this.ctx.assignToTarget(node.target, content, node.line, node.column);
		} catch (error) {
			throw new FileIOError(`Failed to read file: ${String(error)}`, node.line, node.column);
		}
	}

	async writeFile(node: WriteFileNode): Promise<void> {
		const fileIdentifier = await this.evaluateFileIdentifier(node.fileIdentifier, node.line, node.column);
		try {
			const content: string[] = [];
			for (const expression of node.expressions) {
				const value = await this.ctx.evaluateExpression(expression);
				content.push(String(value));
			}
			this.fileManager.writeLine(fileIdentifier, content.join(''));
		} catch (error) {
			throw new FileIOError(`Failed to write file: ${String(error)}`, node.line, node.column);
		}
	}

	async seek(node: SeekNode): Promise<void> {
		const fileIdentifier = await this.evaluateFileIdentifier(node.fileIdentifier, node.line, node.column);
		const position = await this.ctx.evaluateExpression(node.position);
		try {
			this.fileManager.seek(fileIdentifier, Number(position));
		} catch (error) {
			throw new FileIOError(`Failed to seek in file: ${String(error)}`, node.line, node.column);
		}
	}

	async getRecord(node: GetRecordNode): Promise<void> {
		const fileIdentifier = await this.evaluateFileIdentifier(node.fileIdentifier, node.line, node.column);
		try {
			const record = await this.fileManager.getRecord(fileIdentifier);
			await this.ctx.assignToTarget(node.target, record, node.line, node.column);
		} catch (error) {
			throw new FileIOError(`Failed to get record: ${String(error)}`, node.line, node.column);
		}
	}

	async putRecord(node: PutRecordNode): Promise<void> {
		const fileIdentifier = await this.evaluateFileIdentifier(node.fileIdentifier, node.line, node.column);
		const source = await this.ctx.evaluateExpression(node.source);
		try {
			await this.fileManager.putRecord(fileIdentifier, String(source));
		} catch (error) {
			throw new FileIOError(`Failed to put record: ${String(error)}`, node.line, node.column);
		}
	}

	async evaluateEOFCall(args: ExpressionNode[], line?: number, column?: number): Promise<boolean> {
		if (args.length !== 1) {
			throw new RuntimeError('EOF expects exactly one argument', line, column);
		}
		const identifier = await this.evaluateFileIdentifier(args[0], line, column);
		return this.fileManager.isEOF(identifier);
	}

	private async evaluateFileIdentifier(expression: ExpressionNode, line?: number, column?: number): Promise<string> {
		const value = await this.ctx.evaluateExpression(expression);
		if (typeof value !== 'string') {
			throw new RuntimeError('File identifier must evaluate to STRING', line, column);
		}
		return value;
	}
}
