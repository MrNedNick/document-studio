import { NodeViewContent, NodeViewWrapper, useEditorState, type ReactNodeViewProps } from "@tiptap/react";
import { useEffect, useId, useState } from "react";
import { loadAsset } from "../../adapters/document-store";

type Picture = { status: "loading" } | { status: "ready"; url: string; width: number; height: number } | { status: "missing" };

/** Loads a stored picture as an object URL for as long as it is on screen. */
function usePicture(assetId: string): Picture {
  // Remembering which asset the result belongs to makes "loading" derived: a new id is loading until it answers.
  const [result, setResult] = useState<{ assetId: string; picture: Picture } | null>(null);
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    void loadAsset(assetId).then((stored) => {
      if (!alive) return;
      if (!stored) return setResult({ assetId, picture: { status: "missing" } });
      url = URL.createObjectURL(stored.blob);
      setResult({ assetId, picture: { status: "ready", url, width: stored.asset.width, height: stored.asset.height } });
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [assetId]);
  return result?.assetId === assetId ? result.picture : { status: "loading" };
}

/**
 * A picture with its caption. The caption is document text (typed, searched, exported); the description
 * for people who can't see the picture is edited in a field that appears when the figure is selected.
 */
export function FigureView({ node, updateAttributes, selected, editor, getPos }: ReactNodeViewProps) {
  const assetId = String(node.attrs.assetId ?? "");
  const alt = String(node.attrs.alt ?? "");
  const picture = usePicture(assetId);
  const altId = useId();
  // The description field shows while the figure is selected or the cursor is in its caption.
  const inside = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const pos = getPos();
      if (typeof pos !== "number") return false;
      const { from, to } = current.state.selection;
      return from >= pos && to <= pos + node.nodeSize;
    },
  });
  const active = selected || inside;
  return (
    <NodeViewWrapper as="figure" className="doc-figure" data-asset-id={assetId} data-selected={active || undefined}>
      <div contentEditable={false} className="doc-figure-media">
        {picture.status === "ready" ? (
          <img src={picture.url} alt={alt} width={picture.width} height={picture.height} draggable={false} />
        ) : picture.status === "loading" ? (
          <div className="doc-figure-placeholder" aria-label="Loading picture" />
        ) : (
          <div className="doc-figure-placeholder doc-figure-missing" role="img" aria-label={alt || "Missing picture"}>
            This picture isn't stored on this device{alt ? ` — “${alt}”` : ""}.
          </div>
        )}
      </div>
      <NodeViewContent<"figcaption"> as="figcaption" className="doc-figure-caption" />
      {!node.textContent && (
        <span contentEditable={false} aria-hidden="true" className="doc-figure-caption-hint">
          Add a caption
        </span>
      )}
      {active && (
        <div contentEditable={false} className="doc-figure-alt">
          <label htmlFor={altId}>Description for screen readers</label>
          <input
            id={altId}
            value={alt}
            placeholder="What the picture shows"
            onChange={(event) => updateAttributes({ alt: event.target.value })}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </NodeViewWrapper>
  );
}
