/**
 * True when the client is doing a browser document navigation (SPA shell),
 * as opposed to a JSON API fetch.
 */
export function wantsHtmlNavigation(req) {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) return true;
  if (accept.includes("application/json") && !accept.includes("*/*")) return false;
  return accept.includes("*/*") || accept === "";
}

/**
 * Express middleware: skip this route so SPA/static can handle HTML navigations.
 */
export function skipForHtmlNavigation(req, res, next) {
  if (wantsHtmlNavigation(req)) return next("route");
  next();
}
