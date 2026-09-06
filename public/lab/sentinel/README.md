# Sentinel

1. Open `/lab/sentinel/index.html` through the local preview or the website; the 3D portrait can also open as a file.
2. The entire experience is one HTML file; Three.js and the lazily loaded Vapi SDK use pinned CDN versions.
3. The HAL-style panel has a silver lens surround, glowing red eye, blue nameplate, and perforated speaker grille.
4. Pointer tracking, slow idle movement, and a separate pulse effect give the physical object a response.
5. Click the character or Talk to Sentinel to start voice; use End Call to stop. Clicking empty space does not start a call.
6. Sid V2 provides a deep, measured voice, with a concise, dry-humored Hales.ai guide persona supplied for this conversation.
7. Voice works in both standalone and embedded modes; the iframe allows microphone/audio and owns exactly one connection.
8. Voice needs HTTPS or localhost and microphone permission. No camera is used; the pointer drives the tracking effect.
9. Rendering pauses off-screen, in hidden tabs, or manually; reduced-motion users start paused, and the still portrait preserves voice access if 3D fails.
10. Replace the `sentinel` group's meshes to swap the object; cut particles and pixel ratio first if FPS dips. Phone FPS and a real voice call remain unmeasured in this review.

Voice catalogue: https://docs.vapi.ai/providers/voice/vapi-voices
