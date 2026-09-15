type Envelope = Record<string, unknown>;
type Transport = (body: Envelope) => Promise<Envelope>;

/** Complete the server's existing review/approve protocol before reporting success. */
export async function confirmedLibraryRequest(body: Envelope, send: Transport, confirm: (description: string) => boolean | Promise<boolean>): Promise<Envelope> {
  const pending = await send(body);
  if (pending.pending !== true) return pending;
  if (pending.action !== body.action || typeof pending.action_id !== 'string' || !/^act_[A-Za-z0-9_-]{20,100}$/.test(pending.action_id) || typeof pending.description !== 'string') {
    throw new Error('Cupcake returned a confirmation that does not match your request. Nothing was approved.');
  }
  const id = pending.action_id;
  if (!await confirm(pending.description)) {
    try { await send({ action: 'cancel', action_id: id }); }
    catch { throw new Error('Nothing was approved. The pending request could not be cancelled and will expire automatically.'); }
    throw new Error('Cancelled. The requested action was not performed.');
  }
  const approved = await send({ action: 'approve', action_id: id });
  if (approved.status !== 'completed' || approved.action_id !== id || approved.pending === true || !approved.result || typeof approved.result !== 'object') {
    throw new Error('Cupcake has not confirmed completion. Check the saved result before submitting this action again.');
  }
  const result = approved.result as Envelope;
  if (result.ok === false) throw new Error(typeof result.error === 'string' ? result.error : 'The approved action could not finish.');
  return result;
}
