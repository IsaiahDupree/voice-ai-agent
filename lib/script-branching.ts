// F0224: Dynamic script branching
// Script branches based on contact attributes

import { supabaseAdmin } from './supabase'

export interface ScriptBranch {
  id: string
  assistant_id: string
  branch_name: string
  condition_field: string // e.g., "company_size", "deal_stage", "industry"
  condition_operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
  condition_value: string
  script_override: string
}

/**
 * F0224: Get matching script branch for contact
 * Returns script override if contact matches any branch conditions
 */
export async function getScriptForContact(
  assistantId: string,
  contactAttributes: Record<string, any>
): Promise<string | null> {
  try {
    // Get all script branches for this assistant
    const { data: branches } = await supabaseAdmin
      .from('voice_agent_script_branches')
      .select('*')
      .eq('assistant_id', assistantId)
      .order('created_at', { ascending: true }) // First created = highest priority

    if (!branches || branches.length === 0) {
      return null
    }

    // Check each branch condition
    for (const branch of branches as ScriptBranch[]) {
      const fieldValue = contactAttributes[branch.condition_field]

      if (fieldValue === undefined) {
        continue // Skip if contact doesn't have this attribute
      }

      const matches = evaluateCondition(
        fieldValue,
        branch.condition_operator,
        branch.condition_value
      )

      if (matches) {
        console.log(
          `Script branch matched: ${branch.branch_name} (${branch.condition_field} ${branch.condition_operator} ${branch.condition_value})`
        )
        return branch.script_override
      }
    }

    return null // No matching branch
  } catch (error) {
    console.error('Error getting script branch:', error)
    return null
  }
}

/**
 * F0224: Evaluate branch condition
 */
function evaluateCondition(
  actualValue: any,
  operator: string,
  expectedValue: string
): boolean {
  // Convert to comparable types
  const actual = String(actualValue).toLowerCase()
  const expected = String(expectedValue).toLowerCase()

  switch (operator) {
    case 'eq':
      return actual === expected

    case 'ne':
      return actual !== expected

    case 'contains':
      return actual.includes(expected)

    case 'gt':
      return Number(actualValue) > Number(expectedValue)

    case 'lt':
      return Number(actualValue) < Number(expectedValue)

    case 'gte':
      return Number(actualValue) >= Number(expectedValue)

    case 'lte':
      return Number(actualValue) <= Number(expectedValue)

    default:
      return false
  }
}

/**
 * F0224: Create a new script branch
 */
export async function createScriptBranch(
  branch: Omit<ScriptBranch, 'id'>
): Promise<ScriptBranch> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_script_branches')
      .insert(branch)
      .select()
      .single()

    if (error) throw error

    console.log(`Created script branch: ${branch.branch_name}`)
    return data as ScriptBranch
  } catch (error) {
    console.error('Error creating script branch:', error)
    throw error
  }
}
