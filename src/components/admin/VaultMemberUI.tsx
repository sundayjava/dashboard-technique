/**
 * Shared furniture for the member-vault admin screens.
 *
 * Extracted when the vault detail moved out of a modal and onto its own page:
 * the list and the detail need the same tiles and tables, and two copies of a
 * money formatter is how a dollar figure ends up rounded one way in a list and
 * another way on the record it links to.
 */

export const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Signed, for figures where the direction is the point. */
export const signedMoney = (n: number) => `${n < 0 ? '-' : '+'}${money(Math.abs(n))}`;

export function Stat({
  label,
  value,
  sub,
  small = false,
  tone = 'plain',
}: {
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
  tone?: 'plain' | 'amber';
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">{label}</p>
      <p
        className={`font-semibold tabular-nums mt-1 ${small ? 'text-base' : 'text-xl'} ${
          tone === 'amber' ? 'text-amber-900' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * A titled section.
 *
 * `note` carries the row cap. The detail API returns the most recent 15
 * contributions, 15 withdrawals and 30 credits, and saying so matters more
 * here than anywhere else in the product: an admin reconciling a balance
 * against a truncated list, with nothing on screen admitting it was
 * truncated, will reach a wrong answer and trust it.
 */
export function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        {note && <span className="text-[11px] text-gray-400">{note}</span>}
      </div>
      <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto bg-white">
        {children}
      </div>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/60">
          {head.map((h, i) => (
            <th key={h} className={`font-medium px-3 py-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

/** Green for a credit, red for a debit, grey for nothing. */
export function moneyTone(n: number): string {
  if (n > 0.004) return 'text-emerald-700';
  if (n < -0.004) return 'text-red-600';
  return 'text-gray-400';
}
