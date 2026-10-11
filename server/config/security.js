// Validate configuration before serving traffic. Never include secret values in errors.
export const validateSecurityConfiguration = (env = process.env) => {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("TLS certificate verification must be enabled. Remove NODE_TLS_REJECT_UNAUTHORIZED=0 from the server environment.");
  }
  if (env.NODE_ENV === "production") {
    if (!env.CSRF_SECRET?.trim()) throw new Error("CSRF_SECRET must be set in production");
    if (env.CSRF_SECRET === env.JWT_SECRET) throw new Error("CSRF_SECRET must be distinct from JWT_SECRET in production");
  }
};

export const getTrustProxy = (value = process.env.TRUST_PROXY) => {
  if (value === undefined || value === "") return 1;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number(value);
  // Express validates the address/subnet list when app.set is called.
  if (value === "true") throw new Error("TRUST_PROXY must specify trusted hops or addresses, not trust every proxy");
  return value.split(",").map(entry => entry.trim()).filter(Boolean);
};
