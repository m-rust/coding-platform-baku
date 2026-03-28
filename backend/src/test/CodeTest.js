import CodeExecutor from '../services/CodeExecutor.js'

async function test() {
    console.log('=== Testing Code Executor ===\n');
    
    // Test 1: Python - Adding two numbers
    console.log('Test 1: Python - Add two numbers');
    const pythonResult = await CodeExecutor.executeCode(
        'a = int(input())\nb = int(input())\nprint(a + b)',
        '5\n3',
        'python',
        5
    );
    console.log('Result:', pythonResult);
    console.log('Output matches "8"?', CodeExecutor.compareOutputs(pythonResult.output, '8'));
    console.log('');
    
    // Test 2: C++ - Adding two numbers
    console.log('Test 2: C++ - Add two numbers');
    const cppCode = `
#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`;
    const cppResult = await CodeExecutor.executeCode(cppCode, '5\n3', 'cpp', 5);
    console.log('Result:', cppResult);
    console.log('Output matches "8"?', CodeExecutor.compareOutputs(cppResult.output, '8'));
    console.log('');
    
    // Test 3: Python - Time Limit Exceeded
    console.log('Test 3: Python - Infinite loop (TLE)');
    const tleResult = await CodeExecutor.executeCode('while True: pass', '', 'python', 2);
    console.log('Result:', tleResult);
    console.log('');
    
    // Test 4: C++ - Compilation Error
    console.log('Test 4: C++ - Compilation error');
    const ceResult = await CodeExecutor.executeCode(
        '#include <iostream>\nint main() { cout << "missing semicolon" }',
        '',
        'cpp',
        5
    );
    console.log('Result:', ceResult);
    console.log('');
    
    console.log('=== All tests completed ===');
}

test().catch(console.error);