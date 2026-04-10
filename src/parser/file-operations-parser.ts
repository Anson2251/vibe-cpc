import { TokenType } from '../lexer/tokens';
import {
	ExpressionNode,
	OpenFileNode,
	CloseFileNode,
	ReadFileNode,
	WriteFileNode,
	SeekNode,
	GetRecordNode,
	PutRecordNode
} from './ast-nodes';

export interface FileOperationParserContext {
	previousLine(): number;
	previousColumn(): number;
	expression(): ExpressionNode;
	primary(): ExpressionNode;
	check(type: TokenType): boolean;
	match(type: TokenType): boolean;
	consume(type: TokenType, message: string): { value: unknown };
	consumeNewline(): void;
	error(token: { value: unknown }, message: string): Error;
}

export function parseOpenFileStatement(ctx: FileOperationParserContext): OpenFileNode {
	const line = ctx.previousLine();
	const column = ctx.previousColumn();

	const fileIdentifier = ctx.expression();
	ctx.consume(TokenType.FOR, "Expected 'FOR' after file identifier");

	const modeToken = ctx.consume(TokenType.IDENTIFIER, "Expected file mode: READ, WRITE, APPEND, or RANDOM");
	const modeValue = String(modeToken.value).toUpperCase();
	if (modeValue !== 'READ' && modeValue !== 'WRITE' && modeValue !== 'APPEND' && modeValue !== 'RANDOM') {
		throw ctx.error(modeToken, "Expected file mode: READ, WRITE, APPEND, or RANDOM");
	}

	ctx.consumeNewline();

	return {
		type: 'OpenFile',
		fileIdentifier,
		mode: modeValue,
		line,
		column
	};
}

export function parseCloseFileStatement(ctx: FileOperationParserContext): CloseFileNode {
	const line = ctx.previousLine();
	const column = ctx.previousColumn();

	const fileIdentifier = ctx.expression();
	ctx.consumeNewline();

	return {
		type: 'CloseFile',
		fileIdentifier,
		line,
		column
	};
}

export function parseReadFileStatement(ctx: FileOperationParserContext): ReadFileNode {
	const line = ctx.previousLine();
	const column = ctx.previousColumn();

	const fileIdentifier = ctx.expression();
	ctx.consume(TokenType.COMMA, "Expected ',' after file identifier");
	const target = ctx.primary();
	ctx.consumeNewline();

	return {
		type: 'ReadFile',
		fileIdentifier,
		target,
		line,
		column
	};
}

export function parseWriteFileStatement(ctx: FileOperationParserContext): WriteFileNode {
	const line = ctx.previousLine();
	const column = ctx.previousColumn();

	const fileIdentifier = ctx.expression();
	ctx.consume(TokenType.COMMA, "Expected ',' after file identifier");

	const expressions: ExpressionNode[] = [];
	if (!ctx.check(TokenType.NEWLINE)) {
		do {
			expressions.push(ctx.expression());
		} while (ctx.match(TokenType.COMMA));
	}

	ctx.consumeNewline();

	return {
		type: 'WriteFile',
		fileIdentifier,
		expressions,
		line,
		column
	};
}

export function parseSeekStatement(ctx: FileOperationParserContext): SeekNode {
	const line = ctx.previousLine();
	const column = ctx.previousColumn();

	const fileIdentifier = ctx.expression();
	ctx.consume(TokenType.COMMA, "Expected ',' after file identifier");
	const position = ctx.expression();
	ctx.consumeNewline();

	return {
		type: 'Seek',
		fileIdentifier,
		position,
		line,
		column
	};
}

export function parseGetRecordStatement(ctx: FileOperationParserContext): GetRecordNode {
	const line = ctx.previousLine();
	const column = ctx.previousColumn();

	const fileIdentifier = ctx.expression();
	ctx.consume(TokenType.COMMA, "Expected ',' after file identifier");
	const target = ctx.primary();
	ctx.consumeNewline();

	return {
		type: 'GetRecord',
		fileIdentifier,
		target,
		line,
		column
	};
}

export function parsePutRecordStatement(ctx: FileOperationParserContext): PutRecordNode {
	const line = ctx.previousLine();
	const column = ctx.previousColumn();

	const fileIdentifier = ctx.expression();
	ctx.consume(TokenType.COMMA, "Expected ',' after file identifier");
	const source = ctx.primary();
	ctx.consumeNewline();

	return {
		type: 'PutRecord',
		fileIdentifier,
		source,
		line,
		column
	};
}
