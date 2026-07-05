"use client";

import { useState, useCallback } from "react";
import CyberButton from "./CyberButton";

/**
 * useCyberConfirm — imperative cyberpunk confirmation modal.
 *
 * Drives CyberButton's headless (controlled) mode so the same neon
 * glitch + sound-effect confirm dialog used by the /main portfolio
 * buttons can be triggered programmatically — e.g. from a bottom-dock
 * nav slot or a popover menu item — instead of by CyberButton's own
 * trigger button.
 *
 * Usage:
 *   const [confirmModal, confirm] = useCyberConfirm();
 *   ...
 *   <button onClick={() => confirm({
 *     title:   "The Liminal Terminal",
 *     body:    "Read the tape. The market confesses to those who listen.",
 *     onProceed: () => router.push('/trade'),
 *     accent:  "hsl(152, 100%, 45%)",   // optional — tints the modal
 *   })}>Terminal</button>
 *   ...
 *   {confirmModal}   // render once, anywhere in the tree
 *
 * config: { title, body, onProceed, onCancel?, proceedLabel?,
 *           cancelLabel?, accent?, shadow? }
 *   - body may be a plain string (auto-wrapped in <p>) or a ReactNode.
 */
export default function useCyberConfirm() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(null);

  const confirm = useCallback((config) => {
    setCfg(config);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const modal = cfg ? (
    <CyberButton
      hideTrigger
      externalOpen={open}
      onExternalClose={close}
      modalTitle={cfg.title}
      modalBody={typeof cfg.body === "string" ? <p>{cfg.body}</p> : cfg.body}
      proceedLabel={cfg.proceedLabel}
      cancelLabel={cfg.cancelLabel}
      accent={cfg.accent}
      shadow={cfg.shadow}
      onProceed={cfg.onProceed}
      onCancel={cfg.onCancel}
    />
  ) : null;

  return [modal, confirm];
}
