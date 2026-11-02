import React from "react";
import { RcanaSubtypeHeader, RcanaUsageBadge } from "./RcanaSubtypeFurniture.jsx";

export { SUBTYPE_FURNITURE_STYLES as ARTIFACT_TEMPLATE_STYLES } from "./RcanaSubtypeFurniture.jsx";

export function ArtifactHeader({ data, hideFrame = false, classFont }) {
  return <RcanaSubtypeHeader data={data} template={data.artifactTemplate} hideFrame={hideFrame} classFont={classFont} />;
}

export function ArtifactUsageBadge({ template }) {
  return <RcanaUsageBadge template={template} cardClass="Artifact" />;
}
