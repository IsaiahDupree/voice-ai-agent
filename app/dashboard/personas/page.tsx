// F0719: Agent persona builder tab
// F0720: Persona name field
// F0721: Persona voice dropdown
// F0722: Persona system prompt editor
// F0723: Persona first message editor
// F0725: Persona save button
// F0779: Persona assign to number

'use client'

import { useEffect, useState } from 'react'

interface Persona {
  id: string
  name: string
  voice_id: string
  system_prompt: string
  first_message: string
  fallback_phrases: string[]
  vapi_assistant_id: string
  active: boolean
}

const ELEVENLABS_VOICES = [
  { id: 'default', name: 'Default Voice' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Professional)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Conversational)' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Business)' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Warm)' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Authoritative)' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Professional Male)' },
]

// F0769: System prompt templates
const PROMPT_TEMPLATES = [
  {
    id: 'sales',
    name: 'Sales Assistant',
    prompt: `You are a professional sales assistant. Your role is to qualify leads, understand their needs, and book appointments with our sales team. Be friendly, consultative, and focus on understanding the customer's pain points. Always ask for permission before booking a meeting.`,
  },
  {
    id: 'support',
    name: 'Customer Support',
    prompt: `You are a helpful customer support agent. Your goal is to resolve customer issues efficiently and professionally. Listen carefully to their concerns, ask clarifying questions, and provide clear solutions. If you cannot resolve an issue, offer to escalate to a human representative.`,
  },
  {
    id: 'appointment',
    name: 'Appointment Scheduler',
    prompt: `You are an appointment scheduling assistant. Your job is to help customers book appointments at convenient times. Check calendar availability, confirm details, and send confirmation messages. Be flexible and accommodating to customer scheduling needs.`,
  },
  {
    id: 'receptionist',
    name: 'Virtual Receptionist',
    prompt: `You are a friendly virtual receptionist. Greet callers warmly, route them to the appropriate department or person, and take messages when needed. Be professional, courteous, and ensure every caller feels valued.`,
  },
]

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // F0720-F0724: Form fields
  const [formData, setFormData] = useState({
    name: '',
    voice_id: 'default',
    system_prompt: '',
    first_message: '',
    fallback_phrases: [] as string[],
    tone: 'professional' as 'professional' | 'friendly' | 'casual' | 'formal', // F0777
    language: 'en-US' as string, // F0778
    active: true, // F0780
    opening_script: '', // F0789
    closing_script: '', // F0790
    max_call_duration: 300, // F0794: 5 minutes default
    silence_timeout: 30, // F0795: 30 seconds default
    is_default: false, // F0806
  })
  const [newFallbackPhrase, setNewFallbackPhrase] = useState('')
  const [testCallNumber, setTestCallNumber] = useState('')
  const [testingCall, setTestingCall] = useState(false)
  const [showFirstMessagePreview, setShowFirstMessagePreview] = useState(false) // F0773
  const [selectedTemplate, setSelectedTemplate] = useState<string>('') // F0769
  const [modelProvider, setModelProvider] = useState<'openai' | 'anthropic'>('openai') // F0796

  useEffect(() => {
    loadPersonas()
  }, [])

  async function loadPersonas() {
    try {
      const res = await fetch('/api/personas')
      if (res.ok) {
        const data = await res.json()
        setPersonas(data.personas || [])
      }
    } catch (error) {
      console.error('Error loading personas:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      // F0725: Persona save button - applies config to Vapi assistant
      const endpoint = editing ? `/api/personas/${editing}` : '/api/personas'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        alert('Persona saved successfully!')
        setCreating(false)
        setEditing(null)
        setFormData({
          name: '',
          voice_id: 'default',
          system_prompt: '',
          first_message: '',
          fallback_phrases: [],
          tone: 'professional',
          language: 'en-US',
          active: true,
          opening_script: '',
          closing_script: '',
          max_call_duration: 300,
          silence_timeout: 30,
          is_default: false,
        })
        loadPersonas()
      } else {
        const error = await res.json()
        alert(`Error saving persona: ${error.error}`)
      }
    } catch (error: any) {
      console.error('Error saving persona:', error)
      alert(`Error: ${error.message}`)
    }
  }

  function handleEdit(persona: Persona) {
    setEditing(persona.id)
    setFormData({
      name: persona.name,
      voice_id: persona.voice_id || 'default',
      system_prompt: persona.system_prompt || '',
      first_message: persona.first_message || '',
      fallback_phrases: persona.fallback_phrases || [],
      tone: (persona as any).tone || 'professional',
      language: (persona as any).language || 'en-US',
      active: persona.active !== undefined ? persona.active : true,
      opening_script: (persona as any).opening_script || '',
      closing_script: (persona as any).closing_script || '',
      max_call_duration: (persona as any).max_call_duration || 300,
      silence_timeout: (persona as any).silence_timeout || 30,
      is_default: (persona as any).is_default || false,
    })
    setCreating(true)
  }

  // F0726: Test call function
  async function handleTestCall(personaId: string) {
    if (!testCallNumber) {
      alert('Please enter a phone number for the test call')
      return
    }

    setTestingCall(true)
    try {
      const res = await fetch('/api/campaigns/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_id: personaId,
          phone_number: testCallNumber,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        alert(`Test call initiated! Call ID: ${data.call_id || 'pending'}`)
        setTestCallNumber('')
      } else {
        const error = await res.json()
        alert(`Failed to initiate test call: ${error.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('Test call error:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setTestingCall(false)
    }
  }

  // F0802: Persona deletion guard
  async function handleDelete(id: string, name: string) {
    const confirmation = prompt(
      `⚠️ WARNING: You are about to delete the persona "${name}".\n\n` +
      `This action cannot be undone. Any campaigns using this persona will be affected.\n\n` +
      `Type "${name}" exactly to confirm deletion:`
    )

    if (confirmation !== name) {
      if (confirmation !== null) {
        alert('Deletion cancelled: Name did not match')
      }
      return
    }

    try {
      const res = await fetch(`/api/personas/${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Persona deleted successfully')
        loadPersonas()
      } else {
        const error = await res.json()
        alert(`Failed to delete: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting persona:', error)
      alert('Failed to delete persona')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Agent Personas</h1>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setCreating(!creating)
                setEditing(null)
                setFormData({
                  name: '',
                  voice_id: 'default',
                  system_prompt: '',
                  first_message: '',
                  fallback_phrases: [],
                  tone: 'professional',
                  language: 'en-US',
                  active: true,
                  opening_script: '',
                  closing_script: '',
                  max_call_duration: 300,
                  silence_timeout: 30,
                  is_default: false,
                })
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + New Persona
            </button>
            <a
              href="/dashboard"
              className="px-4 py-2 bg-white rounded-lg shadow hover:bg-gray-50 transition"
            >
              ← Back
            </a>
          </div>
        </div>

        {/* Persona Creation/Edit Form */}
        {creating && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editing ? 'Edit Persona' : 'Create New Persona'}
            </h2>

            <div className="space-y-4">
              {/* F0720: Persona name field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Persona Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Sales Assistant, Support Agent"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={50}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.name.length}/50 characters
                </p>
              </div>

              {/* F0721, F0764, F0765: Persona voice dropdown with preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ElevenLabs Voice
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.voice_id}
                    onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {ELEVENLABS_VOICES.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                  {/* F0764: Voice preview button */}
                  <button
                    type="button"
                    onClick={() => {
                      alert(`Voice preview for ${formData.voice_id}\nIn a production app, this would play a sample audio clip.`)
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-1"
                    title="Preview voice"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    Preview
                  </button>
                </div>
              </div>

              {/* F0769, F0722, F0771, F0772: Persona system prompt editor with templates */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    System Prompt *
                  </label>
                  {/* F0769: Template selector */}
                  <select
                    value={selectedTemplate}
                    onChange={(e) => {
                      const template = PROMPT_TEMPLATES.find(t => t.id === e.target.value)
                      if (template) {
                        setFormData({ ...formData, system_prompt: template.prompt })
                      }
                      setSelectedTemplate(e.target.value)
                    }}
                    className="text-xs px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="">Use template...</option>
                    {PROMPT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={formData.system_prompt}
                  onChange={(e) =>
                    setFormData({ ...formData, system_prompt: e.target.value })
                  }
                  placeholder="You are a helpful AI assistant. Your role is to..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={6}
                  maxLength={2000}
                />
                {/* F0771: Prompt character count, F0772: Prompt max length indicator */}
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-500">
                    Define the agent's personality, role, and instructions
                  </p>
                  <p className={`text-xs font-medium ${
                    formData.system_prompt.length > 1800 ? 'text-orange-600' :
                    formData.system_prompt.length > 1900 ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {formData.system_prompt.length}/2000 characters
                    {formData.system_prompt.length > 1800 && ' (approaching limit)'}
                  </p>
                </div>
              </div>

              {/* F0723, F0773: Persona first message editor with preview */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    First Message
                  </label>
                  {formData.first_message && (
                    <button
                      type="button"
                      onClick={() => setShowFirstMessagePreview(!showFirstMessagePreview)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showFirstMessagePreview ? 'Hide' : 'Show'} Preview
                    </button>
                  )}
                </div>
                <textarea
                  value={formData.first_message}
                  onChange={(e) =>
                    setFormData({ ...formData, first_message: e.target.value })
                  }
                  placeholder="Hello! How can I help you today?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                {/* F0773: First message preview */}
                {showFirstMessagePreview && formData.first_message && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-900 mb-1">Preview:</p>
                    <p className="text-sm text-blue-800 italic">"{formData.first_message}"</p>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  The first thing the agent says when the call connects
                </p>
              </div>

              {/* F0724, F0775, F0776: Fallback phrases list input with validation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fallback Phrases {formData.fallback_phrases.length < 2 && (
                    <span className="text-xs text-orange-600">(minimum 2 recommended)</span>
                  )}
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFallbackPhrase}
                      onChange={(e) => setNewFallbackPhrase(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          // F0775: Fallback phrase validation
                          if (newFallbackPhrase.trim() && newFallbackPhrase.trim().length >= 10) {
                            setFormData({
                              ...formData,
                              fallback_phrases: [...formData.fallback_phrases, newFallbackPhrase.trim()],
                            })
                            setNewFallbackPhrase('')
                          } else if (newFallbackPhrase.trim().length < 10) {
                            alert('Fallback phrase must be at least 10 characters')
                          }
                        }
                      }}
                      placeholder="e.g., I'm not sure I understand, could you rephrase that?"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      minLength={10}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        // F0775: Fallback phrase validation
                        if (newFallbackPhrase.trim() && newFallbackPhrase.trim().length >= 10) {
                          setFormData({
                            ...formData,
                            fallback_phrases: [...formData.fallback_phrases, newFallbackPhrase.trim()],
                          })
                          setNewFallbackPhrase('')
                        } else if (newFallbackPhrase.trim().length < 10) {
                          alert('Fallback phrase must be at least 10 characters')
                        }
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                    >
                      Add
                    </button>
                  </div>
                  {formData.fallback_phrases.length > 0 && (
                    <div className="space-y-1">
                      {formData.fallback_phrases.map((phrase, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                        >
                          <span className="text-sm text-gray-700">{phrase}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                fallback_phrases: formData.fallback_phrases.filter((_, i) => i !== idx),
                              })
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* F0776: Fallback phrase minimum warning */}
                <p className={`text-xs mt-1 ${
                  formData.fallback_phrases.length < 2 ? 'text-orange-600' : 'text-gray-500'
                }`}>
                  Phrases the agent uses when it doesn't understand or needs clarification
                  {formData.fallback_phrases.length < 2 && ' (add at least 2 for better variety)'}
                </p>
              </div>

              {/* F0777: Tone selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tone
                </label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The overall tone and style of the agent's responses
                </p>
              </div>

              {/* F0796: Model selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Model
                </label>
                <select
                  value={modelProvider}
                  onChange={(e) => setModelProvider(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="openai">OpenAI GPT-4o (Recommended)</option>
                  <option value="anthropic">Anthropic Claude 3.5 Sonnet</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The underlying AI model for natural language understanding
                </p>
              </div>

              {/* F0778: Language selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish (Spain)</option>
                  <option value="es-MX">Spanish (Mexico)</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="it-IT">Italian</option>
                  <option value="pt-BR">Portuguese (Brazil)</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="zh-CN">Chinese (Simplified)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Primary language for agent interactions
                </p>
              </div>

              {/* F0789: Opening script */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opening Script (Optional)
                </label>
                <textarea
                  value={formData.opening_script}
                  onChange={(e) => setFormData({ ...formData, opening_script: e.target.value })}
                  placeholder="Additional context or greeting beyond the first message..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Additional context appended to the system prompt
                </p>
              </div>

              {/* F0790: Closing script */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Closing Script (Optional)
                </label>
                <textarea
                  value={formData.closing_script}
                  onChange={(e) => setFormData({ ...formData, closing_script: e.target.value })}
                  placeholder="e.g., Thank you for your time. Have a great day!"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
                <p className="text-xs text-gray-500 mt-1">
                  What the agent says before ending the call
                </p>
              </div>

              {/* F0794: Max call duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Call Duration (seconds)
                </label>
                <input
                  type="number"
                  value={formData.max_call_duration}
                  onChange={(e) => setFormData({ ...formData, max_call_duration: parseInt(e.target.value) || 300 })}
                  min={30}
                  max={3600}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum duration for calls using this persona (30-3600 seconds)
                </p>
              </div>

              {/* F0795: Silence timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Silence Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={formData.silence_timeout}
                  onChange={(e) => setFormData({ ...formData, silence_timeout: parseInt(e.target.value) || 30 })}
                  min={5}
                  max={120}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How long to wait for caller response before prompting (5-120 seconds)
                </p>
              </div>

              {/* F0780: Persona active flag & F0806: Default persona */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Active (persona can be assigned to campaigns)
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_default" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Default Persona (used when no persona specified)
                  </label>
                </div>
              </div>

              {/* F0725: Persona save button */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setCreating(false)
                    setEditing(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formData.name || !formData.system_prompt}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {editing ? 'Update Persona' : 'Create Persona'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Personas List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Existing Personas</h2>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : personas.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                No personas created yet. Click "New Persona" to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {persona.name}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              persona.active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {persona.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          Voice:{' '}
                          {ELEVENLABS_VOICES.find((v) => v.id === persona.voice_id)?.name ||
                            'Default'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {persona.system_prompt}
                        </p>
                        {persona.first_message && (
                          <p className="text-xs text-gray-500 mt-2 italic">
                            "{persona.first_message}"
                          </p>
                        )}
                        {persona.fallback_phrases && persona.fallback_phrases.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-600">Fallback phrases:</p>
                            <ul className="text-xs text-gray-500 list-disc list-inside">
                              {persona.fallback_phrases.slice(0, 3).map((phrase, idx) => (
                                <li key={idx}>{phrase}</li>
                              ))}
                              {persona.fallback_phrases.length > 3 && (
                                <li>+{persona.fallback_phrases.length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(persona)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition text-sm"
                        >
                          Edit
                        </button>
                        {/* F0802: Persona deletion with guard */}
                        <button
                          onClick={() => handleDelete(persona.id, persona.name)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition text-sm"
                        >
                          Delete
                        </button>
                        {/* F0726: Test call button */}
                        <div className="mt-2 space-y-1">
                          <input
                            type="tel"
                            value={testCallNumber}
                            onChange={(e) => setTestCallNumber(e.target.value)}
                            placeholder="Test phone #"
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                          />
                          <button
                            onClick={() => handleTestCall(persona.id)}
                            disabled={testingCall || !testCallNumber}
                            className="w-full px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {testingCall ? 'Calling...' : 'Test Call'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
