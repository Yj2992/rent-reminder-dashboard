const fs = require("fs")
const path = require("path")

const kmpRepoPath = process.env.KMP_REPO_PATH || path.resolve(__dirname, "../../AndroidStudioProjects/RentomaticKMP")
const kotlinFile = path.resolve(
  kmpRepoPath,
  "shared/src/commonMain/kotlin/com/rentomatic/shared/contracts/BackendContracts.kt"
)
const outputFile = path.resolve(__dirname, "../lib/generatedSharedContracts.ts")

const classesToGenerate = [
  ["BackendActionResult", "TenantPortalActionResult"],
  ["PublicInvoiceContract", "TenantPortalInvoice"],
  ["CreatePaymentOrderResponse", "TenantPortalPaymentOrder"],
  ["SubmitManualPaymentProofResult", "TenantPortalManualProofResult"],
  ["OwnerAlertItemContract", "TenantPortalOwnerAlertItem"],
  ["OwnerAlertsResponse", "TenantPortalOwnerAlertsResponse"],
  ["ReminderSettingsResponse", "TenantPortalReminderSettings"],
  ["PaymentHistoryTimelineEvent", "TenantPortalPaymentHistoryTimelineEvent"],
  ["PaymentHistoryInvoice", "TenantPortalPaymentHistoryInvoice"],
  ["PaymentHistoryResponse", "TenantPortalPaymentHistoryResponse"],
]

const source = fs.readFileSync(kotlinFile, "utf8")

function extractClassBody(className) {
  const marker = `data class ${className}(`
  const start = source.indexOf(marker)
  if (start === -1) {
    throw new Error(`Could not find data class ${className}`)
  }

  let index = start + marker.length
  let depth = 1
  let body = ""

  while (index < source.length && depth > 0) {
    const char = source[index]
    if (char === "(") depth += 1
    if (char === ")") depth -= 1
    if (depth > 0) body += char
    index += 1
  }

  return body
}

function splitTopLevel(body) {
  const parts = []
  let current = ""
  let depth = 0

  for (const char of body) {
    if (char === "<" || char === "(") depth += 1
    if (char === ">" || char === ")") depth -= 1
    if (char === "," && depth === 0) {
      parts.push(current.trim())
      current = ""
      continue
    }
    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }

  return parts
}

function mapKotlinType(type) {
  const trimmed = type.trim()
  const nullable = trimmed.endsWith("?")
  const baseType = nullable ? trimmed.slice(0, -1).trim() : trimmed

  let tsType
  if (baseType.startsWith("List<") && baseType.endsWith(">")) {
    const inner = baseType.slice(5, -1)
    tsType = `${mapKotlinType(inner).replace(/ \| null/g, "")}[]`
  } else {
    switch (baseType) {
      case "String":
        tsType = "string"
        break
      case "Int":
      case "Long":
      case "Double":
      case "Float":
        tsType = "number"
        break
      case "Boolean":
        tsType = "boolean"
        break
      default:
        tsType = classesToGenerate.find(([kotlinName]) => kotlinName === baseType)?.[1] || "unknown"
        break
    }
  }

  return nullable ? `${tsType} | null` : tsType
}

function parseProperty(line) {
  const normalized = line.replace(/\n/g, " ").replace(/\s+/g, " ").trim()
  const match = normalized.match(/^val\s+([A-Za-z0-9_]+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/)
  if (!match) {
    throw new Error(`Could not parse property line: ${line}`)
  }

  const [, name, rawType, defaultValue] = match
  return {
    name,
    type: rawType.trim(),
    optional: defaultValue !== undefined || rawType.trim().endsWith("?"),
  }
}

function renderType(className, exportName) {
  const body = extractClassBody(className)
  const properties = splitTopLevel(body).map(parseProperty)

  const lines = properties.map((property) => {
    const optional = property.optional ? "?" : ""
    return `  ${property.name}${optional}: ${mapKotlinType(property.type)}`
  })

  return `export type ${exportName} = {\n${lines.join("\n")}\n}`
}

const output = [
  "// Generated from RentomaticKMP shared Kotlin contracts.",
  "// Run `npm run shared:sync-contracts` to refresh this file.",
  "",
  ...classesToGenerate.map(([className, exportName]) => renderType(className, exportName)),
  "",
].join("\n\n")

fs.writeFileSync(outputFile, output)
console.log(`Wrote ${path.relative(process.cwd(), outputFile)}`)
