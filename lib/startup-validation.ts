/**
 * Feature 199: Startup Validation
 * Validates environment configuration on app startup
 */

import { validateSchedulingConfig } from './scheduling'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Run all startup validations
 * Throws error if critical configuration is missing
 */
export function validateStartupConfig(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate scheduling provider configuration
  const schedulingValidation = validateSchedulingConfig()
  if (!schedulingValidation.valid) {
    errors.push(...schedulingValidation.errors)
  }

  // Validate Supabase configuration
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is required')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('Either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
  }

  // Validate Vapi configuration (warning only - not critical)
  if (!process.env.VAPI_API_KEY) {
    warnings.push('VAPI_API_KEY is not set - voice agent features will not work')
  }

  // Validate Twilio configuration (warning only)
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    warnings.push('Twilio credentials not set - SMS features will not work')
  }

  // Validate OpenAI configuration (warning only)
  if (!process.env.OPENAI_API_KEY) {
    warnings.push('OPENAI_API_KEY not set - some AI features may not work')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Print validation results to console
 */
export function printValidationResults(results: ValidationResult): void {
  if (results.errors.length > 0) {
    console.error('\n❌ Configuration Errors:')
    results.errors.forEach((error) => console.error(`  - ${error}`))
  }

  if (results.warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:')
    results.warnings.forEach((warning) => console.warn(`  - ${warning}`))
  }

  if (results.valid && results.warnings.length === 0) {
    console.log('\n✅ Configuration validated successfully')
  }
}

/**
 * Validate configuration and throw if invalid
 * Call this at app startup
 */
export function validateOrThrow(): void {
  const results = validateStartupConfig()
  printValidationResults(results)

  if (!results.valid) {
    throw new Error(
      `Configuration validation failed. ${results.errors.length} error(s) found. Please check your environment variables.`
    )
  }
}
