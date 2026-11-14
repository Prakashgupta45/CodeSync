import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodeExecutionResultDto } from '@codesync/shared';
import { AppError } from '../middleware/error.middleware';
import { ENV } from '../config/env';

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
    command: (file) => `timeout 5 node /code/${file}`,
    isCompiled: false,
  },
  python: {
    filename: 'main.py',
    image: 'python:3.11-alpine',
    command: (file) => `timeout 5 python3 /code/${file}`,
    isCompiled: false,
  },
  c: {
    filename: 'main.c',
    image: 'gcc:latest',
    command: (file) => `sh -c "gcc -O2 /code/${file} -o /tmp/main && timeout 5 /tmp/main"`,
    isCompiled: true,
  },
  cpp: {
    filename: 'main.cpp',
    image: 'gcc:latest',
    command: (file) => `sh -c "g++ -O2 /code/${file} -o /tmp/main && timeout 5 /tmp/main"`,
    isCompiled: true,
  },
  java: {
    filename: 'Main.java',
    image: 'openjdk:17-alpine',
    command: (file) => `sh -c "javac /code/${file} -d /tmp && timeout 5 java -cp /tmp Main"`,
    isCompiled: true,
  },
  typescript: {
    filename: 'main.ts',
    image: 'node:20-alpine',
    command: (file) => `sh -c "tsc /code/${file} --outDir /tmp && timeout 5 node /tmp/main.js"`,
    isCompiled: true,
  },
  go: {
    filename: 'main.go',
    image: 'golang:1.21-alpine',
    command: (file) => `sh -c "HOME=/tmp GOCACHE=/tmp/gocache GOTMPDIR=/tmp timeout 20 go run /code/${file}"`,
    isCompiled: true,
  },
  rust: {
    filename: 'main.rs',
    image: 'rust:alpine',
    command: (file) => `sh -c "rustc /code/${file} -o /tmp/main && timeout 5 /tmp/main"`,
    isCompiled: true,
  },
  csharp: {
    filename: 'Program.cs',
    image: 'mcr.microsoft.com/dotnet/sdk:8.0-alpine',
    command: (file) =>
      `sh -c "echo '{\\"runtimeOptions\\":{\\"tfm\\":\\"net8.0\\",\\"framework\\":{\\"name\\":\\"Microsoft.NETCore.App\\",\\"version\\":\\"8.0.0\\"}} }' > /tmp/Program.runtimeconfig.json && dotnet /usr/share/dotnet/sdk/8.0.428/Roslyn/bincore/csc.dll -nologo -target:exe -out:/tmp/Program.dll -lib:/usr/share/dotnet/shared/Microsoft.NETCore.App/8.0.34 -r:System.Private.CoreLib.dll -r:System.Runtime.dll -r:System.Console.dll -r:System.Collections.dll -r:System.Linq.dll /code/${file} && timeout 5 dotnet /tmp/Program.dll"`,
    isCompiled: true,
  },
};

export function normalizeExecutionLanguage(language: string): string {
  const l = (language || '').toLowerCase().trim();
  if (l === 'c++') return 'cpp';
  if (l === 'c#') return 'csharp';
  if (l === 'golang') return 'go';
  if (l === 'rs') return 'rust';
  if (l === 'ts') return 'typescript';
  if (l === 'js') return 'javascript';
  if (l === 'py') return 'python';
  return l;
}

export class DockerRunnerService {
  private activeExecutions = 0;
  private waitQueue: Array<() => void> = [];

  private async acquireSlot(): Promise<void> {
    const maxConcurrency = ENV.DOCKER_MAX_CONCURRENCY;
    if (this.activeExecutions < maxConcurrency) {
      this.activeExecutions += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.activeExecutions += 1;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeExecutions = Math.max(0, this.activeExecutions - 1);
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }

  public async verifyDockerAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('docker --version', (error) => {
        resolve(!error);
      });
    });
  }

  public async verifyImageAvailable(image: string): Promise<boolean> {
    return new Promise((resolve) => {
      exec(`docker image inspect ${image}`, (error) => {
        resolve(!error);
      });
    });
  }

  public async executeCode(
    language: string,
    sourceCode: string
  ): Promise<CodeExecutionResultDto> {
    const langKey = normalizeExecutionLanguage(language);
    const spec = LANGUAGE_SPECS[langKey];

    if (!spec) {
      throw new AppError(`Unsupported language: ${language}`, 400, 'UNSUPPORTED_LANGUAGE');
    }

    const isDockerAvailable = await this.verifyDockerAvailable();
    if (!isDockerAvailable) {
      throw new AppError('Docker engine is currently unavailable on host system', 503, 'DOCKER_UNAVAILABLE');
    }

    const isImageAvailable = await this.verifyImageAvailable(spec.image);
    if (!isImageAvailable) {
      throw new AppError(
        `Docker runtime image '${spec.image}' for ${language} is not available on host system. Please provision the image.`,
        503,
        'DOCKER_IMAGE_UNAVAILABLE'
      );
    }

    await this.acquireSlot();

    try {
      // 1. Create temporary isolated directory with world-readable perms for non-root container user
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codesync-exec-'));
      const filePath = path.join(tempDir, spec.filename);
      const containerName = `codesync-exec-${randomUUID().replace(/-/g, '').slice(0, 16)}`;

      fs.writeFileSync(filePath, sourceCode, 'utf8');
      try {
        fs.chmodSync(tempDir, 0o755);
        fs.chmodSync(filePath, 0o644);
      } catch {
        // Ignore on filesystems without POSIX mode bits
      }

      const startTime = Date.now();

      // 2. Hardened Docker execution flags:
      // --name                         : Deterministic handle for forced cleanup on host timeout
      // --rm                           : Auto-remove container on exit
      // --net=none                     : Disable container networking
      // --memory=256m                  : 256MB RAM cap
      // --cpus=0.5                     : 0.5 CPU core cap
      // --pids-limit=128               : Fork-bomb / process exhaustion prevention
      // --cap-drop=ALL                 : Drop all Linux capabilities
      // --security-opt=no-new-privileges: Block privilege escalation inside container
      // --user 65534:65534             : Unprivileged nobody UID/GID
      // --read-only                    : Immutable root filesystem
      // --tmpfs /tmp:...,mode=1777     : Ephemeral writable/exec scratch space for compiled binaries
      // -v hostPath:/code:ro           : Read-only mount for user source code
      const dockerCmd =
        `docker run --name ${containerName} --rm --net=none --memory=256m --cpus=1.5 ` +
        `--pids-limit=128 --cap-drop=ALL --security-opt=no-new-privileges --user 65534:65534 ` +
        `--read-only --tmpfs /tmp:rw,exec,nosuid,mode=1777,size=64m ` +
        `-v "${tempDir}:/code:ro" ${spec.image} ${spec.command(spec.filename)}`;

      const hostTimeoutMs = spec.isCompiled ? 25000 : 12000;

      return await new Promise<CodeExecutionResultDto>((resolve) => {
        exec(dockerCmd, { timeout: hostTimeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
          const executionTimeMs = Date.now() - startTime;

          // Deterministically kill & remove orphaned container if host watchdog fired
          if (error && error.killed) {
            exec(`docker rm -f ${containerName}`, () => {});
          }

          // Clean up temporary local source directory
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (_) {}

          const rawExitCode = error ? (error.code ?? 1) : 0;
          // GNU timeout returns 124 on timeout; Busybox returns 143 (SIGTERM) or error.killed
          const isTimedOut = rawExitCode === 124 || rawExitCode === 143 || Boolean(error && error.killed);

          if (isTimedOut) {
            return resolve({
              stdout: stdout.trim(),
              stderr: 'Execution timed out after 5.0 seconds',
              exitCode: 124,
              runtimeError: 'EXECUTION_TIMEOUT',
              executionTimeMs: Math.max(5000, executionTimeMs),
              timedOut: true,
            });
          }

          let compileError: string | null = null;
          let runtimeError: string | null = null;

          if (error) {
            const errStr = stderr.trim() || error.message;
            if (
              spec.isCompiled &&
              (errStr.includes('g++') ||
                errStr.includes('javac') ||
                errStr.includes('tsc') ||
                errStr.includes('error:') ||
                errStr.includes('syntax error') ||
                errStr.includes('Cannot find module'))
            ) {
              compileError = errStr;
            } else {
              runtimeError = errStr;
            }
          }

          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: rawExitCode,
            compileError,
            runtimeError,
            executionTimeMs,
            timedOut: false,
          });
        });
      });
    } finally {
      this.releaseSlot();
    }
  }
}

export const dockerRunnerService = new DockerRunnerService();
