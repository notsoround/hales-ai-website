import { ACCOUNT_INSTALL_URL } from './accountInstall';

export function AccountInstallInstructions() {
  return <section className="cc-account-controls" aria-label="Add to iPhone Home Screen">
    <h3>iPhone Home Screen</h3>
    <p>For a Matthieu Home Screen icon, open <a className="cc-text-button" href={ACCOUNT_INSTALL_URL}>Add Matthieu to iPhone</a> in Safari.</p>
    <ol style={{ listStyle: 'decimal', paddingLeft: 20 }}>
      <li>Tap Safari’s Share button (in the Page Menu if needed).</li>
      <li>Choose Add to Home Screen. If shown, leave Open as Web App on, then tap Add.</li>
      <li>Open Matthieu from your Home Screen. Sign in to your account if asked.</li>
    </ol>
    <p className="cc-muted cc-small">An internet connection is required. Adding the icon does not connect Apple Health. Record or import audio on this device, then choose Save audio to account to keep a private account copy. Meeting audio sharing needs a compatible desktop browser; phone-call recording is not supported.</p>
  </section>;
}
