/**
 * Universal Test Harness & Driver Generator for CodeSync AI
 * Supports C++, Python, JavaScript, TypeScript, and Java across library and custom problems
 */

export interface DriverFunctionSignature {
  functionName: string;
  returnType: string;
  parameters: Array<{ name: string; type: string }>;
}

export interface ParsedTestCaseInput {
  nums: number[];
  target: number;
}

export function parseTwoSumInput(inputStr: string): ParsedTestCaseInput | null {
  const numsMatch = inputStr.match(/nums\s*=\s*\[([^\]]*)\]/);
  const targetMatch = inputStr.match(/target\s*=\s*(-?\d+)/);
  if (!numsMatch || !targetMatch) return null;

  const nums = numsMatch[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
  const target = Number(targetMatch[1]);
  return { nums, target };
}

export function parseArrayInput(inputStr: string, paramName: string = 'nums'): number[] {
  const escapedName = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namedBracket = new RegExp(`${escapedName}\\s*=\\s*\\[([^\\]]*)\\]`);
  const match = inputStr.match(namedBracket) || inputStr.match(/\[([^\]]*)\]/);
  if (match) {
    return match[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
  }

  // Fallback for arrow notation e.g. "head = 1 -> 2 -> 3"
  if (inputStr.includes('->')) {
    const cleaned = inputStr.replace(/^[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*/, '').trim();
    if (/^[\d\s\->,-]+$/.test(cleaned)) {
      return cleaned
        .split('->')
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
    }
  }

  return [];
}

export function parseStringInput(inputStr: string, paramName: string = 's'): string {
  const escapedName = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escapedName}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const match = inputStr.match(regex) || inputStr.match(/"((?:[^"\\]|\\.)*)"/);
  if (match) return match[1].replace(/\\"/g, '"');
  const stripped = inputStr.replace(new RegExp(`^${escapedName}\\s*=\\s*`), '').trim();
  return stripped.replace(/^['"]|['"]$/g, '');
}

export function parseIntegerInput(inputStr: string, paramName: string = 'target'): number | null {
  const escapedName = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escapedName}\\s*=\\s*(-?\\d+)`);
  const match = inputStr.match(regex);
  return match ? Number(match[1]) : null;
}

type ParsedArgValue = number | boolean | string | number[] | string[][] | number[][];

interface ParsedArg {
  name: string;
  type: 'int' | 'int[]' | 'string' | 'boolean' | 'ListNode' | 'char[][]' | 'int[][]';
  value: ParsedArgValue;
}

function splitTopLevelAssignments(inputStr: string): Array<{ name: string; rawVal: string }> {
  const results: Array<{ name: string; rawVal: string }> = [];
  const trimmed = (inputStr || '').trim();
  if (!trimmed) return results;

  const segments: string[] = [];
  let depth = 0;
  let inQuote: string | null = null;
  let start = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inQuote) {
      if (ch === inQuote && trimmed[i - 1] !== '\\') {
        inQuote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === '[' || ch === '{' || ch === '(') {
      depth++;
    } else if (ch === ']' || ch === '}' || ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (ch === ',' && depth === 0) {
      segments.push(trimmed.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = trimmed.slice(start).trim();
  if (tail) segments.push(tail);

  for (let idx = 0; idx < segments.length; idx++) {
    const seg = segments[idx];
    const eqIdx = seg.indexOf('=');
    if (eqIdx > 0 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(seg.slice(0, eqIdx).trim())) {
      results.push({
        name: seg.slice(0, eqIdx).trim(),
        rawVal: seg.slice(eqIdx + 1).trim(),
      });
    } else {
      results.push({
        name: `arg${idx}`,
        rawVal: seg,
      });
    }
  }
  return results;
}

function inferLiteralArg(rawVal: string, hintedType?: string, paramName?: string): {
  type: ParsedArg['type'];
  value: ParsedArgValue;
} {
  const val = rawVal.trim();
  const h = (hintedType || '').toLowerCase();

  if (h === 'listnode' || paramName === 'head') {
    const nums = parseArrayInput(val.startsWith('[') || val.includes('->') ? val : `[${val}]`);
    return { type: 'ListNode', value: nums };
  }

  if (val === 'true' || val === 'false' || h === 'boolean' || h === 'bool') {
    return { type: 'boolean', value: val.toLowerCase() === 'true' };
  }

  if (val.startsWith('[[')) {
    try {
      const parsed = JSON.parse(val.replace(/'/g, '"'));
      if (Array.isArray(parsed)) {
        const isChar =
          h === 'char[][]' ||
          (Array.isArray(parsed[0]) && typeof parsed[0][0] === 'string');
        return {
          type: isChar ? 'char[][]' : 'int[][]',
          value: parsed,
        };
      }
    } catch (_) {}
  }

  if (val.startsWith('[')) {
    const arr = parseArrayInput(val);
    return { type: 'int[]', value: arr };
  }

  if (val.startsWith('"') || val.startsWith("'") || h === 'string' || h === 'str') {
    return { type: 'string', value: parseStringInput(val) };
  }

  if (/^-?\d+$/.test(val) || h === 'int' || h === 'number') {
    return { type: 'int', value: Number(val) || 0 };
  }

  if (val.includes('->')) {
    return { type: 'ListNode', value: parseArrayInput(val) };
  }

  return { type: 'string', value: val };
}

function detectMethodName(
  rawCode: string,
  problemId: string,
  functionSignature?: DriverFunctionSignature
): string {
  if (functionSignature?.functionName) return functionSignature.functionName;
  if (problemId === 'q-two-sum' || /\btwoSum\b/.test(rawCode)) return 'twoSum';
  if (problemId === 'q-longest-increasing-subsequence' || /\blongestIncreasingSubsequence\b/.test(rawCode))
    return 'longestIncreasingSubsequence';
  if (problemId === 'q-reverse-linked-list' || /\breverseList\b/.test(rawCode)) return 'reverseList';
  if (problemId === 'q-maximum-subarray' || /\bmaxSubArray\b/.test(rawCode)) return 'maxSubArray';
  if (problemId === 'q-longest-substring' || /\blengthOfLongestSubstring\b/.test(rawCode))
    return 'lengthOfLongestSubstring';
  if (problemId === 'q-valid-parentheses' || /\bisValid\b/.test(rawCode)) return 'isValid';
  if (problemId === 'q-number-of-islands' || /\bnumIslands\b/.test(rawCode)) return 'numIslands';
  if (problemId === 'q-binary-search') return 'search';

  const pyMatch = rawCode.match(/def\s+([a-zA-Z0-9_]+)\s*\(/);
  if (pyMatch?.[1] && pyMatch[1] !== '__init__') return pyMatch[1];

  const jsMatch = rawCode.match(/(?:function\s+|var\s+|const\s+|let\s+)([a-zA-Z0-9_]+)\s*(?:=|\()/);
  if (jsMatch?.[1] && jsMatch[1] !== 'Solution' && jsMatch[1] !== 'ListNode') return jsMatch[1];

  const cLikeMatch = rawCode.match(
    /(?:public\s+|private\s+)?(?:static\s+)?(?:vector<[^>]+>|ListNode\*?|string|String|boolean|bool|int\[\]|int|void|double|long)\s+([a-zA-Z0-9_]+)\s*\(/
  );
  if (cLikeMatch?.[1] && cLikeMatch[1] !== 'Solution' && cLikeMatch[1] !== 'main') {
    return cLikeMatch[1];
  }
  return '';
}

function escapeCString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function buildMissingCppHeaders(rawCode: string): string {
  const needed = [
    ['<iostream>', '#include <iostream>'],
    ['<vector>', '#include <vector>'],
    ['<string>', '#include <string>'],
    ['<unordered_map>', '#include <unordered_map>'],
    ['<unordered_set>', '#include <unordered_set>'],
    ['<algorithm>', '#include <algorithm>'],
    ['<stack>', '#include <stack>'],
    ['<queue>', '#include <queue>'],
    ['<climits>', '#include <climits>'],
  ];
  const hasBits = rawCode.includes('<bits/stdc++.h>');
  const lines = hasBits
    ? []
    : needed.filter(([h]) => !rawCode.includes(h)).map(([, inc]) => inc);
  if (!rawCode.includes('using namespace std;')) {
    lines.push('using namespace std;');
  }
  return lines.join('\n');
}

function inferReturnType(
  rawCode: string,
  methodName: string,
  problemId: string,
  functionSignature?: DriverFunctionSignature
): 'int' | 'int[]' | 'string' | 'boolean' | 'ListNode' | 'void' {
  if (functionSignature?.returnType) {
    const rt = functionSignature.returnType;
    if (rt === 'int[]' || rt === 'boolean' || rt === 'string' || rt === 'ListNode' || rt === 'void') {
      return rt;
    }
    return 'int';
  }
  if (problemId === 'q-two-sum' || methodName === 'twoSum') return 'int[]';
  if (problemId === 'q-reverse-linked-list' || methodName === 'reverseList') return 'ListNode';
  if (problemId === 'q-valid-parentheses' || methodName === 'isValid') return 'boolean';

  // Inspect signature in code
  if (new RegExp(`(?:vector<int>|int\\[\\]|List\\[int\\]|number\\[\\])\\s*.*\\b${methodName}\\b`).test(rawCode)) {
    return 'int[]';
  }
  if (new RegExp(`\\b(?:bool|boolean)\\b[^\\n]*\\b${methodName}\\b|def\\s+${methodName}\\([^)]*\\)\\s*->\\s*bool`).test(rawCode)) {
    return 'boolean';
  }
  if (new RegExp(`ListNode`).test(rawCode) && methodName.toLowerCase().includes('list')) {
    return 'ListNode';
  }
  return 'int';
}

export function generateTestDriver(
  rawCode: string,
  language: string,
  problemId: string,
  inputStr: string,
  functionSignature?: DriverFunctionSignature
): string {
  const lang = (language || '').toLowerCase();

  // If code already contains a standalone main entrypoint, execute it as-is
  if (
    /\bint\s+main\s*\(/.test(rawCode) ||
    /\bmain\s*\(\s*\)\s*\{/.test(rawCode) ||
    rawCode.includes("__name__ == '__main__'") ||
    rawCode.includes('__name__ == "__main__"') ||
    rawCode.includes('public static void main')
  ) {
    return rawCode;
  }

  const detectedMethod = detectMethodName(rawCode, problemId, functionSignature);
  if (!detectedMethod) {
    // Fallback if code has no recognizable function
    switch (lang) {
      case 'cpp':
        return `${buildMissingCppHeaders(rawCode)}\n${rawCode}\nint main() { return 0; }`;
      case 'java':
        return `${rawCode}\npublic class Main { public static void main(String[] args) {} }`;
      default:
        return rawCode;
    }
  }

  const returnType = inferReturnType(rawCode, detectedMethod, problemId, functionSignature);
  const rawAssignments = splitTopLevelAssignments(inputStr);
  const sigParams = functionSignature?.parameters || [];

  const parsedArgs: ParsedArg[] = rawAssignments.map((seg, i) => {
    const matchingSig =
      sigParams.find((p) => p.name === seg.name) || sigParams[i];
    const argName = matchingSig?.name || (seg.name.startsWith('arg') ? `p${i}` : seg.name);
    const inferred = inferLiteralArg(seg.rawVal, matchingSig?.type, argName);
    return {
      name: argName,
      type: inferred.type,
      value: inferred.value,
    };
  });

  // Ensure parameter count aligns if functionSignature specifies one array/head/string parameter
  if (parsedArgs.length === 0 && sigParams.length > 0) {
    for (let i = 0; i < sigParams.length; i++) {
      const p = sigParams[i];
      if (p.type === 'int[]' || p.type === 'ListNode') {
        parsedArgs.push({ name: p.name, type: p.type, value: parseArrayInput(inputStr, p.name) });
      } else if (p.type === 'string') {
        parsedArgs.push({ name: p.name, type: 'string', value: parseStringInput(inputStr, p.name) });
      } else if (p.type === 'boolean') {
        parsedArgs.push({ name: p.name, type: 'boolean', value: false });
      } else {
        parsedArgs.push({ name: p.name, type: 'int', value: parseIntegerInput(inputStr, p.name) ?? 0 });
      }
    }
  }

  const needsListNode =
    returnType === 'ListNode' || parsedArgs.some((a) => a.type === 'ListNode');
  const argVars = parsedArgs.map((a, i) => `${a.name || `p${i}`}`);

  switch (lang) {
    case 'cpp': {
      const headerPrefix = buildMissingCppHeaders(rawCode);
      const listNodeDef =
        needsListNode && !rawCode.includes('struct ListNode')
          ? `struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};`
          : '';

      const decls = parsedArgs
        .map((a, i) => {
          const v = argVars[i];
          switch (a.type) {
            case 'int[]':
              return `    std::vector<int> ${v} = {${(a.value as number[]).join(', ')}};`;
            case 'int':
              return `    int ${v} = ${Number(a.value) || 0};`;
            case 'boolean':
              return `    bool ${v} = ${a.value ? 'true' : 'false'};`;
            case 'string':
              return `    std::string ${v} = "${escapeCString(String(a.value))}";`;
            case 'char[][]': {
              const rows = (a.value as string[][])
                .map((r) => `{${r.map((c) => `'${String(c).charAt(0) || '0'}'`).join(', ')}}`)
                .join(', ');
              return `    std::vector<std::vector<char>> ${v} = {${rows}};`;
            }
            case 'int[][]': {
              const rows = (a.value as number[][]).map((r) => `{${r.join(', ')}}`).join(', ');
              return `    std::vector<std::vector<int>> ${v} = {${rows}};`;
            }
            case 'ListNode': {
              const vals = (a.value as number[]).join(', ');
              return `    std::vector<int> ${v}_vals = {${vals}};
    ListNode* ${v} = nullptr;
    ListNode* ${v}_tail = nullptr;
    for (int v : ${v}_vals) {
        ListNode* node = new ListNode(v);
        if (!${v}) { ${v} = node; ${v}_tail = node; }
        else { ${v}_tail->next = node; ${v}_tail = node; }
    }`;
            }
          }
        })
        .join('\n');

      let printBlock = '';
      if (returnType === 'int[]') {
        printBlock = `    std::vector<int> res = sol.${detectedMethod}(${argVars.join(', ')});
    std::cout << "[";
    for (size_t i = 0; i < res.size(); ++i) {
        std::cout << res[i] << (i + 1 < res.size() ? ", " : "");
    }
    std::cout << "]" << std::endl;`;
      } else if (returnType === 'boolean') {
        printBlock = `    bool res = sol.${detectedMethod}(${argVars.join(', ')});
    std::cout << (res ? "true" : "false") << std::endl;`;
      } else if (returnType === 'ListNode') {
        printBlock = `    ListNode* res = sol.${detectedMethod}(${argVars.join(', ')});
    std::cout << "[";
    bool first = true;
    while (res) {
        if (!first) std::cout << ", ";
        std::cout << res->val;
        first = false;
        res = res->next;
    }
    std::cout << "]" << std::endl;`;
      } else if (returnType === 'void') {
        printBlock = `    sol.${detectedMethod}(${argVars.join(', ')});
    std::cout << "void" << std::endl;`;
      } else {
        printBlock = `    auto res = sol.${detectedMethod}(${argVars.join(', ')});
    std::cout << res << std::endl;`;
      }

      return `${headerPrefix}\n${listNodeDef}\n${rawCode}\n
int main() {
    Solution sol;
${decls}
${printBlock}
    return 0;
}`;
    }

    case 'java': {
      const importLines: string[] = ['import java.util.*;'];
      const cleanedRawCode = rawCode
        .split('\n')
        .filter((line) => {
          const t = line.trim();
          if (t.startsWith('import ') && t.endsWith(';')) {
            if (!importLines.includes(t)) importLines.push(t);
            return false;
          }
          return true;
        })
        .join('\n');
      const importBlock = `${importLines.join('\n')}\n`;
      const listNodeDef =
        needsListNode && !cleanedRawCode.includes('class ListNode')
          ? `class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}`
          : '';

      const decls = parsedArgs
        .map((a, i) => {
          const v = argVars[i];
          switch (a.type) {
            case 'int[]':
              return `        int[] ${v} = new int[]{${(a.value as number[]).join(', ')}};`;
            case 'int':
              return `        int ${v} = ${Number(a.value) || 0};`;
            case 'boolean':
              return `        boolean ${v} = ${a.value ? 'true' : 'false'};`;
            case 'string':
              return `        String ${v} = "${escapeCString(String(a.value))}";`;
            case 'char[][]': {
              const rows = (a.value as string[][])
                .map((r) => `{${r.map((c) => `'${String(c).charAt(0) || '0'}'`).join(', ')}}`)
                .join(', ');
              return `        char[][] ${v} = new char[][]{${rows}};`;
            }
            case 'int[][]': {
              const rows = (a.value as number[][]).map((r) => `{${r.join(', ')}}`).join(', ');
              return `        int[][] ${v} = new int[][]{${rows}};`;
            }
            case 'ListNode': {
              const vals = (a.value as number[]).join(', ');
              return `        int[] ${v}_vals = new int[]{${vals}};
        ListNode ${v} = null;
        ListNode ${v}_tail = null;
        for (int v : ${v}_vals) {
            ListNode node = new ListNode(v);
            if (${v} == null) { ${v} = node; ${v}_tail = node; }
            else { ${v}_tail.next = node; ${v}_tail = node; }
        }`;
            }
          }
        })
        .join('\n');

      let printBlock = '';
      if (returnType === 'int[]') {
        printBlock = `        int[] res = sol.${detectedMethod}(${argVars.join(', ')});
        if (res == null) {
            System.out.println("[]");
        } else {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < res.length; i++) {
                sb.append(res[i]);
                if (i + 1 < res.length) sb.append(", ");
            }
            sb.append("]");
            System.out.println(sb.toString());
        }`;
      } else if (returnType === 'ListNode') {
        printBlock = `        ListNode res = sol.${detectedMethod}(${argVars.join(', ')});
        StringBuilder sb = new StringBuilder("[");
        ListNode curr = res;
        while (curr != null) {
            sb.append(curr.val);
            if (curr.next != null) sb.append(", ");
            curr = curr.next;
        }
        sb.append("]");
        System.out.println(sb.toString());`;
      } else if (returnType === 'void') {
        printBlock = `        sol.${detectedMethod}(${argVars.join(', ')});
        System.out.println("void");`;
      } else {
        printBlock = `        System.out.println(sol.${detectedMethod}(${argVars.join(', ')}));`;
      }

      return `${importBlock}${listNodeDef}\n${cleanedRawCode}

public class Main {
    public static void main(String[] args) {
        Solution sol = new Solution();
${decls}
${printBlock}
    }
}
`;
    }

    case 'python': {
      const typingImport = rawCode.includes('from typing import')
        ? ''
        : 'from typing import List, Optional, Dict, Set, Tuple\n';
      const listNodeDef =
        needsListNode && !rawCode.includes('class ListNode')
          ? `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next`
          : '';

      const decls = parsedArgs
        .map((a, i) => {
          const v = argVars[i];
          switch (a.type) {
            case 'int[]':
              return `    ${v} = [${(a.value as number[]).join(', ')}]`;
            case 'int':
              return `    ${v} = ${Number(a.value) || 0}`;
            case 'boolean':
              return `    ${v} = ${a.value ? 'True' : 'False'}`;
            case 'string':
              return `    ${v} = ${JSON.stringify(String(a.value))}`;
            case 'char[][]':
            case 'int[][]':
              return `    ${v} = ${JSON.stringify(a.value)}`;
            case 'ListNode':
              return `    ${v}_vals = [${(a.value as number[]).join(', ')}]
    ${v} = None
    ${v}_tail = None
    for v in ${v}_vals:
        node = ListNode(v)
        if ${v} is None:
            ${v} = node
            ${v}_tail = node
        else:
            ${v}_tail.next = node
            ${v}_tail = node`;
          }
        })
        .join('\n');

      const hasClassSolution = /\bclass\s+Solution\b/.test(rawCode);
      const callExpr = hasClassSolution
        ? `sol = Solution()\n    res = sol.${detectedMethod}(${argVars.join(', ')})`
        : `res = ${detectedMethod}(${argVars.join(', ')})`;

      let printBlock = '';
      if (returnType === 'ListNode') {
        printBlock = `    out = []
    curr = res
    while curr is not None:
        out.append(curr.val)
        curr = curr.next
    print(str(out))`;
      } else {
        printBlock = `    if isinstance(res, bool):
        print("true" if res else "false")
    elif isinstance(res, list):
        print("[" + ", ".join(str(x) for x in res) + "]")
    else:
        print(res)`;
      }

      return `${typingImport}${listNodeDef}\n${rawCode}

if __name__ == '__main__':
${decls}
    ${callExpr}
${printBlock}
`;
    }

    case 'javascript':
    case 'typescript': {
      const isTs = lang === 'typescript';
      const listNodeDef =
        needsListNode && !rawCode.includes('class ListNode') && !rawCode.includes('function ListNode')
          ? isTs
            ? `class ListNode {
    val: number;
    next: ListNode | null;
    constructor(val?: number, next?: ListNode | null) {
        this.val = val === undefined ? 0 : val;
        this.next = next === undefined ? null : next;
    }
}`
            : `function ListNode(val, next) {
    this.val = (val === undefined ? 0 : val);
    this.next = (next === undefined ? null : next);
}`
          : '';

      const decls = parsedArgs
        .map((a, i) => {
          const v = argVars[i];
          switch (a.type) {
            case 'int[]':
              return `    const ${v}${isTs ? ': number[]' : ''} = [${(a.value as number[]).join(', ')}];`;
            case 'int':
              return `    const ${v} = ${Number(a.value) || 0};`;
            case 'boolean':
              return `    const ${v} = ${a.value ? 'true' : 'false'};`;
            case 'string':
              return `    const ${v} = ${JSON.stringify(String(a.value))};`;
            case 'char[][]':
              return `    const ${v}${isTs ? ': string[][]' : ''} = ${JSON.stringify(a.value)};`;
            case 'int[][]':
              return `    const ${v}${isTs ? ': number[][]' : ''} = ${JSON.stringify(a.value)};`;
            case 'ListNode':
              return `    const ${v}_vals${isTs ? ': number[]' : ''} = [${(a.value as number[]).join(', ')}];
    let ${v}${isTs ? ': ListNode | null' : ''} = null;
    let ${v}_tail${isTs ? ': ListNode | null' : ''} = null;
    for (const v of ${v}_vals) {
        const node = new ListNode(v);
        if (!${v} || !${v}_tail) { ${v} = node; ${v}_tail = node; }
        else { ${v}_tail.next = node; ${v}_tail = node; }
    }`;
          }
        })
        .join('\n');

      const hasClassSolution = /\bclass\s+Solution\b/.test(rawCode);
      const callBlock = hasClassSolution
        ? `    const sol = new Solution();\n    const res = sol.${detectedMethod}(${argVars.join(', ')});`
        : `    const res = ${detectedMethod}(${argVars.join(', ')});`;

      let printBlock = '';
      if (returnType === 'ListNode') {
        printBlock = `    const out${isTs ? ': number[]' : ''} = [];
    let curr = res;
    while (curr) {
        out.push(curr.val);
        curr = curr.next;
    }
    console.log(\`[\${out.join(', ')}]\`);`;
      } else {
        printBlock = `    if (Array.isArray(res)) {
        console.log(\`[\${res.join(', ')}]\`);
    } else {
        console.log(res);
    }`;
      }

      return `${listNodeDef}\n${rawCode}

(() => {
${decls}
${callBlock}
${printBlock}
})();
`;
    }

    default:
      return rawCode;
  }
}

function normalizeComparisonValue(val: string): string {
  const s = (val || '').trim();
  if (s === 'True') return 'true';
  if (s === 'False') return 'false';
  // Convert arrow notation "1 -> 2 -> 3" to "[1, 2, 3]"
  if (s.includes('->') && /^[\d\s\->,-]+$/.test(s)) {
    const items = s
      .split('->')
      .map((x) => x.trim())
      .filter(Boolean);
    return `[${items.join(', ')}]`;
  }
  return s;
}

/**
 * Compare actual output with expected output.
 * Permutations are ONLY allowed when unordered=true (e.g. Two Sum indices).
 */
export function compareOutputs(
  actual: string,
  expected: string,
  options?: { unordered?: boolean; problemId?: string }
): boolean {
  const normActual = normalizeComparisonValue(actual);
  const normExpected = normalizeComparisonValue(expected);

  if (normActual === normExpected) return true;

  const allowUnordered =
    options?.unordered === true || options?.problemId === 'q-two-sum';

  try {
    const cleanActual = normActual.replace(/\s+/g, '');
    const cleanExpected = normExpected.replace(/\s+/g, '');
    if (cleanActual === cleanExpected) return true;

    const actualArr = JSON.parse(normActual);
    const expectedArr = JSON.parse(normExpected);

    if (Array.isArray(actualArr) && Array.isArray(expectedArr)) {
      if (actualArr.length !== expectedArr.length) return false;
      if (actualArr.every((val, idx) => val === expectedArr[idx])) return true;

      if (allowUnordered) {
        const cmp = (a: unknown, b: unknown) =>
          typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b));
        const sortedActual = [...actualArr].sort(cmp);
        const sortedExpected = [...expectedArr].sort(cmp);
        return sortedActual.every((val, idx) => val === sortedExpected[idx]);
      }
      return false;
    }
  } catch (_) {}

  return false;
}
