import './Icon.css';

const ICON_MAP: Record<string, string> = {
  app: '/icons/app-icon.svg',
  browser: '/icons/browser.svg',
  chat: '/icons/chat.svg',
  code: '/icons/code.svg',
  dashboard: '/icons/dashboard.svg',
  file: '/icons/file-browser.svg',
  settings: '/icons/settings.svg',
  tab: '/icons/tab.svg',
  terminal: '/icons/terminal.svg',
  update: '/icons/update.svg',
};

interface IconProps {
  name: keyof typeof ICON_MAP;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className = '' }: IconProps) {
  const src = ICON_MAP[name];
  if (!src) return null;

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`app-icon ${className}`}
      draggable={false}
    />
  );
}
