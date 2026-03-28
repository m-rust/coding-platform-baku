import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

const execPromise = promisify(exec);

class CodeExecutor {
    constructor() {
        this.submissionsDir = path.join(os.tmpdir(), 'submissions');
    }

    toDockerPath(windowsPath) {
        if (os.platform() === 'win32') {
            let dockerPath = windowsPath.replace(/\\/g, '/');
            if (dockerPath.match(/^[A-Za-z]:/)) {
                dockerPath = '/' + dockerPath[0].toLowerCase() + dockerPath.substring(2);
            }
            return dockerPath;
        }
        return windowsPath;
    }

    async executeCode(code, input, language, timeLimit = 5) {
        const submissionId = uuidv4();
        const tempDir = path.join(this.submissionsDir, submissionId);
        
        try {
            // recusrsive : truecreates entire directory path, if it is not present
            await fs.mkdir(tempDir, { recursive: true });
            console.log(`Created temp directory: ${tempDir}`);
            
            await this.writeFiles(tempDir, code, input, language);
            
            let result;
            if (language === 'python') {
                result = await this.executePython(tempDir, timeLimit);
            } else if (language === 'cpp') {
                result = await this.executeCpp(tempDir, timeLimit);
            } else {
                throw new Error(`Unsupported language: ${language}`);
            }
            
            await fs.rm(tempDir, { recursive: true, force: true });
            console.log(`Cleaned up: ${tempDir}`);
            
            return result;
            
        } catch (error) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
            throw error;
        }
    }

    async writeFiles(tempDir, code, input, language) {
        const ext = language === 'python' ? '.py' : '.cpp';
        const codeFile = `solution${ext}`;
        
        const codePath = path.join(tempDir, codeFile);
        await fs.writeFile(codePath, code, 'utf8');
        console.log(`Wrote code file: ${codePath}`);
        
        const inputPath = path.join(tempDir, 'input.txt');
        await fs.writeFile(inputPath, input, 'utf8');
        console.log(`Wrote input file: ${inputPath}`);
    }

    async executePython(tempDir, timeLimit) {
        console.log('Executing Python code...');
        
        const dockerPath = this.toDockerPath(tempDir);
        
        // Use sh -c to redirect input from file inside container
        const dockerCmd = [
            'docker run',
            '--rm',
            '--network none',
            '--memory="256m"',
            '--memory-swap="256m"',
            '--cpus="1.0"',
            '--pids-limit=50',
            '--ulimit nofile=64:64',
            '--ulimit nproc=50:50',
            '--read-only',
            '--tmpfs /tmp:rw,noexec,nosuid,size=10m',
            `-v "${dockerPath}:/app:ro"`,
            'python-sandbox',
            'sh', '-c',
            `"timeout ${timeLimit}s python /app/solution.py < /app/input.txt"`
        ].join(' ');
        
        return await this.runCommand(dockerCmd, timeLimit);
    }

    async executeCpp(tempDir, timeLimit) {
        console.log('Executing C++ code...');
        
        const dockerPath = this.toDockerPath(tempDir);
        
        // STEP 1: Compile
        console.log('Step 1: Compiling...');
        
        const compileCmd = [
            'docker run',
            '--rm',
            '--network none',
            '--memory="512m"',
            '--cpus="1.0"',
            `-v "${dockerPath}:/app"`,
            'cpp-sandbox',
            'sh', '-c',
            '"g++ /app/solution.cpp -o /app/solution -std=c++17 -O2 2>&1"'
        ].join(' ');
        
        try {
            const startCompile = Date.now();
            
            const { stdout, stderr } = await execPromise(compileCmd, {
                timeout: 10000,
                maxBuffer: 1024 * 1024,
                shell: os.platform() === 'win32' ? 'cmd.exe' : '/bin/sh'
            });
            
            const compileTime = Date.now() - startCompile;
            console.log(`Compilation successful (${compileTime}ms)`);
            
            if (stdout || stderr) {
                console.log('Compiler output:', stdout || stderr);
            }
            
        } catch (error) {
            console.log('Compilation failed');
            return {
                success: false,
                output: '',
                error: error.stdout || error.stderr || 'Compilation failed',
                runtime: 0,
                status: 'compilation_error'
            };
        }
        
        // STEP 2: Run with input redirection inside container
        console.log('Step 2: Running executable...');
        
        const runCmd = [
            'docker run',
            '--rm',
            '--network none',
            '--memory="256m"',
            '--memory-swap="256m"',
            '--cpus="1.0"',
            '--pids-limit=50',
            '--ulimit nofile=64:64',
            '--ulimit nproc=50:50',
            '--read-only',
            '--tmpfs /tmp:rw,noexec,nosuid,size=10m',
            `-v "${dockerPath}:/app:ro"`,
            'cpp-sandbox',
            'sh', '-c',
            `"timeout ${timeLimit}s /app/solution < /app/input.txt"`
        ].join(' ');
        
        return await this.runCommand(runCmd, timeLimit);
    }

    async runCommand(cmd, timeLimit) {
        try {
            const startTime = Date.now();
            
            const { stdout, stderr } = await execPromise(cmd, {
                timeout: (timeLimit + 2) * 1000,
                maxBuffer: 1024 * 1024,
                shell: os.platform() === 'win32' ? 'cmd.exe' : '/bin/sh'
            });
            
            const runtime = Date.now() - startTime;
            console.log(`Execution completed in ${runtime}ms`);
            
            return {
                success: true,
                output: stdout.trim(),
                error: stderr ? stderr.trim() : null,
                runtime: runtime,
                status: 'success'
            };
            
        } catch (error) {
            console.log('Execution error:', error.message);
            
            if (error.killed || error.signal === 'SIGTERM') {
                return {
                    success: false,
                    output: '',
                    error: 'Time Limit Exceeded',
                    runtime: timeLimit * 1000,
                    status: 'time_limit_exceeded'
                };
            }
            
            if (error.code === 'ERR_CHILD_PROCESS_STDOUT_MAXBUFFER') {
                return {
                    success: false,
                    output: '',
                    error: 'Output Limit Exceeded (max 1MB)',
                    runtime: 0,
                    status: 'output_limit_exceeded'
                };
            }
            
            return {
                success: false,
                output: error.stdout ? error.stdout.trim() : '',
                error: error.stderr ? error.stderr.trim() : error.message,
                runtime: 0,
                status: 'runtime_error'
            };
        }
    }

    compareOutputs(userOutput, expectedOutput) {
        const normalize = (str) => {
            return str
                .trim()
                .replace(/\s+/g, ' ')
                .replace(/\r\n/g, '\n');
        };
        
        const normalizedUser = normalize(userOutput);
        const normalizedExpected = normalize(expectedOutput);
        
        return normalizedUser === normalizedExpected;
    }
}

export default new CodeExecutor();