/**
 * What a Chain Account member is allowed to change about their account.
 *
 * A change is stored as a proposal and replayed into the account by an admin
 * once every party has approved it, so the proposal is validated on the way in
 * AND on the way out. Spreading an unchecked object into the account update
 * would let a caller rewrite any column — the balance included — and a
 * proposal written before this list existed could still be sitting in the
 * admin queue.
 */

/** The only account fields a member may propose changing. */
const MODIFIABLE_FIELDS = {
  authorizationModel: (v: unknown) =>
    typeof v === 'string' && ['INDEPENDENT', 'THRESHOLD', 'MAJORITY'].includes(v),
  thresholdAmount: (v: unknown) => v === null || (typeof v === 'number' && v >= 0 && Number.isFinite(v)),
  thresholdCurrency: (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 10,
  primaryPurpose: (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 200,
  purposeDescription: (v: unknown) => typeof v === 'string' && v.length <= 2000,
} as const;

export type ProposedChanges = Record<string, string | number | null>;

export function sanitizeProposedChanges(
  proposedChanges: unknown
): { changes: ProposedChanges } | { error: string } {
  if (!proposedChanges || typeof proposedChanges !== 'object' || Array.isArray(proposedChanges)) {
    return { error: 'Proposed changes must be an object' };
  }

  const entries = Object.entries(proposedChanges as Record<string, unknown>);
  if (entries.length === 0) {
    return { error: 'No changes were proposed' };
  }

  const changes: ProposedChanges = {};

  for (const [field, value] of entries) {
    const isValid = MODIFIABLE_FIELDS[field as keyof typeof MODIFIABLE_FIELDS];
    if (!isValid) {
      return { error: `"${field}" is not a field members can change` };
    }
    if (!isValid(value)) {
      return { error: `The value given for "${field}" is not valid` };
    }
    changes[field] = value as string | number | null;
  }

  return { changes };
}
