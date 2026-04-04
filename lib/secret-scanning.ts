// F1163: Secret scanning - CI step scans for accidentally committed secrets

/**
 * F1163: Patterns for detecting accidentally committed secrets
 */
export const SECRET_PATTERNS = {
  // API Keys
  apiKey: /[aA][pP][iI][\s_]?[kK][eE][yY][\s]*[=:]\s*['\"]?([a-zA-Z0-9_\-]{20,})['\"]?/g,

  // AWS
  awsAccessKey: /AKIA[0-9A-Z]{16}/g,
  awsSecretKey: /aws_secret_access_key[\s]*[=:]\s*['\"]([a-zA-Z0-9\/+=]{40})['\"]?/g,

  // GitHub
  githubToken: /gh[pousr]_[A-Za-z0-9_]{36,255}/g,

  // Slack
  slackToken: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[0-9a-zA-Z]{24,32}/g,

  // Private Keys
  privateKeyRsa: /-----BEGIN RSA PRIVATE KEY-----/g,
  privateKeyEcdsa: /-----BEGIN EC PRIVATE KEY-----/g,
  privateKeyOpenSSH: /-----BEGIN OPENSSH PRIVATE KEY-----/g,

  // Database URLs
  postgresUrl: /postgres[ql]*:\/\/[^\s:]+:[^\s@]+@[^\s\/]+/g,
  mysqlUrl: /mysql:\/\/[^\s:]+:[^\s@]+@[^\s\/]+/g,

  // Passwords
  password: /[pP][aA][sS][sS][wW][oO][rR][dD][\s]*[=:]\s*['\"]([^'\"]{8,})['\"]?/g,

  // JWT
  jwtToken: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,

  // Supabase
  supabaseKey: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
}

export interface SecretScanResult {
  found: boolean
  secrets: Array<{
    type: string
    pattern: string
    lineNumber?: number
  }>
  filePath: string
}

/**
 * F1163: Scan content for secrets
 */
export function scanForSecrets(content: string, filePath: string): SecretScanResult {
  const secrets: SecretScanResult['secrets'] = []
  const lines = content.split('\n')

  // Skip certain files
  const skipPatterns = [
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
  ]

  if (skipPatterns.some(p => filePath.includes(p))) {
    return { found: false, secrets: [], filePath }
  }

  // Scan each pattern
  Object.entries(SECRET_PATTERNS).forEach(([type, pattern]) => {
    const regex = new RegExp(pattern.source, 'gm')
    let match

    while ((match = regex.exec(content))) {
      // Skip common false positives
      if (
        content.includes('// secret') ||
        content.includes('EXAMPLE_') ||
        content.includes('test_') ||
        content.includes('mock_')
      ) {
        continue
      }

      const matchIndex = content.lastIndexOf('\n', match.index)
      const lineNumber =
        content.substring(0, match.index).split('\n').length

      secrets.push({
        type,
        pattern: match[0].substring(0, 50) + '...',
        lineNumber,
      })
    }
  })

  return {
    found: secrets.length > 0,
    secrets,
    filePath,
  }
}

/**
 * F1163: Scan multiple files for secrets
 */
export function scanFilesForSecrets(
  files: Array<{ path: string; content: string }>
): Array<SecretScanResult> {
  return files
    .map((file) => scanForSecrets(file.content, file.path))
    .filter((result) => result.found)
}

/**
 * F1163: Generate CI error message
 */
export function generateSecretScanReport(
  results: Array<SecretScanResult>
): string {
  if (results.length === 0) {
    return '✓ No secrets detected'
  }

  let report = `❌ Found ${results.length} file(s) with potential secrets:\n\n`

  results.forEach((result) => {
    report += `File: ${result.filePath}\n`
    result.secrets.forEach((secret) => {
      report += `  - Line ${secret.lineNumber}: ${secret.type} pattern detected\n`
    })
    report += '\n'
  })

  report += `\nAction: Remove secrets before committing. Use environment variables instead.\n`
  return report
}

/**
 * F1163: Check if CI should fail based on secrets found
 */
export function shouldFailCI(results: Array<SecretScanResult>): boolean {
  // Fail if any secrets found
  return results.some((r) => r.found)
}
