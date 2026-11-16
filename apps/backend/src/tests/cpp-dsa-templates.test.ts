import { dockerRunnerService } from '../services/docker-runner.service';

// Use dynamic require to avoid TS rootDir cross-workspace boundary checks in backend tsc
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateTestDriver, compareOutputs } = require('../../../frontend/lib/test-harness');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  QUESTION_LIBRARY,
  getResolvedStarterTemplate,
} = require('../../../frontend/lib/interview-service');

describe('C++ DSA Interview Templates & Execution Harness', () => {
  describe('1. Class-Based C++ DSA Templates in Question Library', () => {
    it('provides class Solution for Longest Substring Without Repeating Characters', () => {
      const q = QUESTION_LIBRARY.find((item: any) => item.id === 'q-longest-substring');
      expect(q).toBeDefined();

      const tpl = getResolvedStarterTemplate(q!, 'cpp');
      expect(tpl).toContain('class Solution');
      expect(tpl).toContain('int lengthOfLongestSubstring(string s)');
      expect(tpl).toContain('#include <bits/stdc++.h>');
      expect(tpl).toContain('using namespace std;');
      expect(tpl).not.toContain('int main(');
      expect(tpl).not.toContain('Hello, CodeSync AI!');
    });

    it('provides class Solution for Two Sum', () => {
      const q = QUESTION_LIBRARY.find((item: any) => item.id === 'q-two-sum');
      expect(q).toBeDefined();

      const tpl = getResolvedStarterTemplate(q!, 'cpp');
      expect(tpl).toContain('class Solution');
      expect(tpl).toContain('vector<int> twoSum(');
      expect(tpl).toContain('#include <bits/stdc++.h>');
      expect(tpl).not.toContain('int main(');
      expect(tpl).not.toContain('Hello, CodeSync AI!');
    });

    it('provides class Solution for Valid Parentheses', () => {
      const q = QUESTION_LIBRARY.find((item: any) => item.id === 'q-valid-parentheses');
      expect(q).toBeDefined();

      const tpl = getResolvedStarterTemplate(q!, 'cpp');
      expect(tpl).toContain('class Solution');
      expect(tpl).toContain('bool isValid(string s)');
      expect(tpl).not.toContain('int main(');
    });

    it('provides class LRUCache for LRU Cache problem without pre-filled solution', () => {
      const q = QUESTION_LIBRARY.find((item: any) => item.id === 'q-lru-cache');
      expect(q).toBeDefined();

      const tpl = getResolvedStarterTemplate(q!, 'cpp');
      expect(tpl).toContain('class LRUCache');
      expect(tpl).toContain('LRUCache(int capacity)');
      expect(tpl).toContain('int get(int key)');
      expect(tpl).toContain('void put(int key, int value)');
      expect(tpl).not.toContain('int main(');
      // Ensure candidate template is not pre-solved with order.splice or full solution
      expect(tpl).not.toContain('order.splice');
    });

    it('provides class Solution and struct ListNode for Reverse Linked List', () => {
      const q = QUESTION_LIBRARY.find((item: any) => item.id === 'q-reverse-linked-list');
      if (q) {
        const tpl = getResolvedStarterTemplate(q, 'cpp');
        expect(tpl).toContain('class Solution');
        expect(tpl).toContain('ListNode* reverseList(');
        expect(tpl).not.toContain('int main(');
      }
    });
  });

  describe('2. Test Harness Driver Generation for Class-Based C++', () => {
    it('generates harness that instantiates Solution and invokes lengthOfLongestSubstring', () => {
      const candidateCode = `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_map<char, int> mp;
        int left = 0, ans = 0;
        for (int right = 0; right < (int)s.length(); right++) {
            if (mp.count(s[right])) left = max(left, mp[s[right]] + 1);
            mp[s[right]] = right;
            ans = max(ans, right - left + 1);
        }
        return ans;
    }
};`;

      const driver = generateTestDriver(
        candidateCode,
        'cpp',
        'q-longest-substring',
        's = "abcabcbb"'
      );

      expect(driver).toContain('int main()');
      expect(driver).toContain('Solution sol;');
      expect(driver).toContain('sol.lengthOfLongestSubstring(');
      expect(driver).toContain('std::string');
      expect(driver).toContain('"abcabcbb"');
    });

    it('generates harness for LRUCache with operations sequence', () => {
      const candidateCode = `#include <bits/stdc++.h>
using namespace std;

class LRUCache {
    int cap;
    list<pair<int, int>> order;
    unordered_map<int, list<pair<int, int>>::iterator> cache;
public:
    LRUCache(int capacity) : cap(capacity) {}
    int get(int key) {
        if (!cache.count(key)) return -1;
        order.splice(order.begin(), order, cache[key]);
        return cache[key]->second;
    }
    void put(int key, int value) {
        if (cache.count(key)) {
            order.splice(order.begin(), order, cache[key]);
            cache[key]->second = value;
            return;
        }
        if ((int)cache.size() >= cap) {
            cache.erase(order.back().first);
            order.pop_back();
        }
        order.emplace_front(key, value);
        cache[key] = order.begin();
    }
};`;

      const driver = generateTestDriver(
        candidateCode,
        'cpp',
        'q-lru-cache',
        'capacity = 2, operations: put(1,1), put(2,2), get(1)'
      );

      expect(driver).toContain('int main()');
      expect(driver).toContain('LRUCache cache(2);');
      expect(driver).toContain('cache.put(1, 1);');
      expect(driver).toContain('cache.put(2, 2);');
      expect(driver).toContain('results.push_back(cache.get(1));');
    });

    it('handles Reverse Linked List with commented ListNode safely without declaration clash', () => {
      const candidateCode = `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* reverseList(ListNode* head) {
        ListNode* prev = nullptr;
        while (head) {
            ListNode* nxt = head->next;
            head->next = prev;
            prev = head;
            head = nxt;
        }
        return prev;
    }
};`;

      const driver = generateTestDriver(
        candidateCode,
        'cpp',
        'q-reverse-linked-list',
        'head = [1, 2, 3, 4, 5]'
      );

      // Harness must inject struct ListNode outside comments so compiler succeeds
      expect(driver).toContain('struct ListNode {');
      expect(driver).toContain('int main()');
      expect(driver).toContain('ListNode* res = sol.reverseList(');
    });
  });

  describe('3. Docker C++ Execution of Class-Based Solution', () => {
    it('executes class-based Longest Substring in Docker gcc container', async () => {
      const isDockerAvailable = await dockerRunnerService.verifyDockerAvailable();
      const isImageAvailable =
        isDockerAvailable && (await dockerRunnerService.verifyImageAvailable('gcc:latest'));

      if (!isDockerAvailable || !isImageAvailable) {
        console.warn("Docker daemon or gcc:latest not available; skipping live container test");
        return;
      }

      const candidateCode = `#include <bits/stdc++.h>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        unordered_map<char, int> mp;
        int left = 0, ans = 0;
        for (int right = 0; right < (int)s.length(); right++) {
            if (mp.count(s[right])) left = max(left, mp[s[right]] + 1);
            mp[s[right]] = right;
            ans = max(ans, right - left + 1);
        }
        return ans;
    }
};`;

      const driver = generateTestDriver(
        candidateCode,
        'cpp',
        'q-longest-substring',
        's = "abcabcbb"'
      );

      const result = await dockerRunnerService.executeCode('cpp', driver);
      expect(result.exitCode).toBe(0);
      expect(result.compileError).toBeFalsy();
      expect(result.stdout.trim()).toBe('3');
      expect(compareOutputs(result.stdout.trim(), '3')).toBe(true);
    }, 30000);
  });
});
