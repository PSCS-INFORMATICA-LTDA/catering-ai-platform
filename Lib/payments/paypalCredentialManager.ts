export type PaypalCredentialManagerMetadata = {
  credential_manager_user_id?: unknown
}

export function getPaypalCredentialManagerUserId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const value = (metadata as PaypalCredentialManagerMetadata).credential_manager_user_id
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function isPaypalCredentialManager(
  metadata: unknown,
  actorUserId: string | null | undefined,
): boolean {
  if (!actorUserId) return false
  return getPaypalCredentialManagerUserId(metadata) === actorUserId
}
