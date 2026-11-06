import React from "react";
import { RcanaSubtypeHeader, RcanaUsageBadge } from "./RcanaSubtypeFurniture.jsx";

export { SUBTYPE_FURNITURE_STYLES as ARTIFACT_TEMPLATE_STYLES } from "./RcanaSubtypeFurniture.jsx";

export function ArtifactHeader({ data, hideFrame = false, classFont, wordmarkFont, wordmarkOutline }) {
  return <RcanaSubtypeHeader data={data} template={data.artifactTemplate} hideFrame={hideFrame} classFont={classFont} wordmarkFont={wordmarkFont} wordmarkOutline={wordmarkOutline} />;
}

export function ArtifactUsageBadge({ template, label }) {
  return <RcanaUsageBadge template={template} cardClass="Artifact" label={label} />;
}
