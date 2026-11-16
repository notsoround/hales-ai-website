/** The first thing the account app shows on a cold start: the assistant's portrait on the launch colour, matching the
 *  phone's own launch screen, until the app and the saved session are ready. Inline styles only: it renders before any
 *  Cupcake stylesheet has loaded. Public branding only; it knows nothing about the account. */
export function AccountSplash() {
  const matthieu = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('assistant') === 'matthieu';
  const name = matthieu ? 'Matthieu' : 'Cupcake', accent = matthieu ? '#b48cff' : '#2fe0c8', ground = matthieu ? '#09070d' : '#080c12';
  return <main role="status" aria-label={`Opening ${name}`} data-account-splash=""
    style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: ground, zIndex: 5 }}>
    <img src={matthieu ? '/matthieu-app-192.png' : '/cupcake-app-192.png'} alt="" width={112} height={112}
      style={{ width: 112, height: 112, borderRadius: 28, boxShadow: `0 24px 70px -18px ${accent}99` }} />
  </main>;
}
