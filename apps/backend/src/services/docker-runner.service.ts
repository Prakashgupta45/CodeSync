import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodeExecutionResultDto } from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';

interface LanguageSpec {
  filename: string;
  image: string;
  command: (filename: string) => string;
  isCompiled?: boolean;
}

const LANGUAGE_SPECS: Record<string, LanguageSpec> = {
  javascript: {
    filename: 'main.js',
    image: 'node:20-alpine',
    command: (file) => `node /code/${file}`,
    isCompiled: false,
  },
  python: {
    filename: 'main.py',
    image: 'python:3.11-alpine',
    command: (file) => `python3 /code/${file}`,
    isCompiled: false,
  },
  cpp: {
    filename: 'main.cpp',
    image: 'gcc:latest',
    command: (file) => `sh -c "g++ /code/${file} -o /tmp/main && /tmp/main"`,
    isCompiled: true,
  },
  java: {
    filename: 'Main.java',
    image: 'openjdk:17-alpine',
    command: (file) => `sh -c "javac /code/${file} -d /tmp && java -cp /tmp Main"`,
    isCompiled: true,
  },
  typescript: {
    filename: 'main.ts',
    image: 'node:20-alpine',
    command: (file) => `sh -c "npx -p typescript tsc /code/${file} --outDir /tmp && node /tmp/main.js"`,
    isCompiled: true,
  },
};

export class DockerRunnerService {
  private timeoutMs = 5000; // 5-second hard execution timeout

  public async verifyDockerAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('docker --version', (error) => {
        resolve(!error);
      });
    });
  }

  public async executeCode(
    language: string,
    sourceCode: string
  ): Promise<CodeExecutionResultDto> {
    const langKey = language.toLowerCase();
    const spec = LANGUAGE_SPECS[langKey];

    if (!spec) {
      throw new AppError(`Unsupported language: ${language}`, 400, 'UNSUPPORTED_LANGUAGE');
    }

    const isDockerAvailable = await this.verifyDockerAvailable();
    if (!isDockerAvailable) {
      throw new AppError('Docker engine is currently unavailable on host system', 503, 'DOCKER_UNAVAILABLE');
    }

    // 1. Create temporary isolated directory for source file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesync-exec-'));
    const filePath = path.join(tempDir, spec.filename);

    fs.writeFileSync(filePath, sourceCode, 'utf8');

    const startTime = Date.now();

    // 2. Prepare Docker execution command with strict security isolation flags
    // --net=none                          : No container network access
    // --memory=128m                       : 128MB RAM limit
    // --cpus=0.5                          : 0.5 CPU core limit
    // --read-only                         : Read-only container root filesystem
    // --tmpfs /tmp:rw,exec,nosuid,size=64m: Ephemeral temporary memory space for compiler binaries
    // --rm                                : Auto-remove container on exit
    // -v hostPath:code:ro                 : Mount temp source directory read-only
    const dockerCmd = `docker run --rm --net=none --memory=128m --cpus=0.5 --read-only --tmpfs /tmp:rw,exec,nosuid,size=64m -v "${tempDir}:/code:ro" ${spec.image} ${spec.command(spec.filename)}`;

    return new Promise<CodeExecutionResultDto>((resolve) => {
      let isTimedOut = false;

      exec(dockerCmd, { timeout: this.timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;

        // Clean up temporary local source directory
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (_) {}

        if (error && error.killed) {
          isTimedOut = true;
          return resolve({
            stdout: stdout.trim(),
            stderr: 'Execution timed out after 5.0 seconds',
            exitCode: 124,
            runtimeError: 'EXECUTION_TIMEOUT',
            executionTimeMs,
            timedOut: true,
          });
        }

        let compileError: string | null = null;
        let runtimeError: string | null = null;

        if (error) {
          const errStr = stderr.trim() || error.message;
          if (spec.isCompiled && (errStr.includes('g++') || errStr.includes('javac') || errStr.includes('tsc') || errStr.includes('error:'))) {
            compileError = errStr;
          } else {
            runtimeError = errStr;
          }
        }

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: error ? (error.code ?? 1) : 0,
          compileError,
          runtimeError,
          executionTimeMs,
          timedOut: isTimedOut,
        });
      });
    });
  }
}

export const dockerRunnerService = new DockerRunnerService();
