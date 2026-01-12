type EmptyStateProps = {
  title: string;
  subtitle: string;
};

export default function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-canvas-800/70 bg-canvas-900/20 px-6 py-10 text-center">
      <div className="text-lg font-semibold text-slate-100">{title}</div>
      <div className="text-sm text-slate-400">{subtitle}</div>
    </div>
  );
}
