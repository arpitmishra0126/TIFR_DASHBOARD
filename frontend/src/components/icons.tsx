import type { SVGProps } from "react";

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </Svg>
  );
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20.5c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
      <circle cx="17" cy="8.5" r="2.4" />
      <path d="M16 14.4c2.9.4 5.5 2.5 5.5 6.1" />
    </Svg>
  );
}

export function IconProgress(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="8.5" width="4" height="12.5" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </Svg>
  );
}

export function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l7 4" />
    </Svg>
  );
}

export function IconHeart(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 20.2s-7.2-4.4-9.6-9.1A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.6 5.1c-2.4 4.7-9.6 9.1-9.6 9.1Z" />
    </Svg>
  );
}

export function IconActivity(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 12h4l2 7 4-14 2 7h6" />
    </Svg>
  );
}

export function IconMonitor(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  );
}

export function IconBrain(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M8 3.3A3 3 0 0 0 5 6.3c-1.5.35-2.5 1.7-2.5 3.2 0 1 .4 1.95 1.1 2.6-.4.6-.6 1.3-.6 2 0 1.95 1.5 3.5 3.4 3.5H8" />
      <path d="M16 3.3a3 3 0 0 1 3 3c1.5.35 2.5 1.7 2.5 3.2 0 1-.4 1.95-1.1 2.6.4.6.6 1.3.6 2 0 1.95-1.5 3.5-3.4 3.5H16" />
      <path d="M8 3.3v14.3M16 3.3v14.3" />
    </Svg>
  );
}

export function IconChevron(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </Svg>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </Svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M5 5l14 14M19 5 5 19" />
    </Svg>
  );
}

export function IconClipboardCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3.8a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 3.8v.7" />
      <path d="M9 13l2 2 4-4.5" />
    </Svg>
  );
}

export function IconUserCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="9.5" cy="8" r="3.3" />
      <path d="M3 20.5c0-3.7 2.9-6.3 6.5-6.3s6.5 2.6 6.5 6.3" />
      <path d="M16 12.3l1.6 1.6L21 10.3" />
    </Svg>
  );
}

export function IconGraduationCap(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M2.5 9.5 12 5l9.5 4.5-9.5 4.5-9.5-4.5Z" />
      <path d="M6.5 11.6v4.3c0 1.5 2.5 2.6 5.5 2.6s5.5-1.1 5.5-2.6v-4.3" />
      <path d="M21.5 9.5v5.5" />
    </Svg>
  );
}

export function IconCheckCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.4 2.4 5-5.4" />
    </Svg>
  );
}

export function IconRing(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
    </Svg>
  );
}

export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6" />
      <path d="M4 4v4.6h4.6" />
      <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.4" />
      <path d="M20 20v-4.6h-4.6" />
    </Svg>
  );
}

export function IconSun(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </Svg>
  );
}

export function IconMoon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.7 6.7 0 0 0 10.7 10.7Z" />
    </Svg>
  );
}

export function IconDotFilled(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}
