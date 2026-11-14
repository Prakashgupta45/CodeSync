export interface LanguageStarterTemplate {
  language: string;
  template: string;
}

export const LANGUAGE_STARTER_TEMPLATES: Record<string, string> = {
  c: `#include <stdio.h>

int main() {
    printf("Hello, CodeSync AI!\\n");
    return 0;
}
`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, CodeSync AI!" << endl;
    return 0;
}
`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, CodeSync AI!");
    }
}
`,
  python: `print("Hello, CodeSync AI!")
`,
  javascript: `console.log("Hello, CodeSync AI!");
`,
  typescript: `console.log("Hello, CodeSync AI!");
`,
  go: `package main

import "fmt"

func main() {
    fmt.Println("Hello, CodeSync AI!")
}
`,
  rust: `fn main() {
    println!("Hello, CodeSync AI!");
}
`,
  csharp: `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, CodeSync AI!");
    }
}
`,
};

export interface LanguageFileConfig {
  filename: string;
  monacoLang: string;
  displayName: string;
}

export const LANGUAGE_FILE_MAP: Record<string, LanguageFileConfig> = {
  c: { filename: 'solution.c', monacoLang: 'c', displayName: 'C' },
  cpp: { filename: 'solution.cpp', monacoLang: 'cpp', displayName: 'C++' },
  java: { filename: 'Main.java', monacoLang: 'java', displayName: 'Java' },
  python: { filename: 'solution.py', monacoLang: 'python', displayName: 'Python' },
  javascript: { filename: 'solution.js', monacoLang: 'javascript', displayName: 'JavaScript' },
  typescript: { filename: 'solution.ts', monacoLang: 'typescript', displayName: 'TypeScript' },
  go: { filename: 'main.go', monacoLang: 'go', displayName: 'Go' },
  rust: { filename: 'main.rs', monacoLang: 'rust', displayName: 'Rust' },
  csharp: { filename: 'Program.cs', monacoLang: 'csharp', displayName: 'C#' },
};

export function normalizeLang(raw?: string): string {
  const l = (raw || '').toLowerCase().trim();
  if (l === 'c++') return 'cpp';
  if (l === 'c#') return 'csharp';
  if (l === 'golang') return 'go';
  if (l === 'rs') return 'rust';
  if (l === 'ts') return 'typescript';
  if (l === 'js') return 'javascript';
  if (l === 'py') return 'python';
  return l || 'typescript';
}

export function getDefaultFilenameForLanguage(lang?: string): string {
  const norm = normalizeLang(lang);
  return LANGUAGE_FILE_MAP[norm]?.filename || 'solution.ts';
}

export function getLanguageForFilename(filename?: string): string | null {
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
}

export function getStarterCode(language?: string): string {
  const norm = normalizeLang(language);
  return LANGUAGE_STARTER_TEMPLATES[norm] || LANGUAGE_STARTER_TEMPLATES.typescript;
}

export function isCodeEmptyOrWhitespace(code?: string): boolean {
  return !code || code.trim().length === 0;
}

export function detectLanguageFromCode(code?: string): string | null {
  if (!code || isCodeEmptyOrWhitespace(code)) return null;

  // C++ markers
  if (
    /#include\s+[<"]iostream[>"]/.test(code) ||
    /\bstd::(?:cout|cin|endl|vector|string|map)\b/.test(code) ||
    /\bcout\s*<</.test(code) ||
    /\busing\s+namespace\s+std\b/.test(code)
  ) {
    return 'cpp';
  }

  // C markers
  if (
    /#include\s+[<"]stdio\.h[>"]/.test(code) ||
    (/\bprintf\s*\(/.test(code) && /#include/.test(code))
  ) {
    return 'c';
  }

  // Java markers
  if (
    /\bSystem\.(?:out|err)\.print/.test(code) ||
    /\bpublic\s+class\s+[a-zA-Z_]/.test(code) ||
    /\bpublic\s+static\s+void\s+main\b/.test(code)
  ) {
    return 'java';
  }

  // Go markers
  if (
    /\bpackage\s+main\b/.test(code) ||
    /\bimport\s+["']fmt["']/.test(code) ||
    /\bfunc\s+main\s*\(/.test(code) ||
    /\bfmt\.(?:Print|Println|Printf)\b/.test(code)
  ) {
    return 'go';
  }

  // Rust markers
  if (
    /\bfn\s+main\s*\(/.test(code) ||
    /\bprintln!\s*\(/.test(code) ||
    /\beprintln!\s*\(/.test(code)
  ) {
    return 'rust';
  }

  // C# markers
  if (
    /\busing\s+System\b/.test(code) ||
    /\bConsole\.(?:WriteLine|Write)\b/.test(code) ||
    (/\bclass\s+Program\b/.test(code) && /\bstatic\s+void\s+Main\b/.test(code))
  ) {
    return 'csharp';
  }

  // Python markers
  if (
    /^(?:def|class|import|from)\s+[a-zA-Z_]/m.test(code) ||
    /if\s+__name__\s*==\s*['"]__main__['"]\s*:/m.test(code) ||
    (/\bprint\s*\(/.test(code) && !/[;{}]/.test(code))
  ) {
    return 'python';
  }

  // TypeScript markers
  if (
    /\b(?:interface|type)\s+[a-zA-Z_]/.test(code) ||
    /:\s*(?:string|number|boolean|any|void)\b/.test(code) ||
    /\bas\s+[a-zA-Z_]/.test(code)
  ) {
    return 'typescript';
  }

  // JavaScript markers
  if (
    /\bconsole\.log\s*\(/.test(code) ||
    /\b(?:const|let|var)\s+[a-zA-Z_]/.test(code) ||
    /\bfunction\s+[a-zA-Z_]/.test(code)
  ) {
    return 'javascript';
  }

  // Generic #include fallback to C++
  if (/#include\s+[<"]/.test(code)) {
    return 'cpp';
  }

  return null;
}

export function checkLanguageMismatch(
  code: string | undefined,
  selectedLanguage: string
): { isMismatch: boolean; detectedLanguage: string | null } {
  if (isCodeEmptyOrWhitespace(code)) {
    return { isMismatch: false, detectedLanguage: null };
  }

  const detected = detectLanguageFromCode(code);
  if (!detected) {
    return { isMismatch: false, detectedLanguage: null };
  }

  const detectedNorm = normalizeLang(detected);
  const selectedNorm = normalizeLang(selectedLanguage);

  if (detectedNorm === selectedNorm) {
    return { isMismatch: false, detectedLanguage: detected };
  }

  // JavaScript and TypeScript can be interchangeable for basic console.log
  if (
    (detectedNorm === 'javascript' && selectedNorm === 'typescript') ||
    (detectedNorm === 'typescript' && selectedNorm === 'javascript')
  ) {
    return { isMismatch: false, detectedLanguage: detected };
  }

  return { isMismatch: true, detectedLanguage: detected };
}
