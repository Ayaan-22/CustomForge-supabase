/** Preserve legacy responses while directing clients to the canonical operation. */
export const deprecatedRoute = (successor) => (req, res, next) => {
  const target = typeof successor === "function" ? successor(req) : successor;
  res.setHeader("Deprecation", "true");
  res.setHeader("Link", `<${target}>; rel="successor-version"`);
  next();
};
