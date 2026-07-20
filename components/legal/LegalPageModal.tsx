"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { getLegalPage, type LegalSection } from "@/lib/legal/content";

type Props = {
  pageId: string | null;
  onClose: () => void;
};

// Mirrors the header's LYNX/ONE + "Trading Terminal" treatment — bold tracked
// headline over a widely-letter-spaced uppercase caption.
function FounderBlock({ lines }: { lines: string[] }) {
  const [name, title] = lines;
  return (
    <div className="flex flex-col items-center gap-2 border-t border-border py-5 text-center">
      <p className="text-base font-extrabold uppercase tracking-[0.08em] text-foreground sm:text-lg">{name}</p>
      <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.28em] text-primary">{title}</p>
    </div>
  );
}

// Mirrors ProfileMenu's own closing brand footer ("LYNX ONE" / "Made with ❤️ in India").
function CopyrightBlock({ lines }: { lines: string[] }) {
  const [copyrightLine, byLine, name, rightsLine] = lines;
  return (
    <div className="flex flex-col items-center gap-1 border-t border-border pt-5 text-center">
      <p className="text-xs font-bold tracking-wide text-foreground">{copyrightLine}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{byLine}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{name}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{rightsLine}</p>
    </div>
  );
}

function GenericSection({ section }: { section: LegalSection }) {
  return (
    <div className="flex flex-col gap-2">
      {section.heading && (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.heading}</p>
      )}
      {section.paragraphs.map((paragraph, j) => (
        <p key={j} className="text-sm leading-relaxed text-foreground">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export default function LegalPageModal({ pageId, onClose }: Props) {
  // Mirrors BrokerDocsModal's pattern: keep rendering the last page's content
  // while the close animation plays, instead of the modal going blank mid-exit.
  const [lastPageId, setLastPageId] = useState<string | null>(null);
  if (pageId && pageId !== lastPageId) setLastPageId(pageId);
  const page = getLegalPage(pageId ?? lastPageId ?? "");

  return (
    <Modal isOpen={pageId !== null} onClose={onClose} title={page?.title ?? "LYNX ONE"}>
      {page && (
        <div className="flex flex-col gap-5">
          {page.sections.map((section, i) => {
            const key = section.heading ?? `${section.variant ?? "section"}-${i}`;
            if (section.variant === "founder") return <FounderBlock key={key} lines={section.paragraphs} />;
            if (section.variant === "copyright") return <CopyrightBlock key={key} lines={section.paragraphs} />;
            return <GenericSection key={key} section={section} />;
          })}
        </div>
      )}
    </Modal>
  );
}
