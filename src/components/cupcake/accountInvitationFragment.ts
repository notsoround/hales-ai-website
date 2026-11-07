/** Read once before React mounts, so development remounts cannot lose the token. */
export function takeInvitationFragment():string|null {
  if(!/^\/cupcake\/account\/?$/.test(window.location.pathname))return null;
  const params=new URLSearchParams(window.location.hash.slice(1));
  if(!params.has('invite'))return null;
  const tokens=params.getAll('invite');
  params.delete('invite');
  const remaining=params.toString();
  window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search+(remaining?'#'+remaining:''));
  return tokens.length===1?tokens[0]:'';
}
