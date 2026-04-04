/**
 * Language Variants Dashboard
 * Manage multilingual assistant configurations for auto-language detection
 */

'use client';

import { useEffect, useState } from 'react';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '@/lib/language-detector';

interface LanguageVariant {
  id: number;
  base_assistant_id: string;
  language_code: SupportedLanguageCode;
  language_name?: string;
  vapi_assistant_id: string;
  voice_id?: string;
  system_prompt_template?: string;
  stt_language?: string;
  tts_language?: string;
  tenant_id: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

const ELEVENLABS_MULTILINGUAL_VOICES: Record<SupportedLanguageCode, { id: string; name: string }[]> = {
  en: [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Professional)' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Conversational)' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Professional Male)' },
  ],
  es: [
    { id: 'VYWJe7e3ZqYHzHqIkqxR', name: 'Ana (Spanish - Professional)' },
    { id: 'G3YhwqYXKcKqCZDBwSgN', name: 'Carlos (Spanish - Warm)' },
  ],
  fr: [
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Marie (French - Professional)' },
    { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Pierre (French - Business)' },
  ],
  de: [
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Anna (German - Professional)' },
    { id: 'iP95p4xoKVk53GoZ742B', name: 'Klaus (German - Authoritative)' },
  ],
  pt: [
    { id: 'EHGtRhaMNdZHrFXdLwrk', name: 'Maria (Portuguese - Friendly)' },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'João (Portuguese - Professional)' },
  ],
  zh: [
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Li (Chinese - Professional)' },
  ],
  hi: [
    { id: 'zIq6HTgd4z9W9T4G3h8L', name: 'Priya (Hindi - Friendly)' },
  ],
  ja: [
    { id: 'VHlPsm8qLq1T9z4J3h8L', name: 'Yuki (Japanese - Professional)' },
  ],
};

export default function LanguageVariantsPage() {
  const [variants, setVariants] = useState<LanguageVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [baseAssistantId, setBaseAssistantId] = useState('');
  const [tenantId, setTenantId] = useState('default');

  const [formData, setFormData] = useState<Partial<LanguageVariant>>({
    language_code: 'es',
    vapi_assistant_id: '',
    voice_id: '',
    system_prompt_template: '',
    stt_language: '',
    tts_language: '',
  });

  useEffect(() => {
    loadVariants();
  }, [baseAssistantId, tenantId]);

  async function loadVariants() {
    if (!baseAssistantId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/assistants/${baseAssistantId}/language-variants?tenant_id=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setVariants(data.data || []);
      }
    } catch (error) {
      console.error('Error loading language variants:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createVariant() {
    if (!baseAssistantId || !formData.language_code || !formData.vapi_assistant_id) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const res = await fetch(`/api/assistants/${baseAssistantId}/language-variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          stt_language: formData.stt_language || formData.language_code,
          tts_language: formData.tts_language || formData.language_code,
          tenant_id: tenantId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setVariants([...variants, data.data]);
        setCreating(false);
        setFormData({
          language_code: 'es',
          vapi_assistant_id: '',
          voice_id: '',
          system_prompt_template: '',
          stt_language: '',
          tts_language: '',
        });
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to create variant'}`);
      }
    } catch (error) {
      console.error('Error creating variant:', error);
      alert('Failed to create language variant');
    }
  }

  async function deleteVariant(languageCode: SupportedLanguageCode) {
    if (!confirm(`Delete ${SUPPORTED_LANGUAGES[languageCode]} variant?`)) return;

    try {
      const res = await fetch(
        `/api/assistants/${baseAssistantId}/language-variants?language_code=${languageCode}&tenant_id=${tenantId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setVariants(variants.filter((v) => v.language_code !== languageCode));
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to delete variant'}`);
      }
    } catch (error) {
      console.error('Error deleting variant:', error);
      alert('Failed to delete language variant');
    }
  }

  async function testDetection() {
    const testText = prompt('Enter text to detect language:');
    if (!testText) return;

    try {
      const res = await fetch('/api/language/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText, currentLanguage: 'en' }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `Detected: ${data.data.languageName} (${data.data.language})\nConfidence: ${data.data.confidence}%\nShould switch: ${data.data.shouldSwitch}`
        );
      }
    } catch (error) {
      console.error('Error testing detection:', error);
      alert('Failed to test language detection');
    }
  }

  const availableLanguages = Object.keys(SUPPORTED_LANGUAGES).filter(
    (lang) => !variants.some((v) => v.language_code === lang)
  ) as SupportedLanguageCode[];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Language Variants</h1>
        <p className="text-gray-600 mb-8">
          Configure multilingual assistant variants for automatic language detection and switching
        </p>

        {/* Configuration */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Assistant ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={baseAssistantId}
                onChange={(e) => setBaseAssistantId(e.target.value)}
                placeholder="e.g., asst_abc123..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={loadVariants}
              disabled={!baseAssistantId}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Load Variants
            </button>
            <button
              onClick={testDetection}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Test Language Detection
            </button>
          </div>
        </div>

        {/* Existing Variants */}
        {baseAssistantId && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Configured Variants ({variants.length})
              </h2>
              <button
                onClick={() => setCreating(true)}
                disabled={availableLanguages.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                + Add Language Variant
              </button>
            </div>

            {loading ? (
              <p className="text-gray-600">Loading...</p>
            ) : variants.length === 0 ? (
              <p className="text-gray-600">No language variants configured yet.</p>
            ) : (
              <div className="space-y-3">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="border border-gray-200 rounded-lg p-4 flex justify-between items-start"
                  >
                    <div>
                      <h3 className="font-semibold text-lg">
                        {variant.language_name || SUPPORTED_LANGUAGES[variant.language_code]}
                      </h3>
                      <p className="text-sm text-gray-600">Code: {variant.language_code}</p>
                      <p className="text-sm text-gray-600">
                        Vapi Assistant: {variant.vapi_assistant_id}
                      </p>
                      {variant.voice_id && (
                        <p className="text-sm text-gray-600">Voice ID: {variant.voice_id}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteVariant(variant.language_code)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Form */}
        {creating && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Add Language Variant</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Language <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.language_code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      language_code: e.target.value as SupportedLanguageCode,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {SUPPORTED_LANGUAGES[lang]} ({lang})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vapi Assistant ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.vapi_assistant_id}
                  onChange={(e) =>
                    setFormData({ ...formData, vapi_assistant_id: e.target.value })
                  }
                  placeholder="asst_xyz789..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ElevenLabs Voice ID
                </label>
                <select
                  value={formData.voice_id}
                  onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select voice...</option>
                  {formData.language_code &&
                    ELEVENLABS_MULTILINGUAL_VOICES[formData.language_code]?.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System Prompt Template
                </label>
                <textarea
                  value={formData.system_prompt_template}
                  onChange={(e) =>
                    setFormData({ ...formData, system_prompt_template: e.target.value })
                  }
                  rows={4}
                  placeholder="Translated system prompt for this language..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={createVariant}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Variant
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
