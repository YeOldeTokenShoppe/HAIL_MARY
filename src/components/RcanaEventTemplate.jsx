import React from "react";
import { RcanaSubtypeHeader, RcanaUsageBadge } from "./RcanaSubtypeFurniture.jsx";

export function EventHeader({ data, hideFrame = false, classFont, wordmarkFont, wordmarkOutline }) {
  return <RcanaSubtypeHeader data={data} template={data.eventTemplate} hideFrame={hideFrame} classFont={classFont} wordmarkFont={wordmarkFont} wordmarkOutline={wordmarkOutline} />;
}

export function EventUsageBadge({ template, label }) {
  return <RcanaUsageBadge template={template} cardClass="Event" label={label} />;
}
