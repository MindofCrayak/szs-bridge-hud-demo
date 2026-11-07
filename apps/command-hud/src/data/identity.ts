/**
 * Master Plan v3.1 section 3: a 3-letter company abbreviation; on collision append a digit, no hyphen
 * (PAC, PAC2). Mirrors `mintClientID_` / `clientIdBase_` in engines/master-control/src/Central_Router.gs.
 */
export const clientIdBase = (companyName: string): string => {
  const words = companyName.toUpperCase().match(/[A-Z]+/g) ?? [];
  if (words.length === 0) return 'CLT';
  if (words.length >= 3) return words.slice(0, 3).map((word) => word[0]).join('');
  let base = words.map((word) => word[0]).join('');
  const filler = (words[words.length - 1] ?? '').slice(1) + (words[0] ?? '').slice(1);
  for (let index = 0; base.length < 3 && index < filler.length; index += 1) base += filler[index];
  return base.padEnd(3, 'X');
};

export const createClientId = (companyName: string, existingIds: string[]): string => {
  const base = clientIdBase(companyName);
  const existing = new Set(existingIds.map((id) => id.trim().toUpperCase()));
  if (!existing.has(base)) return base;
  for (let counter = 2; counter <= 99; counter += 1) {
    if (!existing.has(`${base}${counter}`)) return `${base}${counter}`;
  }
  throw new Error(`No free ClientID remains for ${base}.`);
};

/** `<ClientID>-NN`: the next free two-digit project number for the client. */
export const createProjectId = (clientId: string, existingProjectIds: string[]): string => {
  const prefix = `${clientId}-`;
  const used = existingProjectIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((value) => Number.isInteger(value));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(2, '0')}`;
};

/** `INV-<ClientID>-<YY>-<NNN>`: YY = year issued; NNN = that client's invoice count for that year. */
export const createInvoiceId = (clientId: string, existingInvoiceIds: string[], issuedOn: Date): string => {
  const year = String(issuedOn.getFullYear()).slice(-2);
  const prefix = `INV-${clientId}-${year}-`;
  const used = existingInvoiceIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((value) => Number.isInteger(value));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
};
