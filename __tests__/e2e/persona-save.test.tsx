/**
 * E2E Test: Persona Save
 * Feature: F1217
 * Tests that persona can be saved and Vapi assistant is updated
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PersonasPage from '@/app/dashboard/personas/page'

// Mock fetch globally
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Mock alert
global.alert = jest.fn()

describe('E2E: Persona Save', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    ;(global.alert as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should save new persona and update Vapi assistant', async () => {
    const user = userEvent.setup()

    // Mock initial load - empty personas
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ personas: [] })
    } as Response)

    render(<PersonasPage />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Click "New Persona" button
    const newButton = screen.getByText('+ New Persona')
    await user.click(newButton)

    // Form should be visible
    expect(screen.getByText('Create New Persona')).toBeInTheDocument()

    // Fill in persona details
    const nameInput = screen.getByPlaceholderText(/e.g., Sales Assistant/)
    await user.type(nameInput, 'Test Sales Assistant')

    const promptTextarea = screen.getByPlaceholderText(/You are a helpful AI assistant/)
    await user.type(promptTextarea, 'You are a professional sales assistant who helps qualify leads and book appointments.')

    const firstMessageTextarea = screen.getByPlaceholderText(/Hello! How can I help you today?/)
    await user.type(firstMessageTextarea, 'Hi! Thanks for calling. How can I assist you today?')

    // Select a voice (find by looking for the select that contains voice options)
    const selects = screen.getAllByRole('combobox')
    const voiceSelect = selects.find(select => {
      const options = Array.from(select.querySelectorAll('option'))
      return options.some(opt => opt.textContent?.includes('Sarah (Professional)'))
    })

    if (voiceSelect) {
      await user.selectOptions(voiceSelect, 'EXAVITQu4vr4xnSDxMaL')
    }

    // Mock successful save response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        persona: {
          id: 'persona_1',
          name: 'Test Sales Assistant',
          vapi_assistant_id: 'asst_vapi_123'
        }
      })
    } as Response)

    // Mock reload personas after save
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        personas: [
          {
            id: 'persona_1',
            name: 'Test Sales Assistant',
            voice_id: 'EXAVITQu4vr4xnSDxMaL',
            system_prompt: 'You are a professional sales assistant who helps qualify leads and book appointments.',
            first_message: 'Hi! Thanks for calling. How can I assist you today?',
            fallback_phrases: [],
            vapi_assistant_id: 'asst_vapi_123',
            active: true
          }
        ]
      })
    } as Response)

    // Click save button
    const saveButton = screen.getByText('Create Persona')
    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    // Wait for success alert
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Persona saved successfully!')
    })

    // Verify API was called with correct data
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/personas',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Test Sales Assistant')
      })
    )

    // Form should be closed
    await waitFor(() => {
      expect(screen.queryByText('Create New Persona')).not.toBeInTheDocument()
    })

    // New persona should appear in the list
    await waitFor(() => {
      expect(screen.getByText('Test Sales Assistant')).toBeInTheDocument()
    })
  })

  it('should edit existing persona and update Vapi', async () => {
    const user = userEvent.setup()

    // Mock initial load with existing persona
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        personas: [
          {
            id: 'persona_1',
            name: 'Original Name',
            voice_id: 'default',
            system_prompt: 'Original prompt',
            first_message: 'Original message',
            fallback_phrases: [],
            vapi_assistant_id: 'asst_vapi_123',
            active: true
          }
        ]
      })
    } as Response)

    render(<PersonasPage />)

    await waitFor(() => {
      expect(screen.getByText('Original Name')).toBeInTheDocument()
    })

    // Click Edit button
    const editButton = screen.getByText('Edit')
    await user.click(editButton)

    // Form should be visible with existing data
    expect(screen.getByText('Edit Persona')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Original Name')).toBeInTheDocument()

    // Update the name
    const nameInput = screen.getByDisplayValue('Original Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Name')

    // Mock successful update response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        persona: {
          id: 'persona_1',
          name: 'Updated Name',
          vapi_assistant_id: 'asst_vapi_123'
        }
      })
    } as Response)

    // Mock reload after update
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        personas: [
          {
            id: 'persona_1',
            name: 'Updated Name',
            voice_id: 'default',
            system_prompt: 'Original prompt',
            first_message: 'Original message',
            fallback_phrases: [],
            vapi_assistant_id: 'asst_vapi_123',
            active: true
          }
        ]
      })
    } as Response)

    // Click update button
    const updateButton = screen.getByText('Update Persona')
    await user.click(updateButton)

    // Wait for success
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Persona saved successfully!')
    })

    // Verify PUT request was made
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/personas/persona_1',
      expect.objectContaining({
        method: 'PUT'
      })
    )
  })

  it('should require name and system prompt', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ personas: [] })
    } as Response)

    render(<PersonasPage />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Open form
    await user.click(screen.getByText('+ New Persona'))

    // Save button should be disabled when empty
    const saveButton = screen.getByText('Create Persona')
    expect(saveButton).toBeDisabled()

    // Add just name
    const nameInput = screen.getByPlaceholderText(/e.g., Sales Assistant/)
    await user.type(nameInput, 'Test')

    // Still disabled without system prompt
    expect(saveButton).toBeDisabled()

    // Add system prompt
    const promptTextarea = screen.getByPlaceholderText(/You are a helpful AI assistant/)
    await user.type(promptTextarea, 'You are a test assistant.')

    // Now should be enabled
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled()
    })
  })

  it('should handle save errors gracefully', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ personas: [] })
    } as Response)

    render(<PersonasPage />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByText('+ New Persona'))

    // Fill in required fields
    await user.type(screen.getByPlaceholderText(/e.g., Sales Assistant/), 'Test')
    await user.type(screen.getByPlaceholderText(/You are a helpful AI assistant/), 'Test prompt')

    // Mock failed save
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Vapi API key invalid' })
    } as Response)

    await user.click(screen.getByText('Create Persona'))

    // Should show error alert
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Vapi API key invalid'))
    })

    // Form should still be open
    expect(screen.getByText('Create New Persona')).toBeInTheDocument()
  })

  it('should support voice preview', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ personas: [] })
    } as Response)

    render(<PersonasPage />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByText('+ New Persona'))

    // Find and click preview button
    const previewButton = screen.getByTitle('Preview voice')
    await user.click(previewButton)

    // Should show alert with voice info
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Voice preview'))
  })

  it('should add and remove fallback phrases', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ personas: [] })
    } as Response)

    render(<PersonasPage />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByText('+ New Persona'))

    // Add a fallback phrase
    const fallbackInput = screen.getByPlaceholderText(/I'm not sure I understand/)
    await user.type(fallbackInput, 'Could you please repeat that?')

    const addButton = screen.getByText('Add')
    await user.click(addButton)

    // Phrase should appear in list
    expect(screen.getByText('Could you please repeat that?')).toBeInTheDocument()

    // Should have a Remove button
    const removeButton = screen.getByText('Remove')
    expect(removeButton).toBeInTheDocument()

    await user.click(removeButton)

    // Phrase should be gone
    await waitFor(() => {
      expect(screen.queryByText('Could you please repeat that?')).not.toBeInTheDocument()
    })
  })

  it('should show character count for system prompt', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ personas: [] })
    } as Response)

    render(<PersonasPage />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByText('+ New Persona'))

    // Type in system prompt
    const promptTextarea = screen.getByPlaceholderText(/You are a helpful AI assistant/)
    await user.type(promptTextarea, 'Test prompt')

    // Should show character count
    expect(screen.getByText(/11\/2000 characters/)).toBeInTheDocument()
  })

  it('should allow template selection for system prompt', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ personas: [] })
    } as Response)

    render(<PersonasPage />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByText('+ New Persona'))

    // Get initial prompt value
    const promptTextarea = screen.getByPlaceholderText(/You are a helpful AI assistant/)
    const initialValue = (promptTextarea as HTMLTextAreaElement).value

    // Find template selector (it's a select with "Use template..." option)
    const templateSelects = screen.getAllByRole('combobox')
    const templateSelect = templateSelects.find(select => {
      const options = Array.from(select.querySelectorAll('option'))
      return options.some(opt => opt.textContent?.includes('Use template'))
    })

    expect(templateSelect).toBeDefined()

    // Select a template
    if (templateSelect) {
      await user.selectOptions(templateSelect, 'sales')
    }

    // System prompt should be populated with template content
    await waitFor(() => {
      const currentValue = (promptTextarea as HTMLTextAreaElement).value
      expect(currentValue).not.toBe(initialValue)
      expect(currentValue.length).toBeGreaterThan(50) // Template should have content
    })
  })
})
