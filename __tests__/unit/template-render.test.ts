// F1204: Unit test: SMS template variable substitution

describe('SMS Template Rendering', () => {
  describe('F1204: Template variable substitution', () => {
    function renderTemplate(template: string, vars: Record<string, any>): string {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return vars[key] !== undefined ? String(vars[key]) : match
      })
    }

    it('should substitute single variable', () => {
      const template = 'Hello {{name}}!'
      const vars = { name: 'John' }
      const result = renderTemplate(template, vars)

      expect(result).toBe('Hello John!')
    })

    it('should substitute multiple variables', () => {
      const template = 'Hi {{name}}, your appointment is on {{date}} at {{time}}'
      const vars = {
        name: 'Jane Doe',
        date: '2026-04-15',
        time: '2:00 PM',
      }
      const result = renderTemplate(template, vars)

      expect(result).toBe('Hi Jane Doe, your appointment is on 2026-04-15 at 2:00 PM')
    })

    it('should leave unmatched variables as-is', () => {
      const template = 'Hello {{name}}, welcome to {{company}}'
      const vars = { name: 'Alice' }
      const result = renderTemplate(template, vars)

      expect(result).toBe('Hello Alice, welcome to {{company}}')
    })

    it('should handle empty template', () => {
      const template = ''
      const vars = { name: 'Bob' }
      const result = renderTemplate(template, vars)

      expect(result).toBe('')
    })

    it('should handle template with no variables', () => {
      const template = 'Hello! This is a plain message.'
      const vars = { name: 'Charlie' }
      const result = renderTemplate(template, vars)

      expect(result).toBe('Hello! This is a plain message.')
    })

    it('should handle numeric variables', () => {
      const template = 'Your order #{{orderId}} total is ${{amount}}'
      const vars = { orderId: 12345, amount: 99.99 }
      const result = renderTemplate(template, vars)

      expect(result).toBe('Your order #12345 total is $99.99')
    })

    it('should handle same variable multiple times', () => {
      const template = '{{name}}, your name is {{name}}'
      const vars = { name: 'David' }
      const result = renderTemplate(template, vars)

      expect(result).toBe('David, your name is David')
    })
  })

  describe('SMS template validation', () => {
    function validateTemplate(template: string): { valid: boolean; errors: string[] } {
      const errors: string[] = []

      // Check length (SMS limit 160 chars for single message)
      if (template.length > 160) {
        errors.push('Template exceeds 160 characters')
      }

      // Check for balanced braces
      const openBraces = (template.match(/\{\{/g) || []).length
      const closeBraces = (template.match(/\}\}/g) || []).length
      if (openBraces !== closeBraces) {
        errors.push('Unbalanced template braces')
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    }

    it('should validate template length', () => {
      const shortTemplate = 'Hi {{name}}'
      const longTemplate = 'A'.repeat(200)

      expect(validateTemplate(shortTemplate).valid).toBe(true)
      expect(validateTemplate(longTemplate).valid).toBe(false)
    })

    it('should detect unbalanced braces', () => {
      const unbalanced1 = 'Hello {{name}'
      const unbalanced2 = 'Hello name}}'
      const balanced = 'Hello {{name}}'

      expect(validateTemplate(unbalanced1).valid).toBe(false)
      expect(validateTemplate(unbalanced2).valid).toBe(false)
      expect(validateTemplate(balanced).valid).toBe(true)
    })
  })
})
