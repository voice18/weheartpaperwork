import React from "react";

export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(data).replace(/</g, "\\u003c"),
    },
  });
}
