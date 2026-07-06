export const PAGE_ASSETS = {
  "/tools/": {
    styles: ["/css/tools.css"],
  },
  "/trust/": {
    styles: ["/css/trust.css"],
  },
};

export function stylesForRoute(route) {
  return PAGE_ASSETS[route]?.styles ?? [];
}

export function pageAssetUrls(manifest = PAGE_ASSETS) {
  const urls = [];
  for (const assets of Object.values(manifest)) {
    urls.push(
      ...(assets.styles ?? []),
      ...(assets.scripts ?? []),
      ...(assets.assets ?? []),
    );
  }
  return [...new Set(urls)];
}
