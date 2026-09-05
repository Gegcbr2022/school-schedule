/** Дрібні інлайнові іконки — щоб не тягнути цілу бібліотеку заради п'яти штук. */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

export function SunIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg {...base}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5Z" />
    </svg>
  )
}

export function SettingsIcon() {
  return (
    <svg {...base}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg {...base}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function InfoIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function BooksIcon() {
  return (
    <svg {...base}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5Z" />
    </svg>
  )
}

export function NoteIcon() {
  return (
    <svg {...base}>
      <path d="M15.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5Z" />
      <path d="M15 4v4a1 1 0 0 0 1 1h4M8 13h6M8 16.5h4" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg {...base}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

export function DownloadIcon() {
  return (
    <svg {...base}>
      <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
      <path d="M5 19h14" />
    </svg>
  )
}

export function ShareIcon() {
  return (
    <svg {...base}>
      <path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}

export function TeacherIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="7.5" r="3" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

export function DoorIcon() {
  return (
    <svg {...base}>
      <path d="M5 20h14" />
      <path d="M7.5 20V4.8a.8.8 0 0 1 .95-.79l6 1.1a.8.8 0 0 1 .65.79V20" />
      <circle cx="12.6" cy="12.4" r=".9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg {...base}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function PhoneIcon() {
  return (
    <svg {...base}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
    </svg>
  )
}
