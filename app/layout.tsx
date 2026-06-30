import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'EditorPulse - Publication Summary & Planner',
  description: 'A professional publication summary system that automatically handles parsing, front & back page summarization, and jump news integration.',
  icons: {
    icon: '/editorpulse-logo.svg',
  },
};

const stripExtensionHydrationAttrs = `
(() => {
  const isExtensionAttr = (name) => name.startsWith("rtrvr-");
  const cleanElement = (element) => {
    for (const attr of Array.from(element.attributes || [])) {
      if (isExtensionAttr(attr.name)) element.removeAttribute(attr.name);
    }
  };
  const cleanTree = (root) => {
    if (root instanceof Element) cleanElement(root);
    const scope = root instanceof Document ? root.documentElement : root;
    scope.querySelectorAll?.("*").forEach(cleanElement);
  };

  cleanTree(document);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.target instanceof Element && mutation.attributeName && isExtensionAttr(mutation.attributeName)) {
        mutation.target.removeAttribute(mutation.attributeName);
      }
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) cleanTree(node);
      });
    }
  });

  observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
  window.addEventListener("load", () => setTimeout(() => observer.disconnect(), 3000), { once: true });
})();
`;

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{__html: stripExtensionHydrationAttrs}} />
        {children}
      </body>
    </html>
  );
}
