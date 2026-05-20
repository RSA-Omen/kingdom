# The Interceptor

A small, single-purpose process that sits on the Pronto URL path. When a Pronto-generated URL points at something that should land in NextCloud, the Interceptor catches it, rewrites the destination, and sends the user to the right place. Everything else passes through untouched.

The Interceptor predates [[bender]] and is not replaced by it. The two villages do different jobs:

- The Interceptor handles **one narrow URL-routing case**, on the way in.
- Bender handles **all other Pronto interactions** by driving the UI keystroke-by-keystroke.

Because the Interceptor only cares about a specific URL pattern, it's the smallest production village in the kingdom. The whole story is the [[the-interceptor/flow]] page.
