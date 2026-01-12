type TooltipProps = {
  label: string;
};

export default function Tooltip({ label }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-canvas-800/70 text-[11px] text-slate-400">
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-56 -translate-x-1/2 rounded-lg border border-canvas-800/70 bg-canvas-900/95 px-3 py-2 text-xs text-slate-200 opacity-0 shadow-glow transition group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}
