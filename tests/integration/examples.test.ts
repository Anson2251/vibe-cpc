import { TestRunner, expectOutput, expectError } from '../test-helpers';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Example Programs Tests', () => {
	let testRunner: TestRunner;

	beforeEach(() => {
		testRunner = new TestRunner();
	});

	function loadExampleFile(filename: string): string {
		return readFileSync(join(__dirname, '../../examples', filename), 'utf8');
	}

	test('should execute hello-world.pseudo example', async () => {
		const code = loadExampleFile('hello-world.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, ['Hello, World!']);
	});

	test('should execute factorial.pseudo example', async () => {
		const code = loadExampleFile('factorial.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, '120');
	});

	test('should execute test_if_statements.pseudo example', async () => {
		const code = loadExampleFile('test_if_statements.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, 'x is greater than 5');
	});

	test('should execute procedures-functions.pseudo example', async () => {
		const code = loadExampleFile('procedures-functions.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, ['15', '30']);
	});

	test('should execute simple-procedure.pseudo example', async () => {
		const code = loadExampleFile('simple-procedure.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, 'Hello from procedure!');
	});

	test('should execute test_scope_fix.pseudo example', async () => {
		const code = loadExampleFile('test_scope_fix.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, ['10', '5']);
	});

	test('should execute array-file-ops.pseudo example', async () => {
		const code = loadExampleFile('array-file-ops.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, ['1', '2', '3', '4', '5']);
	});
});
