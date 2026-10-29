import { randomBytes } from 'node:crypto';

/**
 * Shared values for throwaway test fixtures.
 *
 * WHY THESE ARE GENERATED RATHER THAN WRITTEN DOWN.
 *
 * Test users need a `password` column filled, but nothing ever authenticates
 * with it: the suites mint a session directly with createSessionToken(), and
 * the value is stored raw rather than bcrypt-hashed, so bcrypt.compare() in
 * the login route could never match it anyway.
 *
 * It was therefore a literal -- 'x' in most suites, 'not-a-real-login' in
 * three. The second reads enough like a passphrase that secret scanners flag
 * it, which costs a review cycle every time to establish that a string
 * meaning "this is not a credential" is, in fact, not a credential.
 *
 * Generating it removes the finding and the category: there is no longer a
 * password-shaped literal in the repository for anyone to copy into somewhere
 * it would matter.
 */
export function throwawayPassword(): string {
  return randomBytes(24).toString('hex');
}
