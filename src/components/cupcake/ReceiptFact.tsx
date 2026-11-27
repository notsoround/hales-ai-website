import type { Fact } from './receiptFacts';

/** A receipt fact with its gap or source shown as a small tag beside the value, so the value itself never wraps. */
export function FactText({ fact }: { fact: Fact }) {
  return <><span className="cc-receipt-nowrap">{fact.text}</span>{fact.tag && <> <span className="cc-receipt-tag">{fact.tag}</span></>}</>;
}
