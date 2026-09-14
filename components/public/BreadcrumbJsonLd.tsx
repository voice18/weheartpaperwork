import JsonLd from "./JsonLd";

export default function BreadcrumbJsonLd({ items }: {
  items: { name: string; url: string }[];
}) {
  return <JsonLd data={{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }} />;
}
