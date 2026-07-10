// A stylized cylindrical lattice tower — the visual anchor of the feature
// carousel. Silhouette is loosely Eiffel-Tower-shaped (tapering flares,
// belted platform levels, diagonal cross-bracing) but rendered as a rounded
// cylinder rather than 4 splayed legs. Rendered once as static SVG; the
// glow/halo rings around it (in NeonPipeCarousel) are what animate.
export function NeonTower() {
    return (
      <svg
        viewBox="0 0 200 460"
        width={140}
        height="100%"
        className="tower-glow"
        style={{ maxHeight: 440 }}
        aria-hidden="true"
      >
        <defs>
          {/* Cylindrical shading: dark at both edges, royal-blue highlight
              band left-of-center — reads as a rounded surface catching light. */}
          <linearGradient id="towerBody" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#04050c" />
            <stop offset="20%" stopColor="#0f1c46" />
            <stop offset="42%" stopColor="#2547d8" />
            <stop offset="58%" stopColor="#5b83f7" />
            <stop offset="76%" stopColor="#0f1c46" />
            <stop offset="100%" stopColor="#04050c" />
          </linearGradient>
          <linearGradient id="beltBody" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#04050c" />
            <stop offset="50%" stopColor="#173080" />
            <stop offset="100%" stopColor="#04050c" />
          </linearGradient>
          <radialGradient id="beaconGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd1e8" />
            <stop offset="60%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
          </radialGradient>
        </defs>
  
        {/* Main tapered cylindrical body */}
        <path
          d="M25,458
             C13,398 52,362 55,340
             C38,298 72,258 76,220
             C64,180 86,150 89,120
             C82,90 92,68 96,58
             L104,58
             C108,68 118,90 111,120
             C114,150 136,180 124,220
             C128,258 162,298 145,340
             C148,362 187,398 175,458
             Z"
          fill="url(#towerBody)"
          stroke="#010104"
          strokeWidth="1"
        />
  
        {/* Diagonal lattice bracing, subtle, layered over the body */}
        <g stroke="#4d7bf5" strokeOpacity="0.35" strokeWidth="1.5" fill="none">
          <path d="M34,440 L96,340 M166,440 L104,340 M34,440 L104,340 M166,440 L96,340" />
          <path d="M46,330 L94,240 M154,330 L106,240 M46,330 L106,240 M154,330 L94,240" />
          <path d="M62,230 L92,150 M138,230 L108,150 M62,230 L108,150 M138,230 L92,150" />
          <path d="M78,140 L97,75 M122,140 L103,75 M78,140 L103,75 M122,140 L97,75" />
        </g>
  
        {/* Platform belts, like the Eiffel Tower's tiers */}
        <rect x="30" y="336" width="140" height="10" rx="3" fill="url(#beltBody)" />
        <rect x="52" y="216" width="96" height="9" rx="3" fill="url(#beltBody)" />
        <rect x="70" y="116" width="60" height="8" rx="3" fill="url(#beltBody)" />
  
        {/* Pink accent chunks — rivets / warning-light panels at the lattice joints */}
        <g fill="#f472b6">
          <circle cx="55" cy="340" r="4.5" opacity="0.9" />
          <circle cx="145" cy="340" r="4.5" opacity="0.9" />
          <rect x="94" y="337" width="12" height="6" rx="2" opacity="0.85" />
          <circle cx="76" cy="220" r="3.6" opacity="0.85" />
          <circle cx="124" cy="220" r="3.6" opacity="0.85" />
          <rect x="95" y="217" width="10" height="5" rx="2" opacity="0.8" />
          <circle cx="89" cy="120" r="3" opacity="0.85" />
          <circle cx="111" cy="120" r="3" opacity="0.85" />
        </g>
  
        {/* Antenna + beacon light, like the tip of the Eiffel Tower */}
        <line x1="100" y1="58" x2="100" y2="14" stroke="#5b83f7" strokeWidth="3" />
        <circle cx="100" cy="10" r="16" fill="url(#beaconGlow)" />
        <circle cx="100" cy="10" r="4" fill="#ffe4f2" />
      </svg>
    );
  }