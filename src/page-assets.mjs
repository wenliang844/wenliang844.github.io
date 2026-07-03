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
