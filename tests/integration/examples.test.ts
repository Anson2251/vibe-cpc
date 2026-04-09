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
		expectOutput(result, [
			'Both conditions are true',
			'At least one condition is true',
			'Complex condition is true'
		]);
	});

	test('should execute procedures-functions.pseudo example', async () => {
		const code = loadExampleFile('procedures-functions.pseudo');
		const result = await testRunner.runCode(code, ['Alice', '10', '20']);
		expectOutput(result, [
			'Enter your name: ',
			'Welcome, ',
			'Alice',
			'!',
			'Enter first number: ',
			'Enter second number: ',
			'The maximum of ',
			'10',
			' and ',
			'20',
			' is ',
			'20',
			'The sum of the array elements is: ',
			'150'
		]);
	});

	test('should execute simple-procedure.pseudo example', async () => {
		const code = loadExampleFile('simple-procedure.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, 'Hello, world');
	});

	test('should execute test_scope_fix.pseudo example', async () => {
		const code = loadExampleFile('test_scope_fix.pseudo');
		const result = await testRunner.runCode(code);
		expectError(result, 'Undefined variable');
	});

	test('should execute array-file-ops.pseudo example', async () => {
		const code = loadExampleFile('array-file-ops.pseudo');
		const result = await testRunner.runCode(code);
		expectOutput(result, [
			'Array elements: ',
			'2',
			'4',
			'6',
			'8',
			'10',
			'12',
			'14',
			'16',
			'18',
			'20',
			'Sum: ',
			'110',
			'Average: ',
			'11',
			'Results have been written to results.txt'
		]);
	});
});
