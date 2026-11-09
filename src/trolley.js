export function renderTrolley(prefix, className, attributes = '') {
  return `    <div class="trolley ${className}" ${attributes}>
      <svg class="cart-train-back" viewBox="0 0 310 186" fill="none">
        <defs>
          <linearGradient id="${prefix}-cart-inner" x1="175" y1="50" x2="175" y2="138" gradientUnits="userSpaceOnUse">
            <stop stop-color="#d4d0c7" stop-opacity=".4"/>
            <stop offset="1" stop-color="#373435" stop-opacity=".84"/>
          </linearGradient>
        </defs>
        <path d="m62 53 177-1 61 25-39 56-160 5-23-17Z" fill="url(#${prefix}-cart-inner)"/>
        <path d="m62 53 177-1 61 25m-61-25-22 59m-155-58 18 67 137-9 44 22" stroke="#555252" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="m76 71 165-2m-160 18 154-3m-150 18 143-2M87 53l14 59m8-59 11 58m12-58 8 57m16-57 2 56m22-57-2 56m27-56-8 55m32-55-15 54" stroke="#b2ada3" stroke-opacity=".8" stroke-width="1.4"/>
        <path d="m106 143-3 18m126-25-5 24" stroke="#3d3b3a" stroke-width="4"/>
        <ellipse cx="102" cy="167" rx="8" ry="10" fill="#343333"/>
        <ellipse cx="224" cy="162" rx="8" ry="10" fill="#343333"/>
      </svg>
      <div class="cart-train-packs" data-train-packs></div>
      <div class="cart-train-target" data-arrival-target></div>
      <svg class="cart-train-front" viewBox="0 0 310 186" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <defs>
          <linearGradient id="${prefix}-cart-chrome" x1="0" y1="55" x2="0" y2="158" gradientUnits="userSpaceOnUse">
            <stop stop-color="#f5f2ed"/><stop offset=".23" stop-color="#9c9a99"/>
            <stop offset=".47" stop-color="#dedbd5"/><stop offset=".75" stop-color="#777777"/>
            <stop offset="1" stop-color="#ddd9d0"/>
          </linearGradient>
          <linearGradient id="${prefix}-cart-grip" x1="0" y1="25" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop stop-color="#bf573f"/><stop offset=".45" stop-color="#983521"/><stop offset="1" stop-color="#4c1e14"/>
          </linearGradient>
          <radialGradient id="${prefix}-cart-tire">
            <stop offset=".38" stop-color="#666262"/><stop offset=".56" stop-color="#393635"/>
            <stop offset=".85" stop-color="#181717"/><stop offset="1" stop-color="#555050"/>
          </radialGradient>
        </defs>
        <path d="M22 32h23l44 117q3 9 14 9h142l9-22" stroke="#514e4d" stroke-width="8"/>
        <path d="M22 31h23l44 117q3 8 14 8h142l9-22" stroke="url(#${prefix}-cart-chrome)" stroke-width="5.8"/>
        <path d="M10 32h30" stroke="#482016" stroke-width="13"/>
        <path d="M10 31h29" stroke="url(#${prefix}-cart-grip)" stroke-width="10"/>
        <path d="m79 76 221 1-36 54-164 7Z" fill="#9b9991" fill-opacity=".13" stroke="#514c48" stroke-width="5"/>
        <path d="m79 75 221 1-36 54-164 7Z" stroke="url(#${prefix}-cart-chrome)" stroke-width="4"/>
        <path d="m86 90 204-1M91 104l190-3m-185 17 175-5M97 76l17 60m4-60 15 59m6-59 12 58m10-58 8 57m13-57 4 56m17-56-2 55m24-55-7 54m29-54-12 53m34-53-17 52m39-52-24 49" stroke="url(#${prefix}-cart-chrome)" stroke-width="1.55"/>
        <path d="m108 156 5 12m120-12 2 12" stroke="url(#${prefix}-cart-chrome)" stroke-width="7"/>
        <ellipse cx="116" cy="172" rx="11.5" ry="12.6" fill="url(#${prefix}-cart-tire)" stroke="#3a3635" stroke-width="1.1"/>
        <ellipse cx="237" cy="171" rx="11.5" ry="12.6" fill="url(#${prefix}-cart-tire)" stroke="#3a3635" stroke-width="1.1"/>
        <circle cx="116" cy="172" r="4" fill="#c4c0b8" stroke="#736e68"/>
        <circle cx="237" cy="171" r="4" fill="#c4c0b8" stroke="#736e68"/>
      </svg>
    </div>`
}
