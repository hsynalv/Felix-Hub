/**
 * True when the client is doing a browser document navigation (SPA shell),
 * as opposed to a JSON API fetch.
 */
export function wantsHtmlNavigation(req) {
  const accept = (req.headers.accept || "").toLowerCase();
  if (accept.includes("application/json")) return false;
  if (accept.includes("text/html")) return true;
  return false;
}

/**
 * Express middleware: skip this route so SPA/static can handle HTML navigations.
 */
export function skipForHtmlNavigation(req, res, next) {
  if (wantsHtmlNavigation(req)) return next("route");
  next();
}
