import { useWindowWidth } from '../utils/hooks/useWindowWidth';

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const windowWidth = useWindowWidth();
  return (
    <div className="flex flex-col space-y-4 w-full">
      <header className="sticky top-0 z-40 bg-white">
      </header>
      <div>
        <main className={windowWidth && windowWidth <= 350 ? 'overflow-hidden' : 'flex w-full flex-1 flex-col overflow-hidden'}>
          {children}
        </main>
      </div>
    </div>
  );
}
