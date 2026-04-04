/**
 * Unit test: Menu tree traversal
 * Feature 85: Verify menu tree validation and traversal logic
 *
 * This test verifies:
 * 1. Menu tree validation detects structural errors
 * 2. Circular reference detection works correctly
 * 3. Missing node references are caught
 * 4. Invalid action configurations are flagged
 */

import { validateMenuTree, type DTMFMenuNode } from '@/lib/dtmf-router';

describe('DTMF Menu Tree Validation', () => {
  describe('Valid menu trees', () => {
    it('should validate simple single-node menu', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press 1 for sales',
          options: {
            '1': {
              action: 'transfer',
              destination: '+15551234567',
            },
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate multi-level menu tree', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Main menu',
          options: {
            '1': { action: 'menu', node_id: 'sales' },
            '2': { action: 'menu', node_id: 'support' },
          },
        },
        sales: {
          message: 'Sales menu',
          options: {
            '1': { action: 'transfer', destination: '+15551111111' },
          },
        },
        support: {
          message: 'Support menu',
          options: {
            '1': { action: 'transfer', destination: '+15552222222' },
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate menu with all action types', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press a key',
          options: {
            '1': { action: 'transfer', destination: '+15551234567' },
            '2': { action: 'menu', node_id: 'submenu' },
            '3': { action: 'collect_input', type: 'pin' },
            '4': { action: 'webhook', destination: 'https://example.com/webhook' },
            '5': { action: 'end_call', message: 'Goodbye' },
          },
        },
        submenu: {
          message: 'Submenu',
          options: {},
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate menu with DTMF special characters (* and #)', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press * for help, # to repeat',
          options: {
            '*': { action: 'menu', node_id: 'help' },
            '#': { action: 'menu', node_id: 'root' },
          },
        },
        help: {
          message: 'Help menu',
          options: {},
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Invalid menu trees - Missing root', () => {
    it('should reject menu without root node', () => {
      const tree: Record<string, DTMFMenuNode> = {
        not_root: {
          message: 'Invalid',
          options: {},
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Menu tree must have a "root" node');
    });

    it('should reject empty menu tree', () => {
      const tree: Record<string, DTMFMenuNode> = {};

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Menu tree must have a "root" node');
    });
  });

  describe('Invalid menu trees - Missing node references', () => {
    it('should detect reference to non-existent node', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press 1',
          options: {
            '1': { action: 'menu', node_id: 'nonexistent' },
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Node "root" references non-existent node "nonexistent"');
    });

    it('should detect multiple missing references', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press a key',
          options: {
            '1': { action: 'menu', node_id: 'missing1' },
            '2': { action: 'menu', node_id: 'missing2' },
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors).toContain('Node "root" references non-existent node "missing1"');
      expect(result.errors).toContain('Node "root" references non-existent node "missing2"');
    });
  });

  describe('Invalid menu trees - Circular references', () => {
    it('should detect direct circular reference', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press 1',
          options: {
            '1': { action: 'menu', node_id: 'root' }, // Points to itself
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Circular reference detected: root -> root');
    });

    it('should detect two-node circular reference', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press 1',
          options: {
            '1': { action: 'menu', node_id: 'node_a' },
          },
        },
        node_a: {
          message: 'Press 1',
          options: {
            '1': { action: 'menu', node_id: 'root' }, // Circular: root -> node_a -> root
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Circular reference'))).toBe(true);
    });

    it('should detect three-node circular reference', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press 1',
          options: {
            '1': { action: 'menu', node_id: 'node_a' },
          },
        },
        node_a: {
          message: 'Press 1',
          options: {
            '1': { action: 'menu', node_id: 'node_b' },
          },
        },
        node_b: {
          message: 'Press 1',
          options: {
            '1': { action: 'menu', node_id: 'root' }, // Circular: root -> a -> b -> root
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Circular reference'))).toBe(true);
    });
  });

  describe('Invalid menu trees - Missing required fields', () => {
    it('should detect missing message in node', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: '',
          options: {},
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Node "root" must have a message');
    });

    it('should detect missing destination in transfer action', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press 1',
          options: {
            '1': { action: 'transfer' }, // Missing destination
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Transfer action in node "root" key "1" missing destination');
    });

    it('should detect missing type in collect_input action', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Enter PIN',
          options: {
            '1': { action: 'collect_input' }, // Missing type
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Collect input action in node "root" key "1" missing type');
    });
  });

  describe('Invalid menu trees - Invalid DTMF keys', () => {
    it('should detect invalid DTMF key (letter)', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press a key',
          options: {
            a: { action: 'transfer', destination: '+15551234567' }, // Invalid: letter
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid DTMF key "a" in node "root". Must be 0-9, *, or #');
    });

    it('should detect invalid DTMF key (multi-character)', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press a key',
          options: {
            '12': { action: 'transfer', destination: '+15551234567' }, // Invalid: 2 chars
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid DTMF key "12" in node "root". Must be 0-9, *, or #');
    });

    it('should accept all valid DTMF keys (0-9, *, #)', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Press any key',
          options: {
            '0': { action: 'end_call' },
            '1': { action: 'end_call' },
            '2': { action: 'end_call' },
            '3': { action: 'end_call' },
            '4': { action: 'end_call' },
            '5': { action: 'end_call' },
            '6': { action: 'end_call' },
            '7': { action: 'end_call' },
            '8': { action: 'end_call' },
            '9': { action: 'end_call' },
            '*': { action: 'end_call' },
            '#': { action: 'end_call' },
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Complex validation scenarios', () => {
    it('should detect multiple errors in one tree', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: '',
          options: {
            '1': { action: 'menu', node_id: 'missing' },
            a: { action: 'transfer' }, // Invalid key + missing destination
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should validate large menu tree efficiently', () => {
      // Create a tree with 100 nodes
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Main menu',
          options: {
            '1': { action: 'menu', node_id: 'node_1' },
          },
        },
      };

      for (let i = 1; i < 100; i++) {
        tree[`node_${i}`] = {
          message: `Node ${i}`,
          options: {
            '1': { action: 'menu', node_id: `node_${i + 1}` },
          },
        };
      }

      tree['node_100'] = {
        message: 'Final node',
        options: {
          '1': { action: 'end_call' },
        },
      };

      const start = Date.now();
      const result = validateMenuTree(tree);
      const elapsed = Date.now() - start;

      expect(result.valid).toBe(true);
      expect(elapsed).toBeLessThan(100); // Should validate quickly
    });

    it('should handle menu with no options gracefully', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Dead end',
          // No options
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true); // Valid tree, just no options
    });
  });

  describe('Edge cases', () => {
    it('should handle node with only optional fields', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Root message',
          options: {},
          timeout_message: 'Timeout',
          invalid_message: 'Invalid',
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true);
    });

    it('should handle deeply nested menu', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: { message: 'Level 0', options: { '1': { action: 'menu', node_id: 'level1' } } },
        level1: { message: 'Level 1', options: { '1': { action: 'menu', node_id: 'level2' } } },
        level2: { message: 'Level 2', options: { '1': { action: 'menu', node_id: 'level3' } } },
        level3: { message: 'Level 3', options: { '1': { action: 'menu', node_id: 'level4' } } },
        level4: { message: 'Level 4', options: { '1': { action: 'menu', node_id: 'level5' } } },
        level5: { message: 'Level 5', options: { '1': { action: 'end_call' } } },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true);
    });

    it('should handle multiple paths to same node (not circular)', () => {
      const tree: Record<string, DTMFMenuNode> = {
        root: {
          message: 'Root',
          options: {
            '1': { action: 'menu', node_id: 'shared' },
            '2': { action: 'menu', node_id: 'shared' },
          },
        },
        shared: {
          message: 'Shared node',
          options: {
            '1': { action: 'end_call' },
          },
        },
      };

      const result = validateMenuTree(tree);

      expect(result.valid).toBe(true); // Multiple paths to same node is OK
    });
  });
});
