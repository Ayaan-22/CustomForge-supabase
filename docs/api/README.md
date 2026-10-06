# API documentation

| Document | Use |
| --- | --- |
| [Route security map](route-security-map.md) | Generated exposure, ownership, middleware and deprecation inventory. |
| [Endpoint reference](endpoints.md) | Request/response contracts and implementation references. |
| [Cart and orders](cart-orders.md) | Flow explanation; confirm exact contracts against the reference and current controller code. |
| [Authentication flow](auth-flow.md) | Earlier conceptual overview; some route names and storage descriptions may lag current code. |

Regenerate the route map from the repository root with `npm --prefix server run docs:routes` after changing route/access surfaces. Current setup and security constraints are documented in the [root README](../../README.md).

[Documentation home](../README.md)
