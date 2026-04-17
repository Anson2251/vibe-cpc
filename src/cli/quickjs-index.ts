import * as std from "std";

import { QuickJSCLIAdapter } from "./quickjs-cli-adapter";
export type { CLIInterface, CLIOptions } from "./cli-interface";
export { QuickJSCLIAdapter } from "./quickjs-cli-adapter";

export async function runCLI(args: string[] = scriptArgs.slice(1)): Promise<void> {
    const cli = new QuickJSCLIAdapter();
    const options = cli.parseArguments(args);
    await cli.execute(options);
}

export async function main(): Promise<void> {
    if (!std)
        console.log('Error: stdin & stdout lib not found in QuickJS.\nPlease pass "--std" to qjs.');
    else {
        try {
            await runCLI();
        } catch (error) {
            std.err.puts(
                `Unexpected error: ${error instanceof Error ? error.message : String(error)}\n`,
            );
            std.exit(1);
        }
    }
}

void main();
