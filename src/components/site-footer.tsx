import type { Dictionary } from "@/i18n";

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className="mt-auto border-t border-border bg-surface print:hidden">
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm text-muted">
        <p>{dict.disclaimer}</p>
        <p>{dict.footer.builtWith}</p>
        <p>{dict.footer.data}</p>
        <p>{dict.footer.license}</p>
      </div>
    </footer>
  );
}
