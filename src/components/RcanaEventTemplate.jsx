import React from "react";
import { RcanaSubtypeHeader, RcanaUsageBadge } from "./RcanaSubtypeFurniture.jsx";

export function EventHeader({ data, hideFrame = false }) {
  return <RcanaSubtypeHeader data={data} template={data.eventTemplate} hideFrame={hideFrame} />;
}

export function EventUsageBadge({ template }) {
  return <RcanaUsageBadge template={template} cardClass="Event" />;
}
