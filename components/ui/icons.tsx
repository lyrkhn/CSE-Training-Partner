import type { SVGProps } from "react";

function BaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M3 13h8V3H3z" />
      <path d="M13 21h8v-6h-8z" />
      <path d="M13 11h8V3h-8z" />
      <path d="M3 21h8v-4H3z" />
    </BaseIcon>
  );
}

export function CoursesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5a.5.5 0 0 1-.8.4L16 17.5l-3.2 2.4a.5.5 0 0 1-.6 0L9 17.5l-3.2 2.4a.5.5 0 0 1-.8-.4z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
    </BaseIcon>
  );
}

export function SimulationIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m10 9 5 3-5 3z" />
    </BaseIcon>
  );
}

export function AssessmentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M7 3h10l4 4v14H7z" />
      <path d="M17 3v5h5" />
      <path d="M10 13h8" />
      <path d="M10 17h6" />
    </BaseIcon>
  );
}

export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </BaseIcon>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </BaseIcon>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </BaseIcon>
  );
}

export function PanelLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m14 10 3 2-3 2" />
    </BaseIcon>
  );
}

export function LabIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M9 3v4l-4.5 8.2A3 3 0 0 0 7.1 20h9.8a3 3 0 0 0 2.6-4.8L15 7V3" />
      <path d="M8 3h8" />
      <path d="M9 12h6" />
      <path d="M8 16h8" />
    </BaseIcon>
  );
}

export function BuilderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14.5a.5.5 0 0 1-.8.4L16 17.5l-3.2 2.4a.5.5 0 0 1-.6 0L9 17.5l-3.2 2.4a.5.5 0 0 1-.8-.4z" />
      <path d="M8 8h6" />
      <path d="M8 12h8" />
      <path d="M16.5 6.5 18 8l-4.5 4.5H12v-1.5z" />
    </BaseIcon>
  );
}

export function ControlPanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <circle cx="8" cy="6" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="10" cy="18" r="2" />
    </BaseIcon>
  );
}
