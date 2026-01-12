type JsonViewerProps = {
  value: unknown;
};

export default function JsonViewer({ value }: JsonViewerProps) {
  return (
    <pre className="whitespace-pre-wrap rounded-xl border border-canvas-800/60 bg-canvas-900/30 p-4 text-xs text-slate-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
