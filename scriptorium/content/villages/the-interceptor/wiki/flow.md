# Flow

The Interceptor's job is a single decision when a user clicks the **Quick Links** button in Pronto Xi: **does this URL belong to a NextCloud resource?** If yes, the Interceptor relays the user to NextCloud. If no, the request passes through to Pronto's normal handler.

## The path of a request

1. A user clicks the **Quick Links** button inside Pronto Xi.
2. Pronto generates a URL and navigates the user toward it.
3. The Interceptor receives the request before Pronto's own URL handler does.
4. The URL is pattern-matched against known NextCloud document shapes.
5. **Match:** the Interceptor resolves the target inside NextCloud and issues a redirect. The user lands on the NextCloud document.
6. **No match:** the request is forwarded unchanged to Pronto's normal handler.

The Interceptor never modifies the URL beyond the redirect. It does not log, store, or transform content.

## Why it exists

Pronto's Quick Links generate URLs as if Pronto owned the document store, but for several document classes the canonical store is NextCloud. Without the Interceptor, those URLs would hit a dead end inside Pronto. Rewriting them at the URL layer is cheaper and safer than asking Pronto to change how it generates the links.

See `demos/` for the flow diagram and user-journey visuals.
