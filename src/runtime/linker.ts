import { z } from "zod";
import { Lexer } from "../lexer/lexer";
import { Parser } from "../parser/parser";
import {
    ProgramNode,
    StatementNode,
    ProcedureDeclarationNode,
    FunctionDeclarationNode,
    TypeDeclarationNode,
    SetDeclarationNode,
    ClassDeclarationNode,
} from "../parser/ast-nodes";
import { IOInterface } from "../io/io-interface";

const ImportStatementSchema = z.object({
    type: z.literal("ImportStatement"),
    filePath: z.string(),
});

const ImportExpressionSchema = z.object({
    type: z.literal("ImportExpression"),
    filePath: z.string(),
});

const ExportStatementSchema = z.object({
    type: z.literal("ExportStatement"),
    names: z.array(z.string()),
});

const DeclareStatementSchema = z.object({
    type: z.literal("DeclareStatement"),
    name: z.string(),
    isConstant: z.boolean(),
    initialValue: z.unknown().optional(),
});

type DeclarationNode =
    | ProcedureDeclarationNode
    | FunctionDeclarationNode
    | TypeDeclarationNode
    | SetDeclarationNode
    | ClassDeclarationNode;

function isDeclarationNode(node: StatementNode): node is DeclarationNode {
    return (
        node.type === "ProcedureDeclaration" ||
        node.type === "FunctionDeclaration" ||
        node.type === "TypeDeclaration" ||
        node.type === "SetDeclaration" ||
        node.type === "ClassDeclaration"
    );
}

export interface ImportInfo {
    filePath: string;
    namespace?: string;
    exportedNames: string[];
}

export class Linker {
    private io: IOInterface;
    private importedFiles: Set<string> = new Set();
    private imports: ImportInfo[] = [];

    constructor(io: IOInterface) {
        this.io = io;
    }

    async link(ast: ProgramNode): Promise<ProgramNode> {
        this.imports = [];
        const expandedBody: StatementNode[] = [];

        for (const node of ast.body) {
            if (node.type === "ImportStatement") {
                const parsed = ImportStatementSchema.parse(node);
                const { statements, exportedNames } = await this.expandImport(parsed.filePath);
                this.imports.push({ filePath: parsed.filePath, exportedNames });
                expandedBody.push(...statements);
            } else if (node.type === "DeclareStatement") {
                const parsed = DeclareStatementSchema.parse(node);
                if (parsed.isConstant && parsed.initialValue) {
                    const importResult = ImportExpressionSchema.safeParse(parsed.initialValue);
                    if (importResult.success) {
                        const { statements, exportedNames } = await this.expandImport(
                            importResult.data.filePath,
                        );
                        this.imports.push({
                            filePath: importResult.data.filePath,
                            namespace: parsed.name,
                            exportedNames,
                        });
                        expandedBody.push(...statements);
                        continue;
                    }
                }
                expandedBody.push(node);
            } else if (node.type === "ExportStatement") {
                continue;
            } else {
                expandedBody.push(node);
            }
        }

        return {
            type: "Program",
            body: expandedBody,
            line: ast.line,
            column: ast.column,
        };
    }

    getImports(): ImportInfo[] {
        return this.imports;
    }

    private async expandImport(
        filePath: string,
    ): Promise<{ statements: StatementNode[]; exportedNames: string[] }> {
        const resolvedPath = this.resolvePath(filePath);

        if (this.importedFiles.has(resolvedPath)) {
            return { statements: [], exportedNames: [] };
        }

        this.importedFiles.add(resolvedPath);

        const sourceCode = await this.io.readFile(resolvedPath);
        const lexer = new Lexer(sourceCode);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const parseResult = parser.parse();

        if (parseResult.isErr()) {
            throw new Error(
                `Failed to parse imported file '${filePath}': ${parseResult.error.message}`,
            );
        }

        const importedAst = parseResult.value;

        const exportNames = this.collectExportNames(importedAst);

        const linkedAst = await this.link(importedAst);

        if (exportNames === null) {
            return { statements: [], exportedNames: [] };
        }

        const filtered = this.filterExported(linkedAst.body, exportNames);
        return { statements: filtered, exportedNames: [...exportNames] };
    }

    private collectExportNames(ast: ProgramNode): Set<string> | null {
        const exportNames = new Set<string>();
        let hasExport = false;

        for (const node of ast.body) {
            if (node.type === "ExportStatement") {
                hasExport = true;
                const parsed = ExportStatementSchema.parse(node);
                for (const name of parsed.names) {
                    exportNames.add(name);
                }
            }
        }

        return hasExport ? exportNames : null;
    }

    private filterExported(body: StatementNode[], exportNames: Set<string>): StatementNode[] {
        const result: StatementNode[] = [];

        for (const node of body) {
            if (isDeclarationNode(node) && !exportNames.has(node.name)) {
                continue;
            }
            result.push(node);
        }

        return result;
    }

    private resolvePath(filePath: string): string {
        if (filePath.endsWith(".cpc")) {
            return filePath;
        }
        return filePath + ".cpc";
    }
}
