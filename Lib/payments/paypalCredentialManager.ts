export type PaypalCredentialManagerMetadata = {
  credential_manager_user_ids?: unknown
  /** Backward compatibility for the first DEV version. */
  credential_manager_user_id?: unknown
}

function normalizeUserId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function getPaypalCredentialManagerUserIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const typed = metadata as PaypalCredentialManagerMetadata
  const result = new Set<string>()

  if (Array.isArray(typed.credential_manager_user_ids)) {
    for (const value of typed.credential_manager_user_ids) {
      const id = normalizeUserId(value)
      if (id) result.add(id)
    }
  }

  const legacyId = normalizeUserId(typed.credential_manager_user_id)
  if (legacyId) result.add(legacyId)

  return [...result]
}

export function isPaypalCredentialManager(
  metadata: unknown,
  actorUserId: string | null | undefined,
): boolean {
  if (!actorUserId) return false
  return getPaypalCredentialManagerUserIds(metadata).includes(actorUserId)
}
