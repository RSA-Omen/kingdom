# Flow

The Interceptor's job is a single decision: **does this URL belong to a NextCloud resource that Pronto can't open natively?** If yes, redirect. If no, pass through.

## The path of a request

1. A user clicks a Pronto-generated URL (often from a document, an email, or an in-app link).
2. The Interceptor receives the request before Pronto's own URL handler does.
3. The URL is pattern-matched against the list of known "implied-link" shapes — paths that look like NextCloud document references but were emitted by Pronto.
4. **Match:** the Interceptor resolves the target inside NextCloud and issues a redirect. The user lands on the NextCloud document.
5. **No match:** the request is forwarded unchanged to Pronto's normal handler.

The Interceptor never modifies the URL beyond the redirect. It does not log, store, or transform content.

## Why it exists

Pronto generates URLs as if it owned the document store, but for several document classes the canonical store is NextCloud. Without the Interceptor, those URLs would hit a dead end inside Pronto. Rewriting them at the URL layer is cheaper and safer than asking Pronto to change how it generates the links.

A visual demo of the routing decision will live in `demos/` once drawn.
