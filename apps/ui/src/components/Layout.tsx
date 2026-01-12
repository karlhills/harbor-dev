import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

type LayoutProps = {
  children: ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
};

export default function Layout({ children, activeView, onNavigate }: LayoutProps) {
  return (
    <div className="flex min-h-screen text-slate-100">
      <Sidebar active={activeView} onNavigate={onNavigate} />
      <main className="flex flex-1 flex-col px-8 py-8">{children}</main>
    </div>
  );
}
