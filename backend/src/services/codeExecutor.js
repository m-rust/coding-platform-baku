import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { acquire, release } from './judgeQueue.js';

const execFileAsync = promisify(execFile);

const MARKER = '__JUDGE__';
const COMPILE_TIME_LIMIT = 10;
const MAX_OUTPUT_BYTES = 1024 * 1024;

const OUTPUT_BLOCK_LIMIT = MAX_OUTPUT_BYTES / 512;

export const LANGUAGES = {
    python: {
        label: 'Python',
        ext: '.py',
        image: 'python-sandbox',
        run: 'python /app/solution.py',
    },
    cpp: {
        label: 'C++',
        ext: '.cpp',
        image: 'cpp-sandbox',
        compile: 'g++ /app/solution.cpp -o /app/solution -std=c++17 -O2',
        run: '/app/solution',
    },
    javascript: {
        label: 'JavaScript',
        ext: '.js',
        image: 'node-sandbox',
        run: 'node /app/solution.js',
    },
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGES);

const wrapCommand = (command, timeLimit) =>
    `s=$(date +%s%N); ` +
    `timeout -s KILL ${timeLimit}s ${command}; rc=$?; ` +
    `e=$(date +%s%N); echo "${MARKER} $rc $(( (e - s) / 1000000 ))" >&2`;

const batchScript = (command, count, timeLimit) =>
    `ulimit -f ${OUTPUT_BLOCK_LIMIT}; ` +
    `i=0; while [ $i -lt ${count} ]; do ` +
    `s=$(date +%s%N); ` +
    `timeout -s KILL ${timeLimit}s ${command} < /app/in/input_$i.txt > /out/out_$i.txt 2> /out/err_$i.txt; rc=$?; ` +
    `e=$(date +%s%N); ` +
    `echo "$i $rc $(( (e - s) / 1000000 ))" >> /out/meta.txt; ` +
    `i=$((i + 1)); done`;

const parseMarker = (stderr) => {
    const lines = String(stderr ?? '').split('\n');
    const index = lines.findLastIndex((line) => line.startsWith(MARKER));

    if (index === -1) return null;

    const [, rc, ms] = lines[index].trim().split(/\s+/);
    lines.splice(index, 1);

    return {
        exitCode: Number(rc),
        runtime: Number(ms),
        stderr: lines.join('\n').trim(),
    };
};

const readFileOrEmpty = async (file) => fs.readFile(file, 'utf8').catch(() => '');

class CodeExecutor {
    constructor() {
        this.submissionsDir = path.join(os.tmpdir(), 'submissions');
    }

    toDockerPath(hostPath) {
        if (os.platform() === 'win32') {
            let dockerPath = hostPath.replace(/\\/g, '/');
            if (dockerPath.match(/^[A-Za-z]:/)) {
                dockerPath = '/' + dockerPath[0].toLowerCase() + dockerPath.substring(2);
            }
            return dockerPath;
        }
        return hostPath;
    }

    async executeCode(code, input, language, timeLimit = 5) {
        const [result] = await this.executeBatch(code, [input], language, timeLimit);
        return result;
    }

    async executeBatch(code, inputs, language, timeLimit = 5) {
        const config = LANGUAGES[language];

        if (!config) {
            throw new Error(`Unsupported language: ${language}`);
        }

        if (!Array.isArray(inputs) || inputs.length === 0) {
            throw new Error('At least one input is required');
        }

        const tempDir = path.join(this.submissionsDir, uuidv4());
        const inDir = path.join(tempDir, 'in');
        const outDir = path.join(tempDir, 'out');

        try {
            await fs.mkdir(inDir, { recursive: true });
            await fs.mkdir(outDir, { recursive: true });

            for (const dir of [tempDir, inDir, outDir]) {
                await fs.chmod(dir, 0o777);
            }

            await fs.writeFile(path.join(tempDir, `solution${config.ext}`), code, 'utf8');

            await Promise.all(
                inputs.map((input, i) =>
                    fs.writeFile(path.join(inDir, `input_${i}.txt`), input ?? '', 'utf8')
                )
            );

            const mount = this.toDockerPath(tempDir);

            if (config.compile) {
                const failure = await this.compile(config, mount);
                if (failure) return inputs.map(() => ({ ...failure }));
            }

            return await this.runBatch(config, {
                mount,
                outMount: this.toDockerPath(outDir),
                outDir,
                count: inputs.length,
                timeLimit,
            });
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
    }

    async compile(config, mount) {
        const result = await this.runContainer({
            image: config.image,
            mounts: [{ host: mount, target: '/app' }],
            memory: '512m',
            timeLimit: COMPILE_TIME_LIMIT,
            script: wrapCommand(config.compile, COMPILE_TIME_LIMIT),
        });

        if (result.status !== 'ok') return this.describeInfrastructureFailure(result);

        if (result.exitCode !== 0) {
            const timedOut = result.exitCode === 137 || result.exitCode === 124;

            return {
                success: false,
                output: '',
                error: timedOut
                    ? 'Compilation timed out'
                    : result.stderr || 'Compilation failed',
                runtime: 0,
                status: 'compilation_error',
            };
        }

        return null;
    }

    async runBatch(config, { mount, outMount, outDir, count, timeLimit }) {
        const result = await this.runContainer({
            image: config.image,
            mounts: [
                { host: mount, target: '/app', readOnly: true },
                { host: outMount, target: '/out' },
            ],
            timeLimit: count * (timeLimit + 2) + 10,
            script: batchScript(config.run, count, timeLimit),
            expectMarker: false,
        });

        if (result.status !== 'ok') {
            const failure = this.describeInfrastructureFailure(result);
            return Array.from({ length: count }, () => ({ ...failure }));
        }

        const meta = new Map();
        const metaText = await readFileOrEmpty(path.join(outDir, 'meta.txt'));

        for (const line of metaText.split('\n')) {
            const [index, rc, ms] = line.trim().split(/\s+/);
            if (index === '' || index === undefined || rc === undefined) continue;
            meta.set(Number(index), { exitCode: Number(rc), runtime: Number(ms) });
        }

        const results = [];

        for (let i = 0; i < count; i++) {
            const entry = meta.get(i);

            if (!entry) {
                results.push(this.describeInfrastructureFailure({ status: 'internal_error' }));
                continue;
            }

            const [stdout, stderr] = await Promise.all([
                readFileOrEmpty(path.join(outDir, `out_${i}.txt`)),
                readFileOrEmpty(path.join(outDir, `err_${i}.txt`)),
            ]);

            results.push(this.describeRun(entry, stdout, stderr, timeLimit));
        }

        return results;
    }

    describeRun({ exitCode, runtime }, stdout, stderr, timeLimit) {
        if (Buffer.byteLength(stdout) >= MAX_OUTPUT_BYTES) {
            return {
                success: false,
                output: '',
                error: 'Output Limit Exceeded (max 1MB)',
                runtime,
                status: 'output_limit_exceeded',
            };
        }

        if (exitCode === 0) {
            return {
                success: true,
                output: stdout.trim(),
                error: stderr.trim() || null,
                runtime,
                status: 'success',
            };
        }

        const killedAtTimeLimit = exitCode === 137 && runtime >= timeLimit * 1000;

        if (exitCode === 124 || killedAtTimeLimit) {
            return {
                success: false,
                output: '',
                error: 'Time Limit Exceeded',
                runtime,
                status: 'time_limit_exceeded',
            };
        }

        if (exitCode === 137) {
            return {
                success: false,
                output: '',
                error: 'Memory Limit Exceeded',
                runtime,
                status: 'memory_limit_exceeded',
            };
        }

        return {
            success: false,
            output: stdout.trim(),
            error: stderr.trim() || `Exited with code ${exitCode}`,
            runtime,
            status: 'runtime_error',
        };
    }

    async runContainer({ image, mounts, script, timeLimit, memory = '256m', expectMarker = true }) {
        const name = `judge-${uuidv4()}`;

        await acquire();

        try {
            return await this.spawnContainer({ name, image, mounts, script, timeLimit, memory, expectMarker });
        } finally {
            release();
        }
    }

    async spawnContainer({ name, image, mounts, script, timeLimit, memory, expectMarker }) {
        const args = [
            'run', '--rm', '--init',
            '--name', name,
            '--network', 'none',
            `--memory=${memory}`,
            `--memory-swap=${memory}`,
            '--cpus=1.0',
            '--pids-limit=64',
            '--ulimit', 'nofile=64:64',
            '--cap-drop=ALL',
            '--security-opt=no-new-privileges',
            '--read-only',
            '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m',
        ];

        for (const { host, target, readOnly } of mounts) {
            args.push('-v', `${host}:${target}${readOnly ? ':ro' : ''}`);
        }

        args.push(image, 'sh', '-c', script);

        let stdout = '';
        let stderr = '';

        try {
            ({ stdout, stderr } = await execFileAsync('docker', args, {
                timeout: (timeLimit + 5) * 1000,
                maxBuffer: MAX_OUTPUT_BYTES,
            }));
        } catch (error) {
            await execFileAsync('docker', ['rm', '-f', name]).catch(() => {});

            if (error.code === 'ERR_CHILD_PROCESS_STDOUT_MAXBUFFER') {
                return { status: 'output_limit_exceeded' };
            }

            console.error(`Judge container failed (${image}):`, error.message);
            return { status: 'internal_error' };
        }

        if (!expectMarker) return { status: 'ok' };

        const marker = parseMarker(stderr);

        if (!marker) {
            console.error(`Judge container produced no result (${image}):`, String(stderr).trim());
            return { status: 'internal_error' };
        }

        return { status: 'ok', stdout, ...marker };
    }

    describeInfrastructureFailure(result) {
        if (result.status === 'output_limit_exceeded') {
            return {
                success: false,
                output: '',
                error: 'Output Limit Exceeded (max 1MB)',
                runtime: 0,
                status: 'output_limit_exceeded',
            };
        }

        return {
            success: false,
            output: '',
            error: 'The judge could not run your code. Please try again.',
            runtime: 0,
            status: 'internal_error',
        };
    }

    compareOutputs(userOutput, expectedOutput) {
        const normalize = (str) =>
            String(str ?? '')
                .replace(/\r\n/g, '\n')
                .trim()
                .split('\n')
                .map((line) => line.trim().replace(/\s+/g, ' '))
                .join('\n');

        return normalize(userOutput) === normalize(expectedOutput);
    }
}

export default new CodeExecutor();
