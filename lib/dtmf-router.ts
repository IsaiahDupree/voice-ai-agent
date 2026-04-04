/**
 * DTMF (Dual-Tone Multi-Frequency) Menu Router
 *
 * Handles keypad input navigation, validation, and menu tree traversal
 * Supports:
 * - Interactive voice response (IVR) menus
 * - PIN/account number collection
 * - Timeout and retry handling
 */

export interface DTMFMenuNode {
  message: string;
  options?: Record<string, DTMFAction>;
  timeout_message?: string;
  invalid_message?: string;
}

export interface DTMFAction {
  action: 'transfer' | 'menu' | 'collect_input' | 'end_call' | 'webhook';
  destination?: string; // Transfer number or webhook URL
  node_id?: string; // Next menu node ID
  type?: 'account_number' | 'pin' | 'numeric' | 'confirmation'; // Input type
  length?: number; // Expected input length
  min_length?: number;
  max_length?: number;
  message?: string; // Confirmation message
  metadata?: Record<string, unknown>;
}

export interface DTMFMenu {
  id: number;
  tenant_id: string;
  name: string;
  menu_tree: Record<string, DTMFMenuNode>;
  timeout_seconds: number;
  max_retries: number;
  invalid_message: string;
  timeout_message: string;
}

export interface DTMFSessionState {
  current_node: string;
  collected_input: Record<string, string>;
  retry_count: number;
  last_keypress_at?: Date;
  started_at: Date;
}

export class DTMFRouter {
  private menu: DTMFMenu;
  private state: DTMFSessionState;

  constructor(menu: DTMFMenu, initialState?: Partial<DTMFSessionState>) {
    this.menu = menu;
    this.state = {
      current_node: 'root',
      collected_input: {},
      retry_count: 0,
      started_at: new Date(),
      ...initialState,
    };
  }

  /**
   * Get current menu node
   */
  getCurrentNode(): DTMFMenuNode | null {
    return this.menu.menu_tree[this.state.current_node] || null;
  }

  /**
   * Process a keypress input
   * Returns the action to take and updated state
   */
  processKeypress(key: string): {
    action: DTMFAction | null;
    message: string;
    state: DTMFSessionState;
    valid: boolean;
  } {
    const node = this.getCurrentNode();
    if (!node) {
      return {
        action: null,
        message: 'Invalid menu state',
        state: this.state,
        valid: false,
      };
    }

    // Update last keypress time
    this.state.last_keypress_at = new Date();
    this.state.retry_count = 0; // Reset retry count on valid input

    // Check if key is valid for current node
    if (!node.options || !node.options[key]) {
      this.state.retry_count++;
      const invalidMsg = node.invalid_message || this.menu.invalid_message;
      return {
        action: null,
        message: invalidMsg,
        state: this.state,
        valid: false,
      };
    }

    const action = node.options[key];

    // Handle different action types
    if (action.action === 'menu' && action.node_id) {
      // Navigate to submenu
      this.state.current_node = action.node_id;
      const nextNode = this.getCurrentNode();
      return {
        action,
        message: nextNode?.message || '',
        state: this.state,
        valid: true,
      };
    }

    // Other actions (transfer, collect_input, end_call, webhook) are returned for caller to handle
    return {
      action,
      message: action.message || '',
      state: this.state,
      valid: true,
    };
  }

  /**
   * Handle timeout (no keypress within timeout window)
   */
  handleTimeout(): {
    message: string;
    shouldRetry: boolean;
    state: DTMFSessionState;
  } {
    this.state.retry_count++;
    const node = this.getCurrentNode();
    const timeoutMsg = node?.timeout_message || this.menu.timeout_message;

    const shouldRetry = this.state.retry_count < this.menu.max_retries;

    return {
      message: shouldRetry ? timeoutMsg : 'Maximum retries exceeded. Goodbye.',
      shouldRetry,
      state: this.state,
    };
  }

  /**
   * Validate collected input (PIN, account number, etc.)
   */
  static validateInput(
    input: string,
    type: DTMFAction['type'],
    options?: { length?: number; min_length?: number; max_length?: number }
  ): { valid: boolean; error?: string } {
    // All DTMF input must be numeric
    if (!/^\d+$/.test(input)) {
      return { valid: false, error: 'Input must contain only digits' };
    }

    // Length validation
    if (options?.length && input.length !== options.length) {
      return { valid: false, error: `Input must be exactly ${options.length} digits` };
    }

    if (options?.min_length && input.length < options.min_length) {
      return { valid: false, error: `Input must be at least ${options.min_length} digits` };
    }

    if (options?.max_length && input.length > options.max_length) {
      return { valid: false, error: `Input must be at most ${options.max_length} digits` };
    }

    // Type-specific validation
    switch (type) {
      case 'account_number':
        // Account numbers typically 8-16 digits
        if (input.length < 8 || input.length > 16) {
          return { valid: false, error: 'Invalid account number format' };
        }
        break;

      case 'pin':
        // PINs typically 4-8 digits
        if (input.length < 4 || input.length > 8) {
          return { valid: false, error: 'Invalid PIN format' };
        }
        break;

      case 'confirmation':
        // Confirmation is typically 1 digit (1=yes, 2=no)
        if (input.length !== 1 || !['1', '2'].includes(input)) {
          return { valid: false, error: 'Press 1 to confirm or 2 to cancel' };
        }
        break;

      case 'numeric':
        // Generic numeric input - already validated above
        break;
    }

    return { valid: true };
  }

  /**
   * Check if timeout has occurred
   */
  isTimedOut(): boolean {
    if (!this.state.last_keypress_at) {
      // Check from session start
      const elapsed = Date.now() - this.state.started_at.getTime();
      return elapsed > this.menu.timeout_seconds * 1000;
    }

    const elapsed = Date.now() - this.state.last_keypress_at.getTime();
    return elapsed > this.menu.timeout_seconds * 1000;
  }

  /**
   * Reset router to initial state
   */
  reset(): void {
    this.state = {
      current_node: 'root',
      collected_input: {},
      retry_count: 0,
      started_at: new Date(),
    };
  }

  /**
   * Get current state (for persistence)
   */
  getState(): DTMFSessionState {
    return { ...this.state };
  }

  /**
   * Set state (for restoration)
   */
  setState(state: DTMFSessionState): void {
    this.state = state;
  }
}

/**
 * Validate menu tree structure
 * Ensures all referenced nodes exist and no circular references
 */
export function validateMenuTree(tree: Record<string, DTMFMenuNode>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!tree.root) {
    errors.push('Menu tree must have a "root" node');
    return { valid: false, errors };
  }

  const nodeIds = Object.keys(tree);
  const visited = new Set<string>();

  function checkNode(nodeId: string, path: string[] = []): void {
    if (visited.has(nodeId)) {
      // Circular reference check
      if (path.includes(nodeId)) {
        errors.push(`Circular reference detected: ${path.join(' -> ')} -> ${nodeId}`);
      }
      return;
    }

    visited.add(nodeId);
    const node = tree[nodeId];

    if (!node) {
      errors.push(`Referenced node "${nodeId}" does not exist`);
      return;
    }

    if (!node.message || node.message.trim().length === 0) {
      errors.push(`Node "${nodeId}" must have a message`);
    }

    if (node.options) {
      Object.entries(node.options).forEach(([key, action]) => {
        // Validate key is single digit
        if (!/^[0-9*#]$/.test(key)) {
          errors.push(`Invalid DTMF key "${key}" in node "${nodeId}". Must be 0-9, *, or #`);
        }

        // Validate action
        if (action.action === 'menu' && action.node_id) {
          if (!nodeIds.includes(action.node_id)) {
            errors.push(`Node "${nodeId}" references non-existent node "${action.node_id}"`);
          } else {
            checkNode(action.node_id, [...path, nodeId]);
          }
        }

        if (action.action === 'transfer' && !action.destination) {
          errors.push(`Transfer action in node "${nodeId}" key "${key}" missing destination`);
        }

        if (action.action === 'collect_input' && !action.type) {
          errors.push(`Collect input action in node "${nodeId}" key "${key}" missing type`);
        }
      });
    }
  }

  checkNode('root');

  return {
    valid: errors.length === 0,
    errors,
  };
}
