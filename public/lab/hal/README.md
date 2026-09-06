# HAL

1. Open `/lab/hal/index.html` through the website or local preview; the HTML is self-contained apart from pinned CDN libraries.
2. The original experiment URL redirects here, so existing links keep working.
3. One Three.js canvas stages a metal housing and a procedural curved-glass lens; the glow and reflections render at the current pixel resolution.
4. Pointer movement across the standalone page or surrounding homepage moves the pupil much more than the housing. Reflections follow on a separate, slower response.
5. Touch movement is passive and preserves page scrolling. Mobile keeps full lens quality, with fewer particles and modest geometry.
6. Tap Talk to HAL or the character to start voice; End Call stops it. Blank canvas and Pulse never start a call.
7. Voice uses Sid V2 and a dry HAL persona. Pod bay and Bombay door requests have their own jokes. Text tests are synthetic; live audio still needs a user conversation.
8. Audio level changes the red glow. Pause motion and reduced-motion preferences stop animation; hidden/offscreen scenes stop rendering.
9. The nameplate is a sharp SVG texture, the grille is procedural, and the fallback is inline SVG. There is no camera, external font, or tracking script in this page.
10. To swap the object, replace the scene meshes and keep the independent voice module and pointer protocol. Reduce particles first if a physical-phone performance test needs it; preserve lens sharpness.
