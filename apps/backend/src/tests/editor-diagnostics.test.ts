import { dockerRunnerService } from '../services/docker-runner.service';

describe('Monaco Editor Language & Diagnostic Routing Tests', () => {
  // Test language & filename helper logic
  const normalizeLang = (raw?: string): string => {
    const l = (raw || '').toLowerCase().trim();
    if (l === 'c++') return 'cpp';
    if (l === 'c#') return 'csharp';
    if (l === 'golang') return 'go';
    if (l === 'rs') return 'rust';
    if (l === 'ts') return 'typescript';
    if (l === 'js') return 'javascript';
    if (l === 'py') return 'python';
    return l || 'typescript';
  };

  const LANGUAGE_FILE_MAP: Record<string, { filename: string; monacoLang: string }> = {
    c: { filename: 'solution.c', monacoLang: 'c' },
    cpp: { filename: 'solution.cpp', monacoLang: 'cpp' },
    java: { filename: 'Main.java', monacoLang: 'java' },
    python: { filename: 'solution.py', monacoLang: 'python' },
    javascript: { filename: 'solution.js', monacoLang: 'javascript' },
    typescript: { filename: 'solution.ts', monacoLang: 'typescript' },
    go: { filename: 'main.go', monacoLang: 'go' },
    rust: { filename: 'main.rs', monacoLang: 'rust' },
    csharp: { filename: 'Program.cs', monacoLang: 'csharp' },
  };

  const getDefaultFilenameForLanguage = (lang?: string): string => {
    const norm = normalizeLang(lang);
    return LANGUAGE_FILE_MAP[norm]?.filename || 'solution.ts';
  };

  const getLanguageForFilename = (filename?: string): string | null => {
    if (!filename) return null;
    const lower = filename.toLowerCase().trim();
    if (lower === 'main.java' || lower.endsWith('.java')) return 'java';
    if (lower === 'main.go' || lower.endsWith('.go')) return 'go';
    if (lower === 'main.rs' || lower.endsWith('.rs')) return 'rust';
    if (lower === 'program.cs' || lower.endsWith('.cs')) return 'csharp';
    if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) return 'cpp';
    if (lower.endsWith('.c') && !lower.endsWith('.cs')) return 'c';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
    return null;
  };

  const getMonacoLanguage = (lang: string, filename?: string): string => {
    if (filename) {
      const derived = getLanguageForFilename(filename);
      if (derived) {
        const normLang = normalizeLang(lang);
        if (normLang && normLang !== 'typescript' && derived === 'typescript' && filename === 'solution.ts') {
          return normLang === 'csharp' ? 'csharp' : normLang;
        }
        return derived === 'csharp' ? 'csharp' : derived;
      }
    }
    const l = normalizeLang(lang);
    return l === 'csharp' ? 'csharp' : (l || 'plaintext');
  };

  const parseCompilerMarkers = (errorOutput: string) => {
    if (!errorOutput) return [];
    const lines = errorOutput.split('\n');
    const markers: Array<{ line: number; column: number; message: string; isWarning: boolean }> = [];
    const gccRegex = /(?:[a-zA-Z0-9_\-\.\/\\]+):(\d+):(?:(\d+):)?\s*(?:fatal )?(error|warning):\s*(.*)/i;

    for (const l of lines) {
      const match = l.match(gccRegex);
      if (match) {
        const rawLine = parseInt(match[1], 10);
        const rawCol = match[2] ? parseInt(match[2], 10) : 1;
        const isWarning = (match[3] || '').toLowerCase() === 'warning';
        const message = match[4]?.trim() || 'Compiler diagnostic';
        markers.push({ line: rawLine, column: rawCol, message, isWarning });
      }
    }
    return markers;
  };

  describe('1. Monaco Language Resolution & File Derivation', () => {
    test('Resolves C++ correctly and maps to solution.cpp', () => {
      expect(normalizeLang('cpp')).toBe('cpp');
      expect(normalizeLang('c++')).toBe('cpp');
      expect(getDefaultFilenameForLanguage('cpp')).toBe('solution.cpp');
      expect(getLanguageForFilename('solution.cpp')).toBe('cpp');
      expect(getMonacoLanguage('cpp', 'solution.cpp')).toBe('cpp');
    });

    test('Prevents false typescript override when filename is solution.ts but language is cpp', () => {
      // Legacy bug: activeFile defaulted to solution.ts, forcing Monaco to typescript
      expect(getMonacoLanguage('cpp', 'solution.ts')).toBe('cpp');
      expect(getMonacoLanguage('python', 'solution.ts')).toBe('python');
      expect(getMonacoLanguage('java', 'solution.ts')).toBe('java');
    });

    test('Resolves Python, Java, and TypeScript correctly', () => {
      expect(getMonacoLanguage('python', 'solution.py')).toBe('python');
      expect(getMonacoLanguage('java', 'Solution.java')).toBe('java');
      expect(getMonacoLanguage('typescript', 'solution.ts')).toBe('typescript');
      expect(getMonacoLanguage('javascript', 'solution.js')).toBe('javascript');
    });
  });

  describe('2. GCC Compiler Error Parsing for Editor Line Markers', () => {
    test('Correctly extracts line, column, and message from g++ error trace', () => {
      const sampleGccError = `solution.cpp:18:12: error: 'ans' was not declared in this scope
   18 |     left = max(left, mp[ch] + 1);
      |            ^~~
solution.cpp:24:5: error: expected ';' before '}' token
   24 |     }
      |     ^`;

      const parsed = parseCompilerMarkers(sampleGccError);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].line).toBe(18);
      expect(parsed[0].column).toBe(12);
      expect(parsed[0].message).toBe("'ans' was not declared in this scope");
      expect(parsed[0].isWarning).toBe(false);

      expect(parsed[1].line).toBe(24);
      expect(parsed[1].column).toBe(5);
      expect(parsed[1].message).toBe("expected ';' before '}' token");
    });
  });

  describe('3. Docker C++ Execution & Compilation Pipeline', () => {
    test('Compiles and executes valid C++ code with 0 compilation errors', async () => {
      const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
      const isImageAvailable = isDockerAvailable && (await dockerRunnerService.verifyImageAvailable('gcc:latest'));
      if (!isDockerAvailable || !isImageAvailable) {
        console.warn("Docker daemon or 'gcc:latest' image not available in test runner; skipping live container execution");
        return;
      }

      const validCppCode = `#include <iostream>
#include <string>
#include <unordered_map>
using namespace std;

int main() {
    unordered_map<char, int> mp;
    string s = "abcabcbb";
    for (char c : s) {
        mp[c]++;
    }
    cout << "PASSED: " << mp.size() << endl;
    return 0;
}`;

      const res = await dockerRunnerService.executeCode(
        'cpp',
        validCppCode
      );

      expect(res.exitCode).toBe(0);
      expect(res.compileError).toBeFalsy();
      expect(res.stdout).toContain('PASSED: 3');
    }, 20000);

    test('Genuine C++ syntax error triggers compiler error without executing', async () => {
      const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
      const isImageAvailable = isDockerAvailable && (await dockerRunnerService.verifyImageAvailable('gcc:latest'));
      if (!isDockerAvailable || !isImageAvailable) {
        console.warn("Docker daemon or 'gcc:latest' image not available in test runner; skipping live container execution");
        return;
      }

      const invalidCppCode = `#include <iostream>
using namespace std;

int main() {
    this_is_an_undefined_token;
    return 0;
}`;

      const res = await dockerRunnerService.executeCode(
        'cpp',
        invalidCppCode
      );

      expect(res.exitCode).not.toBe(0);
      expect(res.compileError || res.stderr).toBeTruthy();
      const errOut = (res.compileError || res.stderr || '').toString();
      expect(errOut).toMatch(/error.*this_is_an_undefined_token/i);

      // Verify that our marker parser extracts this genuine error
      const markers = parseCompilerMarkers(errOut);
      expect(markers.length).toBeGreaterThan(0);
      expect(markers[0].line).toBe(5);
    }, 20000);
  });
});
