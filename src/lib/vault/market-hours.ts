/**
 * When the US equity session is open. NO DATABASE, NO NETWORK.
 *
 * One definition, used by both the price sync (to decide whether fetching is
 * worth a credit) and the market board (to decide whether a price can honestly
 * be called live). Two copies of this would drift, and they would drift into
 * a board claiming "live" at a time the sync had already decided was closed.
 *
 * The window is deliberately a little wider than the bell: US equities trade
 * 13:30-20:00 UTC on daylight time and 14:30-21:00 UTC otherwise, and the
 * changeover is a different date in the US than in Europe. Tracking it
 * properly would mean a timezone database for the sake of half an hour twice a
 * year; being generous at both ends costs a few credits and never misses an
 * open.
 *
 * Twelve Data's /quote carries an `is_market_open` flag, which is a better
 * authority than this clock and would cover holidays for free. Using it means
 * storing it per asset at sync time -- a schema column -- and the board reads
 * stored rows, so it cannot ask the vendor itself. Worth doing if the half-hour
 * DST seam or a holiday ever actually misleads anyone; not worth a migration
 * before then.
 *
 * Holidays are not modelled. On Thanksgiving the sync will fetch and get back
 * yesterday's bar, which the board then reports as a close -- the data corrects
 * the calendar, so a holiday table would be maintenance for no gain.
 */
const SESSION_START_UTC_MINUTES = 13 * 60; // 13:00
const SESSION_END_UTC_MINUTES = 21 * 60 + 30; // 21:30

export function isUsSessionOpen(now: Date = new Date()): boolean {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false; // no weekend session
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= SESSION_START_UTC_MINUTES && minutes <= SESSION_END_UTC_MINUTES;
}
