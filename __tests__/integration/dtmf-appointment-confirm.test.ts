/**
 * Integration test: DTMF '1' routes to confirm appointment
 * Feature 83: Verify DTMF keypress routing and appointment confirmation flow
 *
 * This test verifies:
 * 1. DTMF menu processes keypress '1'
 * 2. Routes to appointment confirmation action
 * 3. Full integration with DTMF router and menu tree
 */

import { DTMFRouter, type DTMFMenu, type DTMFMenuNode } from '@/lib/dtmf-router';

describe('DTMF Integration: Appointment Confirmation Flow', () => {
  const testMenu: DTMFMenu = {
    id: 1,
    tenant_id: 'test',
    name: 'Appointment Confirmation Menu',
    timeout_seconds: 10,
    max_retries: 3,
    invalid_message: 'Invalid selection. Please try again.',
    timeout_message: "I didn't hear your selection.",
    menu_tree: {
      root: {
        message: 'Press 1 to confirm your appointment, Press 2 to reschedule, Press 3 for more options.',
        options: {
          '1': {
            action: 'webhook',
            destination: '/api/tools/confirmAppointment',
            message: 'Great! Your appointment is confirmed.',
          },
          '2': {
            action: 'menu',
            node_id: 'reschedule_menu',
          },
          '3': {
            action: 'menu',
            node_id: 'options_menu',
          },
        },
      },
      reschedule_menu: {
        message: 'Press 1 for tomorrow, Press 2 for next week, Press 9 to go back.',
        options: {
          '1': {
            action: 'webhook',
            destination: '/api/tools/rescheduleTomorrow',
            message: 'Scheduling for tomorrow.',
          },
          '2': {
            action: 'webhook',
            destination: '/api/tools/rescheduleNextWeek',
            message: 'Scheduling for next week.',
          },
          '9': {
            action: 'menu',
            node_id: 'root',
          },
        },
      },
      options_menu: {
        message: 'Press 1 to cancel appointment, Press 2 to speak to a person, Press 9 to go back.',
        options: {
          '1': {
            action: 'webhook',
            destination: '/api/tools/cancelAppointment',
            message: 'Your appointment has been cancelled.',
          },
          '2': {
            action: 'transfer',
            destination: '+15551234567',
            message: 'Transferring you to a representative.',
          },
          '9': {
            action: 'menu',
            node_id: 'root',
          },
        },
      },
    },
  };

  describe('Appointment Confirmation (Key 1)', () => {
    it('should route keypress 1 to appointment confirmation webhook', () => {
      const router = new DTMFRouter(testMenu);

      const result = router.processKeypress('1');

      expect(result.valid).toBe(true);
      expect(result.action).toBeDefined();
      expect(result.action?.action).toBe('webhook');
      expect(result.action?.destination).toBe('/api/tools/confirmAppointment');
      expect(result.message).toBe('Great! Your appointment is confirmed.');
    });

    it('should maintain correct state after confirmation', () => {
      const router = new DTMFRouter(testMenu);

      const result = router.processKeypress('1');

      expect(result.state.current_node).toBe('root');
      expect(result.state.retry_count).toBe(0);
      expect(result.state.last_keypress_at).toBeDefined();
    });

    it('should handle confirmation in a real call flow', () => {
      const router = new DTMFRouter(testMenu);

      // User hears root message
      const currentNode = router.getCurrentNode();
      expect(currentNode?.message).toContain('Press 1 to confirm');

      // User presses 1
      const confirmResult = router.processKeypress('1');

      expect(confirmResult.valid).toBe(true);
      expect(confirmResult.action?.action).toBe('webhook');
      expect(confirmResult.message).toContain('confirmed');

      // At this point, the system would call the webhook
      // /api/tools/confirmAppointment
    });
  });

  describe('Reschedule Flow (Key 2 → Submenu)', () => {
    it('should route keypress 2 to reschedule menu', () => {
      const router = new DTMFRouter(testMenu);

      const result = router.processKeypress('2');

      expect(result.valid).toBe(true);
      expect(result.action?.action).toBe('menu');
      expect(result.action?.node_id).toBe('reschedule_menu');
      expect(result.state.current_node).toBe('reschedule_menu');
    });

    it('should navigate through reschedule submenu', () => {
      const router = new DTMFRouter(testMenu);

      // Navigate to reschedule menu
      router.processKeypress('2');

      // Now in reschedule_menu node
      const currentNode = router.getCurrentNode();
      expect(currentNode?.message).toContain('Press 1 for tomorrow');

      // Select "tomorrow"
      const tomorrowResult = router.processKeypress('1');

      expect(tomorrowResult.valid).toBe(true);
      expect(tomorrowResult.action?.action).toBe('webhook');
      expect(tomorrowResult.action?.destination).toBe('/api/tools/rescheduleTomorrow');
    });

    it('should allow going back to root menu', () => {
      const router = new DTMFRouter(testMenu);

      // Navigate to reschedule menu
      router.processKeypress('2');
      expect(router.getCurrentNode()?.message).toContain('tomorrow');

      // Press 9 to go back
      const backResult = router.processKeypress('9');

      expect(backResult.valid).toBe(true);
      expect(backResult.state.current_node).toBe('root');
      expect(router.getCurrentNode()?.message).toContain('Press 1 to confirm');
    });
  });

  describe('Options Menu (Key 3 → Cancel/Transfer)', () => {
    it('should route to options menu', () => {
      const router = new DTMFRouter(testMenu);

      const result = router.processKeypress('3');

      expect(result.valid).toBe(true);
      expect(result.state.current_node).toBe('options_menu');
    });

    it('should handle appointment cancellation', () => {
      const router = new DTMFRouter(testMenu);

      // Navigate to options menu
      router.processKeypress('3');

      // Cancel appointment
      const cancelResult = router.processKeypress('1');

      expect(cancelResult.valid).toBe(true);
      expect(cancelResult.action?.action).toBe('webhook');
      expect(cancelResult.action?.destination).toBe('/api/tools/cancelAppointment');
      expect(cancelResult.message).toContain('cancelled');
    });

    it('should handle transfer to live person', () => {
      const router = new DTMFRouter(testMenu);

      // Navigate to options menu
      router.processKeypress('3');

      // Transfer to person
      const transferResult = router.processKeypress('2');

      expect(transferResult.valid).toBe(true);
      expect(transferResult.action?.action).toBe('transfer');
      expect(transferResult.action?.destination).toBe('+15551234567');
      expect(transferResult.message).toContain('Transferring');
    });
  });

  describe('Invalid Key Handling', () => {
    it('should reject invalid keypress at root', () => {
      const router = new DTMFRouter(testMenu);

      const result = router.processKeypress('5'); // Not a valid option

      expect(result.valid).toBe(false);
      expect(result.action).toBeNull();
      expect(result.message).toBe('Invalid selection. Please try again.');
      expect(result.state.retry_count).toBe(1);
    });

    it('should increment retry count on multiple invalid inputs', () => {
      const router = new DTMFRouter(testMenu);

      router.processKeypress('5');
      const result = router.processKeypress('7');

      expect(result.state.retry_count).toBe(2);
    });

    it('should reset retry count on valid input', () => {
      const router = new DTMFRouter(testMenu);

      // Invalid inputs
      router.processKeypress('5');
      router.processKeypress('7');
      expect(router.getState().retry_count).toBe(2);

      // Valid input resets retry count
      const validResult = router.processKeypress('1');
      expect(validResult.state.retry_count).toBe(0);
    });

    it('should reject non-DTMF characters', () => {
      const router = new DTMFRouter(testMenu);

      const result = router.processKeypress('a'); // Letter, not digit

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid');
    });
  });

  describe('Timeout Handling', () => {
    it('should handle timeout with retry', () => {
      const router = new DTMFRouter(testMenu);

      const timeoutResult = router.handleTimeout();

      expect(timeoutResult.shouldRetry).toBe(true);
      expect(timeoutResult.message).toBe("I didn't hear your selection.");
      expect(timeoutResult.state.retry_count).toBe(1);
    });

    it('should stop retrying after max attempts', () => {
      const router = new DTMFRouter(testMenu);

      // Timeout 3 times (max_retries = 3)
      router.handleTimeout();
      router.handleTimeout();
      const finalTimeout = router.handleTimeout();

      expect(finalTimeout.shouldRetry).toBe(false);
      expect(finalTimeout.message).toContain('Maximum retries exceeded');
    });

    it('should reset timeout state on valid keypress', () => {
      const router = new DTMFRouter(testMenu);

      router.handleTimeout();
      expect(router.getState().retry_count).toBe(1);

      router.processKeypress('1');
      expect(router.getState().retry_count).toBe(0);
    });
  });

  describe('Session State Management', () => {
    it('should persist and restore session state', () => {
      const router1 = new DTMFRouter(testMenu);

      // Navigate through menu
      router1.processKeypress('2'); // Go to reschedule menu
      const state = router1.getState();

      expect(state.current_node).toBe('reschedule_menu');

      // Create new router with saved state
      const router2 = new DTMFRouter(testMenu, state);

      expect(router2.getCurrentNode()?.message).toContain('tomorrow');
      expect(router2.getState().current_node).toBe('reschedule_menu');
    });

    it('should track last keypress time', () => {
      const router = new DTMFRouter(testMenu);
      const beforePress = Date.now();

      router.processKeypress('1');
      const state = router.getState();

      expect(state.last_keypress_at).toBeDefined();
      expect(state.last_keypress_at!.getTime()).toBeGreaterThanOrEqual(beforePress);
    });

    it('should reset router to initial state', () => {
      const router = new DTMFRouter(testMenu);

      // Navigate and collect state
      router.processKeypress('2');
      router.processKeypress('invalid');
      expect(router.getState().current_node).toBe('reschedule_menu');
      expect(router.getState().retry_count).toBeGreaterThan(0);

      // Reset
      router.reset();

      const state = router.getState();
      expect(state.current_node).toBe('root');
      expect(state.retry_count).toBe(0);
      expect(state.collected_input).toEqual({});
      expect(state.last_keypress_at).toBeUndefined();
    });
  });

  describe('Multi-Level Menu Navigation', () => {
    it('should handle deep navigation: root → options → back → reschedule → back', () => {
      const router = new DTMFRouter(testMenu);

      // Root → options
      router.processKeypress('3');
      expect(router.getCurrentNode()?.message).toContain('cancel');

      // Options → back to root
      router.processKeypress('9');
      expect(router.getCurrentNode()?.message).toContain('Press 1 to confirm');

      // Root → reschedule
      router.processKeypress('2');
      expect(router.getCurrentNode()?.message).toContain('tomorrow');

      // Reschedule → back to root
      router.processKeypress('9');
      expect(router.getCurrentNode()?.message).toContain('Press 1 to confirm');
    });

    it('should maintain state across complex navigation', () => {
      const router = new DTMFRouter(testMenu);

      const steps = [
        { key: '2', expectedNode: 'reschedule_menu' },
        { key: '9', expectedNode: 'root' },
        { key: '3', expectedNode: 'options_menu' },
        { key: '9', expectedNode: 'root' },
      ];

      steps.forEach(({ key, expectedNode }) => {
        const result = router.processKeypress(key);
        expect(result.valid).toBe(true);
        expect(result.state.current_node).toBe(expectedNode);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty menu tree gracefully', () => {
      const emptyMenu: DTMFMenu = {
        ...testMenu,
        menu_tree: {},
      };

      const router = new DTMFRouter(emptyMenu);
      const result = router.processKeypress('1');

      expect(result.valid).toBe(false);
      expect(result.action).toBeNull();
    });

    it('should handle missing options in node', () => {
      const minimalMenu: DTMFMenu = {
        ...testMenu,
        menu_tree: {
          root: {
            message: 'Press any key',
            // No options defined
          },
        },
      };

      const router = new DTMFRouter(minimalMenu);
      const result = router.processKeypress('1');

      expect(result.valid).toBe(false);
    });

    it('should handle special DTMF characters (* and #)', () => {
      const specialMenu: DTMFMenu = {
        ...testMenu,
        menu_tree: {
          root: {
            message: 'Press * for help, # to repeat',
            options: {
              '*': {
                action: 'menu',
                node_id: 'help',
              },
              '#': {
                action: 'menu',
                node_id: 'root',
              },
            },
          },
          help: {
            message: 'Help menu',
            options: {},
          },
        },
      };

      const router = new DTMFRouter(specialMenu);

      const starResult = router.processKeypress('*');
      expect(starResult.valid).toBe(true);
      expect(starResult.state.current_node).toBe('help');

      const hashResult = router.processKeypress('#');
      expect(hashResult.valid).toBe(true);
      expect(hashResult.state.current_node).toBe('root');
    });
  });
});

describe('DTMF API Integration', () => {
  const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  describe('POST /api/dtmf/menus', () => {
    it('should create a new DTMF menu', async () => {
      const menuData = {
        name: 'Test Appointment Menu',
        description: 'Integration test menu',
        menu_tree: {
          root: {
            message: 'Press 1 to confirm',
            options: {
              '1': {
                action: 'webhook',
                destination: '/api/tools/confirm',
                message: 'Confirmed',
              },
            },
          },
        },
        timeout_seconds: 10,
        max_retries: 3,
      };

      const response = await fetch(`${API_BASE}/api/dtmf/menus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuData),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.name).toBe('Test Appointment Menu');
      expect(data.data.menu_tree.root.message).toBe('Press 1 to confirm');
    }, 15000);
  });

  describe('POST /api/dtmf/validate', () => {
    it('should validate menu tree structure', async () => {
      const validTree = {
        root: {
          message: 'Press 1',
          options: {
            '1': {
              action: 'webhook',
              destination: '/api/test',
            },
          },
        },
      };

      const response = await fetch(`${API_BASE}/api/dtmf/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_tree: validTree }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.valid).toBe(true);
      expect(data.errors).toHaveLength(0);
    }, 15000);

    it('should detect invalid menu tree (missing root)', async () => {
      const invalidTree = {
        not_root: {
          message: 'Invalid',
        },
      };

      const response = await fetch(`${API_BASE}/api/dtmf/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_tree: invalidTree }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.errors).toContain('Menu tree must have a "root" node');
    }, 15000);
  });
});
