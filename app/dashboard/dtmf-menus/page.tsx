/**
 * DTMF Menus Dashboard
 * Visual tree editor for interactive voice response (IVR) menu configurations
 *
 * Features:
 * - Create/edit/delete DTMF menus
 * - Visual tree representation
 * - Node editor for messages and options
 * - Menu validation
 * - Export/import menu configurations
 */

'use client';

import { useEffect, useState } from 'react';
import type { DTMFMenuNode, DTMFAction, DTMFMenu } from '@/lib/dtmf-router';
import { validateMenuTree } from '@/lib/dtmf-router';

interface MenuListItem {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  created_at: string;
}

type ActionType = 'transfer' | 'menu' | 'collect_input' | 'end_call' | 'webhook';
type InputType = 'account_number' | 'pin' | 'numeric' | 'confirmation';

export default function DTMFMenusPage() {
  const [menus, setMenus] = useState<MenuListItem[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<DTMFMenu | null>(null);
  const [menuTree, setMenuTree] = useState<Record<string, DTMFMenuNode>>({});
  const [selectedNode, setSelectedNode] = useState<string>('root');
  const [editingNode, setEditingNode] = useState(false);
  const [creatingMenu, setCreatingMenu] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuDescription, setNewMenuDescription] = useState('');
  const [nodeMessage, setNodeMessage] = useState('');
  const [nodeOptions, setNodeOptions] = useState<Record<string, DTMFAction>>({});
  const [addingOption, setAddingOption] = useState(false);
  const [newOptionKey, setNewOptionKey] = useState('');
  const [newOptionAction, setNewOptionAction] = useState<ActionType>('transfer');
  const [newOptionDestination, setNewOptionDestination] = useState('');
  const [newOptionNodeId, setNewOptionNodeId] = useState('');
  const [newOptionType, setNewOptionType] = useState<InputType>('numeric');
  const [newOptionMessage, setNewOptionMessage] = useState('');

  useEffect(() => {
    loadMenus();
  }, []);

  async function loadMenus() {
    setLoading(true);
    try {
      const res = await fetch('/api/dtmf/menus');
      if (res.ok) {
        const data = await res.json();
        setMenus(data.data || []);
      }
    } catch (error) {
      console.error('Error loading menus:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMenu(id: number) {
    try {
      const res = await fetch(`/api/dtmf/menus/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMenu(data.data);
        setMenuTree(data.data.menu_tree || {});
        setSelectedNode('root');
        validateMenu(data.data.menu_tree);
      }
    } catch (error) {
      console.error('Error loading menu:', error);
    }
  }

  async function createMenu() {
    if (!newMenuName.trim()) {
      alert('Menu name is required');
      return;
    }

    const initialTree: Record<string, DTMFMenuNode> = {
      root: {
        message: 'Welcome. Please press a key.',
        options: {},
      },
    };

    try {
      const res = await fetch('/api/dtmf/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMenuName,
          description: newMenuDescription,
          menu_tree: initialTree,
          timeout_seconds: 10,
          max_retries: 3,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMenus([...menus, data.data]);
        setNewMenuName('');
        setNewMenuDescription('');
        setCreatingMenu(false);
        loadMenu(data.data.id);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to create menu'}`);
      }
    } catch (error) {
      console.error('Error creating menu:', error);
      alert('Failed to create menu');
    }
  }

  async function saveMenu() {
    if (!selectedMenu) return;

    const validation = validateMenuTree(menuTree);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      alert('Menu has validation errors. Please fix them before saving.');
      return;
    }

    try {
      const res = await fetch(`/api/dtmf/menus/${selectedMenu.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_tree: menuTree,
        }),
      });

      if (res.ok) {
        alert('Menu saved successfully');
        setValidationErrors([]);
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to save menu'}`);
      }
    } catch (error) {
      console.error('Error saving menu:', error);
      alert('Failed to save menu');
    }
  }

  async function deleteMenu(id: number) {
    if (!confirm('Are you sure you want to delete this menu?')) return;

    try {
      const res = await fetch(`/api/dtmf/menus/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMenus(menus.filter((m) => m.id !== id));
        if (selectedMenu?.id === id) {
          setSelectedMenu(null);
          setMenuTree({});
        }
      }
    } catch (error) {
      console.error('Error deleting menu:', error);
    }
  }

  function validateMenu(tree: Record<string, DTMFMenuNode>) {
    const validation = validateMenuTree(tree);
    setValidationErrors(validation.errors);
  }

  function addNode(nodeId: string) {
    const newTree = { ...menuTree };
    newTree[nodeId] = {
      message: 'New menu node',
      options: {},
    };
    setMenuTree(newTree);
    setSelectedNode(nodeId);
    validateMenu(newTree);
  }

  function updateNode(nodeId: string, updates: Partial<DTMFMenuNode>) {
    const newTree = { ...menuTree };
    newTree[nodeId] = { ...newTree[nodeId], ...updates };
    setMenuTree(newTree);
    validateMenu(newTree);
  }

  function deleteNode(nodeId: string) {
    if (nodeId === 'root') {
      alert('Cannot delete root node');
      return;
    }

    const newTree = { ...menuTree };
    delete newTree[nodeId];
    setMenuTree(newTree);
    setSelectedNode('root');
    validateMenu(newTree);
  }

  function startEditNode(nodeId: string) {
    const node = menuTree[nodeId];
    if (node) {
      setNodeMessage(node.message);
      setNodeOptions(node.options || {});
      setEditingNode(true);
    }
  }

  function saveNodeEdits() {
    updateNode(selectedNode, {
      message: nodeMessage,
      options: nodeOptions,
    });
    setEditingNode(false);
  }

  function addOptionToNode() {
    if (!newOptionKey.match(/^[0-9*#]$/)) {
      alert('Key must be 0-9, *, or #');
      return;
    }

    const action: DTMFAction = {
      action: newOptionAction,
    };

    switch (newOptionAction) {
      case 'transfer':
        if (!newOptionDestination) {
          alert('Transfer destination is required');
          return;
        }
        action.destination = newOptionDestination;
        action.message = newOptionMessage || 'Transferring...';
        break;

      case 'menu':
        if (!newOptionNodeId) {
          alert('Menu node ID is required');
          return;
        }
        action.node_id = newOptionNodeId;
        break;

      case 'collect_input':
        action.type = newOptionType;
        action.message = newOptionMessage;
        break;

      case 'webhook':
        if (!newOptionDestination) {
          alert('Webhook URL is required');
          return;
        }
        action.destination = newOptionDestination;
        action.message = newOptionMessage;
        break;

      case 'end_call':
        action.message = newOptionMessage || 'Goodbye';
        break;
    }

    const updatedOptions = { ...nodeOptions, [newOptionKey]: action };
    setNodeOptions(updatedOptions);
    setAddingOption(false);
    setNewOptionKey('');
    setNewOptionDestination('');
    setNewOptionNodeId('');
    setNewOptionMessage('');
  }

  function removeOption(key: string) {
    const updatedOptions = { ...nodeOptions };
    delete updatedOptions[key];
    setNodeOptions(updatedOptions);
  }

  function exportMenu() {
    if (!selectedMenu) return;

    const exportData = {
      name: selectedMenu.name,
      description: selectedMenu.description,
      menu_tree: menuTree,
      timeout_seconds: selectedMenu.timeout_seconds,
      max_retries: selectedMenu.max_retries,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dtmf-menu-${selectedMenu.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
  }

  const currentNode = menuTree[selectedNode];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">DTMF Menus</h1>
            <p className="text-gray-600">Visual IVR menu builder</p>
          </div>
          <button
            onClick={() => setCreatingMenu(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            + New Menu
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Menu List */}
          <div className="col-span-1 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Menus</h2>

            {loading ? (
              <p className="text-gray-600">Loading...</p>
            ) : menus.length === 0 ? (
              <p className="text-gray-600">No menus yet</p>
            ) : (
              <div className="space-y-2">
                {menus.map((menu) => (
                  <div
                    key={menu.id}
                    className={`p-3 rounded border cursor-pointer ${
                      selectedMenu?.id === menu.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => loadMenu(menu.id)}
                  >
                    <div className="font-medium">{menu.name}</div>
                    {menu.description && (
                      <div className="text-sm text-gray-600">{menu.description}</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMenu(menu.id);
                        }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tree Visualization & Editor */}
          <div className="col-span-2 space-y-6">
            {selectedMenu ? (
              <>
                {/* Menu Info */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedMenu.name}</h2>
                      {selectedMenu.description && (
                        <p className="text-gray-600">{selectedMenu.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={exportMenu}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Export
                      </button>
                      <button
                        onClick={saveMenu}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {validationErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                      <p className="font-medium text-red-800">Validation Errors:</p>
                      <ul className="list-disc list-inside text-red-700 text-sm mt-1">
                        {validationErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tree View */}
                  <div className="border border-gray-200 rounded p-4 bg-gray-50">
                    <h3 className="font-medium mb-3">Menu Tree</h3>
                    <TreeNode
                      nodeId="root"
                      tree={menuTree}
                      selectedNode={selectedNode}
                      onSelectNode={setSelectedNode}
                      depth={0}
                    />
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const nodeId = prompt('Enter new node ID (e.g., "support_menu"):');
                        if (nodeId && !menuTree[nodeId]) {
                          addNode(nodeId);
                        } else if (menuTree[nodeId]) {
                          alert('Node ID already exists');
                        }
                      }}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      + Add Node
                    </button>
                  </div>
                </div>

                {/* Node Editor */}
                {currentNode && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">
                        Edit Node: <span className="text-blue-600">{selectedNode}</span>
                      </h3>
                      {selectedNode !== 'root' && (
                        <button
                          onClick={() => deleteNode(selectedNode)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete Node
                        </button>
                      )}
                    </div>

                    {editingNode ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Message</label>
                          <textarea
                            value={nodeMessage}
                            onChange={(e) => setNodeMessage(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Message to play when entering this menu"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium">Options (Keypresses)</label>
                            <button
                              onClick={() => setAddingOption(true)}
                              className="text-sm px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              + Add Option
                            </button>
                          </div>

                          <div className="space-y-2">
                            {Object.entries(nodeOptions).map(([key, action]) => (
                              <div
                                key={key}
                                className="border border-gray-200 rounded p-3 flex justify-between items-start"
                              >
                                <div>
                                  <span className="font-mono font-bold text-blue-600">{key}</span>
                                  <span className="mx-2">→</span>
                                  <span className="text-sm">
                                    {action.action === 'transfer' && `Transfer to ${action.destination}`}
                                    {action.action === 'menu' && `Go to ${action.node_id}`}
                                    {action.action === 'collect_input' && `Collect ${action.type}`}
                                    {action.action === 'webhook' && `Call webhook`}
                                    {action.action === 'end_call' && 'End call'}
                                  </span>
                                  {action.message && (
                                    <div className="text-xs text-gray-600 mt-1">"{action.message}"</div>
                                  )}
                                </div>
                                <button
                                  onClick={() => removeOption(key)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>

                          {addingOption && (
                            <div className="mt-4 border-t border-gray-200 pt-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm mb-1">Key (0-9, *, #)</label>
                                  <input
                                    type="text"
                                    maxLength={1}
                                    value={newOptionKey}
                                    onChange={(e) => setNewOptionKey(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm mb-1">Action</label>
                                  <select
                                    value={newOptionAction}
                                    onChange={(e) => setNewOptionAction(e.target.value as ActionType)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded"
                                  >
                                    <option value="transfer">Transfer</option>
                                    <option value="menu">Go to Menu</option>
                                    <option value="collect_input">Collect Input</option>
                                    <option value="webhook">Call Webhook</option>
                                    <option value="end_call">End Call</option>
                                  </select>
                                </div>
                              </div>

                              {newOptionAction === 'transfer' && (
                                <input
                                  type="text"
                                  placeholder="Phone number (e.g., +15551234567)"
                                  value={newOptionDestination}
                                  onChange={(e) => setNewOptionDestination(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                              )}

                              {newOptionAction === 'menu' && (
                                <select
                                  value={newOptionNodeId}
                                  onChange={(e) => setNewOptionNodeId(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded"
                                >
                                  <option value="">Select node...</option>
                                  {Object.keys(menuTree)
                                    .filter((id) => id !== selectedNode)
                                    .map((id) => (
                                      <option key={id} value={id}>
                                        {id}
                                      </option>
                                    ))}
                                </select>
                              )}

                              {newOptionAction === 'collect_input' && (
                                <select
                                  value={newOptionType}
                                  onChange={(e) => setNewOptionType(e.target.value as InputType)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded"
                                >
                                  <option value="numeric">Numeric</option>
                                  <option value="account_number">Account Number</option>
                                  <option value="pin">PIN</option>
                                  <option value="confirmation">Confirmation</option>
                                </select>
                              )}

                              {newOptionAction === 'webhook' && (
                                <input
                                  type="text"
                                  placeholder="Webhook URL"
                                  value={newOptionDestination}
                                  onChange={(e) => setNewOptionDestination(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded"
                                />
                              )}

                              <input
                                type="text"
                                placeholder="Optional message"
                                value={newOptionMessage}
                                onChange={(e) => setNewOptionMessage(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded"
                              />

                              <div className="flex gap-2">
                                <button
                                  onClick={addOptionToNode}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => {
                                    setAddingOption(false);
                                    setNewOptionKey('');
                                    setNewOptionDestination('');
                                    setNewOptionNodeId('');
                                    setNewOptionMessage('');
                                  }}
                                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-4 border-t border-gray-200">
                          <button
                            onClick={saveNodeEdits}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Save Node
                          </button>
                          <button
                            onClick={() => setEditingNode(false)}
                            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Message:</p>
                          <p className="text-gray-800 bg-gray-50 p-3 rounded">{currentNode.message}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-2">Options:</p>
                          <div className="space-y-2">
                            {Object.entries(currentNode.options || {}).map(([key, action]) => (
                              <div
                                key={key}
                                className="bg-gray-50 p-2 rounded text-sm flex items-center gap-2"
                              >
                                <span className="font-mono font-bold text-blue-600">{key}</span>
                                <span>→</span>
                                <span>
                                  {action.action === 'transfer' && `Transfer: ${action.destination}`}
                                  {action.action === 'menu' && `Menu: ${action.node_id}`}
                                  {action.action === 'collect_input' && `Input: ${action.type}`}
                                  {action.action === 'webhook' && 'Webhook'}
                                  {action.action === 'end_call' && 'End Call'}
                                </span>
                              </div>
                            ))}
                            {Object.keys(currentNode.options || {}).length === 0 && (
                              <p className="text-gray-500 text-sm">No options configured</p>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => startEditNode(selectedNode)}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Edit Node
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-600">Select a menu to edit or create a new one</p>
              </div>
            )}
          </div>
        </div>

        {/* Create Menu Modal */}
        {creatingMenu && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Create New Menu</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    placeholder="e.g., Main IVR Menu"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newMenuDescription}
                    onChange={(e) => setNewMenuDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={createMenu}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setCreatingMenu(false);
                      setNewMenuName('');
                      setNewMenuDescription('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tree visualization component
function TreeNode({
  nodeId,
  tree,
  selectedNode,
  onSelectNode,
  depth,
}: {
  nodeId: string;
  tree: Record<string, DTMFMenuNode>;
  selectedNode: string;
  onSelectNode: (id: string) => void;
  depth: number;
}) {
  const node = tree[nodeId];
  if (!node) return null;

  const hasOptions = node.options && Object.keys(node.options).length > 0;
  const isSelected = selectedNode === nodeId;

  return (
    <div className={`${depth > 0 ? 'ml-6 mt-2' : ''}`}>
      <div
        onClick={() => onSelectNode(nodeId)}
        className={`p-2 rounded cursor-pointer ${
          isSelected ? 'bg-blue-100 border border-blue-300' : 'bg-white border border-gray-200 hover:bg-gray-50'
        }`}
      >
        <div className="font-medium text-sm">{nodeId}</div>
        <div className="text-xs text-gray-600 truncate">{node.message}</div>
        {hasOptions && (
          <div className="text-xs text-gray-500 mt-1">
            {Object.keys(node.options!).length} option(s)
          </div>
        )}
      </div>

      {hasOptions &&
        Object.entries(node.options!).map(([key, action]) => {
          if (action.action === 'menu' && action.node_id) {
            return (
              <div key={key} className="mt-1">
                <div className="text-xs text-gray-500 ml-2">
                  Press <span className="font-mono font-bold">{key}</span> →
                </div>
                <TreeNode
                  nodeId={action.node_id}
                  tree={tree}
                  selectedNode={selectedNode}
                  onSelectNode={onSelectNode}
                  depth={depth + 1}
                />
              </div>
            );
          }
          return null;
        })}
    </div>
  );
}
