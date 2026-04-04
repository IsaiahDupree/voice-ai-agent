/**
 * Templates library for call scripts and message templates
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface Template {
  id: string
  name: string
  description?: string
  category: string
  content: string
  variables?: string[]
  org_id?: string
  created_at: string
  updated_at: string
  created_by?: string
}

/**
 * Get all templates for organization
 */
export async function getTemplates(orgId: string): Promise<Template[]> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching templates:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getTemplates:', error)
    return []
  }
}

/**
 * Get template by ID
 */
export async function getTemplate(templateId: string): Promise<Template | null> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error) {
      console.error('Error fetching template:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getTemplate:', error)
    return null
  }
}

/**
 * Create new template
 */
export async function createTemplate(
  template: Omit<Template, 'id' | 'created_at' | 'updated_at'>
): Promise<Template | null> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('templates')
      .insert({
        ...template,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in createTemplate:', error)
    return null
  }
}

/**
 * Update template
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<Template, 'id' | 'created_at'>>
): Promise<Template | null> {
  const supabase = supabaseAdmin

  try {
    const { data, error } = await supabase
      .from('templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in updateTemplate:', error)
    return null
  }
}

/**
 * Delete template
 */
export async function deleteTemplate(templateId: string): Promise<boolean> {
  const supabase = supabaseAdmin

  try {
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      console.error('Error deleting template:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error in deleteTemplate:', error)
    return false
  }
}

/**
 * Extract variables from template content
 */
export function extractVariables(content: string): string[] {
  const variablePattern = /\{\{([^}]+)\}\}/g
  const variables: Set<string> = new Set()

  let match
  while ((match = variablePattern.exec(content)) !== null) {
    variables.add(`{{${match[1]}}}`)
  }

  return Array.from(variables)
}

/**
 * Validate template
 */
export function validateTemplate(
  template: Partial<Template>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!template.name || template.name.trim() === '') {
    errors.push('Template name is required')
  }

  if (!template.category || template.category.trim() === '') {
    errors.push('Template category is required')
  }

  if (!template.content || template.content.trim() === '') {
    errors.push('Template content is required')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
